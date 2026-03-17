import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { canUseAi, getOpenAIClientForCompany, WorkshopProcurement } from "@repo/ai-core";
import { updateEstimateHeader } from "@repo/ai-core/workshop/estimates/repository";
import type { EstimateItemCostType, EstimateItemStatus, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";
import { markLineItemsOrderedByIds } from "@repo/ai-core/workshop/inspections/repository";

type Params = { params: { token: string } | Promise<{ token: string }> };

const submitSchema = z.object({
  selectedItemIds: z.array(z.string().min(1)).default([]),
  selectedTypeByItemId: z.record(z.string(), z.enum(["oe", "oem", "aftm", "used"])).default({}),
  termsAccepted: z.boolean(),
  signatureDataUrl: z.string().min(20),
  customerName: z.string().optional().nullable(),
});

const SALE_RATIO_BY_TYPE: Record<EstimateItemCostType, { target: number }> = {
  oe: { target: 1.35 },
  oem: { target: 1.3 },
  aftm: { target: 1.25 },
  used: { target: 1.2 },
};

function normalizeMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCostMap(value: unknown): Partial<Record<EstimateItemCostType, number>> {
  const obj = (value ?? {}) as Record<string, unknown>;
  const out: Partial<Record<EstimateItemCostType, number>> = {};
  for (const key of ["oe", "oem", "aftm", "used"] as const) {
    const n = Number(obj[key]);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

function isExpired(expiresAt?: string | null): boolean {
  const raw = String(expiresAt ?? "").trim();
  if (!raw) return false;
  const time = new Date(raw).getTime();
  if (!Number.isFinite(time)) return false;
  return time < Date.now();
}

function normalizeMatchText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SelectedQuoteCandidate = {
  lineItemId: string;
  quoteId: string;
  vendorId: string | null;
  vendorName: string;
  selectedType: EstimateItemCostType;
  selectedPrice: number;
  selectedQty: number;
  selectedEtd: string;
  reason: string;
  score: number;
};

const QUALITY_BY_TYPE: Record<EstimateItemCostType, number> = {
  oe: 1.0,
  oem: 0.95,
  aftm: 0.78,
  used: 0.6,
};

function parseEtdHours(raw: unknown): number {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return 72;
  if (value.includes("same day")) return 8;
  const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)\s*day/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return ((a + b) / 2) * 24;
  }
  const daysMatch = value.match(/(\d+)\s*day/);
  if (daysMatch) {
    const d = Number(daysMatch[1]);
    if (Number.isFinite(d) && d > 0) return d * 24;
  }
  const hoursMatch = value.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    const h = Number(hoursMatch[1]);
    if (Number.isFinite(h) && h > 0) return h;
  }
  return 72;
}

function normalize01(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 1;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

async function selectBestQuotesByLineItem(args: {
  companyId: string;
  lineItemIds: string[];
  selectedTypeByItemId: Record<string, EstimateItemCostType>;
}): Promise<Map<string, SelectedQuoteCandidate>> {
  const sql = getSql();
  if (!args.lineItemIds.length) return new Map();
  const rows = await sql<any[]>`
    WITH vendor_stats AS (
      SELECT
        pq.vendor_id,
        COUNT(*)::int AS total_quotes,
        SUM(CASE WHEN LOWER(COALESCE(pq.status, '')) IN ('return', 'returned') THEN 1 ELSE 0 END)::int AS return_quotes,
        SUM(CASE WHEN LOWER(COALESCE(pq.status, '')) IN ('received', 'completed') THEN 1 ELSE 0 END)::int AS good_quotes
      FROM part_quotes pq
      WHERE pq.company_id = ${args.companyId}
      GROUP BY pq.vendor_id
    )
    SELECT
      pq.id AS quote_id,
      pq.vendor_id,
      COALESCE(v.name, 'Vendor') AS vendor_name,
      pq.line_item_id,
      COALESCE(li.quantity, 1)::numeric AS required_qty,
      pq.oe, pq.oem, pq.aftm, pq.used,
      pq.oe_qty, pq.oem_qty, pq.aftm_qty, pq.used_qty,
      pq.oe_etd, pq.oem_etd, pq.aftm_etd, pq.used_etd,
      COALESCE(vs.total_quotes, 0) AS vendor_total_quotes,
      COALESCE(vs.return_quotes, 0) AS vendor_return_quotes,
      COALESCE(vs.good_quotes, 0) AS vendor_good_quotes
    FROM part_quotes pq
    INNER JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN vendors v ON v.id = pq.vendor_id
    LEFT JOIN vendor_stats vs ON vs.vendor_id = pq.vendor_id
    WHERE pq.company_id = ${args.companyId}
      AND pq.line_item_id::text = ANY(${sql.array(args.lineItemIds)})
  `;

  type Candidate = SelectedQuoteCandidate & {
    returnRate: number;
    creditScore: number;
    qualityScore: number;
    etdHours: number;
  };
  const candidatesByLineItem = new Map<string, Candidate[]>();
  for (const row of rows) {
    const lineItemId = String(row?.line_item_id ?? "").trim();
    if (!lineItemId) continue;
    const selectedType = args.selectedTypeByItemId[lineItemId];
    if (!selectedType) continue;
    const requiredQty = Math.max(1, Number(row?.required_qty ?? 1) || 1);
    const priceRaw = Number(row?.[selectedType] ?? 0);
    if (!Number.isFinite(priceRaw) || priceRaw <= 0) continue;
    const qtyRaw = Number(row?.[`${selectedType}_qty`] ?? requiredQty);
    const selectedQty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : requiredQty;
    if (selectedQty < requiredQty) continue;
    const etdRaw = String(row?.[`${selectedType}_etd`] ?? "").trim();
    const etdHours = parseEtdHours(etdRaw);
    const totalQuotes = Math.max(1, Number(row?.vendor_total_quotes ?? 0));
    const returnRate = Number(row?.vendor_return_quotes ?? 0) / totalQuotes;
    const goodRate = Number(row?.vendor_good_quotes ?? 0) / totalQuotes;
    const creditScore = Math.max(0, Math.min(1, 0.35 + goodRate * 0.65));
    const candidate: Candidate = {
      lineItemId,
      quoteId: String(row?.quote_id ?? ""),
      vendorId: row?.vendor_id ? String(row.vendor_id) : null,
      vendorName: String(row?.vendor_name ?? "Vendor"),
      selectedType,
      selectedPrice: Number(priceRaw.toFixed(2)),
      selectedQty: Number(selectedQty.toFixed(2)),
      selectedEtd: etdRaw || "Unknown",
      reason: "Best balance of shortest ETA, lowest price, and highest quality.",
      score: 0,
      returnRate,
      creditScore,
      qualityScore: QUALITY_BY_TYPE[selectedType],
      etdHours,
    };
    const current = candidatesByLineItem.get(lineItemId) ?? [];
    current.push(candidate);
    candidatesByLineItem.set(lineItemId, current);
  }

  const selectedByLineItem = new Map<string, SelectedQuoteCandidate>();
  for (const [lineItemId, list] of candidatesByLineItem.entries()) {
    if (!list.length) continue;
    const prices = list.map((x) => x.selectedPrice);
    const hours = list.map((x) => x.etdHours);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minHours = Math.min(...hours);
    const maxHours = Math.max(...hours);
    for (const item of list) {
      const priceScore = normalize01(item.selectedPrice, minPrice, maxPrice);
      const speedScore = normalize01(item.etdHours, minHours, maxHours);
      const qualityPenalty = 1 - item.qualityScore;
      const returnPenalty = Math.max(0, Math.min(1, item.returnRate));
      const creditPenalty = 1 - item.creditScore;
      item.score = priceScore * 0.45 + speedScore * 0.35 + qualityPenalty * 0.15 + returnPenalty * 0.03 + creditPenalty * 0.02;
    }
    const best = [...list].sort((a, b) => a.score - b.score)[0]!;
    selectedByLineItem.set(lineItemId, best);
  }

  try {
    const allowed = await canUseAi("ai.workshop.quote.best_vendor_recommendation" as any, { companyId: args.companyId }).catch(
      () => true
    );
    if (allowed && selectedByLineItem.size > 0) {
      const resolved = await getOpenAIClientForCompany(args.companyId);
      if (resolved?.client) {
        const options = Array.from(candidatesByLineItem.values()).flat().map((item) => ({
          lineItemId: item.lineItemId,
          quoteId: item.quoteId,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          selectedType: item.selectedType,
          selectedPrice: item.selectedPrice,
          selectedEtd: item.selectedEtd,
          qualityScore: item.qualityScore,
          returnRate: item.returnRate,
        }));
        const completion = await resolved.client.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content:
                "Select one best quote per line item with priority: shortest delivery, lowest price, high quality, low return rate. Return strict JSON only.",
            },
            {
              role: "user",
              content: JSON.stringify({
                options,
                output: { picks: [{ lineItemId: "string", quoteId: "string", reason: "string" }] },
              }),
            },
          ],
        });
        const raw = String(completion.choices?.[0]?.message?.content ?? "").trim();
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
          const picks = Array.isArray(parsed?.picks) ? parsed.picks : [];
          for (const pick of picks as any[]) {
            const lineItemId = String(pick?.lineItemId ?? "").trim();
            const quoteId = String(pick?.quoteId ?? "").trim();
            if (!lineItemId || !quoteId) continue;
            const match = (candidatesByLineItem.get(lineItemId) ?? []).find((c) => c.quoteId === quoteId);
            if (!match) continue;
            const reason = String(pick?.reason ?? "").trim();
            selectedByLineItem.set(lineItemId, { ...match, reason: reason || match.reason });
          }
        }
      }
    }
  } catch {
    // keep heuristic selection if AI selection fails
  }

  return selectedByLineItem;
}

async function resolveEstimateByToken(token: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      e.id,
      e.company_id,
      e.inspection_id,
      e.lead_id,
      e.status,
      e.vat_rate,
      e.meta,
      e.customer_id,
      e.car_id,
      e.created_at,
      c.name AS customer_name,
      c.phone AS customer_phone,
      car.make AS car_make,
      car.model AS car_model,
      car.plate_number AS car_plate
    FROM estimates e
    LEFT JOIN customers c ON c.id = e.customer_id
    LEFT JOIN cars car ON car.id = e.car_id
    WHERE e.meta->'customerEstimateApproval'->>'token' = ${token}
    LIMIT 1
  `;
  const estimate = rows[0];
  if (!estimate) return null;
  const lineItems = estimate.inspection_id
    ? await sql`
        SELECT
          li.id,
          li.id AS "inspectionItemId",
          li.product_name AS "partName",
          li.description,
          li.quantity,
          COALESCE(li.approved_sale, 0)::numeric AS sale,
          li.status,
          li.approved_type AS "approvedType",
          COALESCE(li.approved_cost, 0)::numeric AS cost,
          jsonb_build_object(
            'oem', q.oem,
            'oe', q.oe,
            'aftm', q.aftm,
            'used', q.used
          ) AS "quoteCosts"
        FROM line_items li
        LEFT JOIN LATERAL (
          SELECT
            MIN(pq.oem) AS oem,
            MIN(pq.oe) AS oe,
            MIN(pq.aftm) AS aftm,
            MIN(pq.used) AS used
          FROM part_quotes pq
          WHERE pq.line_item_id = li.id
        ) q ON TRUE
        WHERE li.company_id = ${estimate.company_id}
          AND li.inspection_id = ${estimate.inspection_id}
          AND COALESCE(li.is_add, 0) = 0
          AND COALESCE(li.source, 'inspection') IN ('inspection', 'estimate')
        ORDER BY li.created_at ASC
      `
    : [];
  const estimateItems = await sql`
    SELECT
      ei.id,
      ei.inspection_item_id,
      ei.line_no,
      ei.part_name,
      ei.description,
      ei.quantity,
      ei.sale,
      ei.status,
      ei.approved_type,
      ei.approved_cost
    FROM estimate_items ei
    WHERE ei.estimate_id = ${estimate.id}
    ORDER BY ei.line_no ASC
  `;
  const jobCardRows = await sql`
    SELECT id
    FROM job_cards
    WHERE estimate_id = ${estimate.id}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const purchaseOrderRows = estimate.inspection_id
    ? await sql`
        SELECT poi.purchase_order_id
        FROM purchase_order_items poi
        INNER JOIN line_items li ON li.id = poi.estimate_item_id
        WHERE li.company_id = ${estimate.company_id}
          AND li.inspection_id = ${estimate.inspection_id}
        ORDER BY poi.created_at DESC
        LIMIT 1
      `
    : [];
  return {
    estimate,
    items: lineItems ?? [],
    estimateItems: estimateItems ?? [],
    linkedJobCardId: jobCardRows[0]?.id ? String(jobCardRows[0].id) : null,
    linkedPurchaseOrderId: purchaseOrderRows[0]?.purchase_order_id
      ? String(purchaseOrderRows[0].purchase_order_id)
      : null,
  };
}

function getTypeSaleOptions(
  item: any,
  persistedCosts?: Partial<Record<EstimateItemCostType, number>>
): Partial<Record<EstimateItemCostType, number>> {
  const qty = Math.max(1, Number(item?.quantity ?? 1) || 1);
  const costs = {
    ...normalizeCostMap(persistedCosts),
    ...normalizeCostMap(item?.quoteCosts),
  } as Partial<Record<EstimateItemCostType, number>>;
  const options: Partial<Record<EstimateItemCostType, number>> = {};
  for (const key of ["oe", "oem", "aftm", "used"] as const) {
    const unitCost = Number(costs?.[key]);
    if (!Number.isFinite(unitCost) || unitCost <= 0) continue;
    options[key] = Number((unitCost * SALE_RATIO_BY_TYPE[key].target * qty).toFixed(2));
  }
  return options;
}

function getChosenTypeForItem(
  itemId: string,
  item: any,
  selectedTypeByItemId: Record<string, EstimateItemCostType>
): EstimateItemCostType | null {
  const selected = selectedTypeByItemId[itemId];
  if (selected) return selected;
  const existing = String(item?.approvedType ?? "").trim().toLowerCase();
  if (existing === "oe" || existing === "oem" || existing === "aftm" || existing === "used") {
    return existing as EstimateItemCostType;
  }
  const costs = (item?.quoteCosts ?? {}) as Partial<Record<EstimateItemCostType, number>>;
  for (const key of ["oe", "oem", "aftm", "used"] as const) {
    if (Number(costs?.[key] ?? 0) > 0) return key;
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await Promise.resolve(params);
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 });
    }
    const resolved = await resolveEstimateByToken(token);
    if (!resolved) {
      return NextResponse.json({ error: "Estimate approval link not found" }, { status: 404 });
    }
    const approval = (resolved.estimate.meta?.customerEstimateApproval ?? {}) as Record<string, any>;
    const approvalExpiresAt = String(approval.expiresAt ?? "").trim() || null;
    const approvalExpired = isExpired(approvalExpiresAt);
    const savedTypeByItemId = (approval.selectedTypeByItemId ?? {}) as Record<string, EstimateItemCostType>;
    const persistedPricingByLineItemId = (resolved.estimate.meta?.aiMarketPricingByLineItemId ?? {}) as Record<
      string,
      { averages?: Partial<Record<EstimateItemCostType, number | null>> }
    >;
    const estimateItemByInspectionId = new Map<string, any>();
    const estimateItemById = new Map<string, any>();
    for (const row of resolved.estimateItems ?? []) {
      const byInspectionId = String(row?.inspection_item_id ?? "").trim();
      const byId = String(row?.id ?? "").trim();
      if (byInspectionId) estimateItemByInspectionId.set(byInspectionId, row);
      if (byId) estimateItemById.set(byId, row);
    }
    const lineItems = resolved.items
      .filter((item: any) => String(item.partName ?? "").trim())
      .map((item: any) => {
        const id = String(item.id);
        const pricingKey = String(item.inspectionItemId ?? item.id ?? "").trim();
        const estimateItem =
          estimateItemByInspectionId.get(pricingKey) ?? estimateItemById.get(id) ?? null;
        const persistedCosts = normalizeCostMap(persistedPricingByLineItemId[pricingKey]?.averages);
        const selectedType = getChosenTypeForItem(
          id,
          {
            ...item,
            approvedType: item?.approvedType ?? estimateItem?.approved_type ?? null,
          },
          savedTypeByItemId
        );
        const baseItemForPricing = {
          ...item,
          quantity: Number(item?.quantity ?? estimateItem?.quantity ?? 1),
          quoteCosts: persistedCosts,
        };
        const typeSaleOptions = getTypeSaleOptions(baseItemForPricing, persistedCosts);
        const fallbackSale = normalizeMoney(estimateItem?.sale);
        if (selectedType && Number(typeSaleOptions[selectedType] ?? 0) <= 0 && fallbackSale > 0) {
          typeSaleOptions[selectedType] = fallbackSale;
        }
        return {
          id,
          lineNo: Number(estimateItem?.line_no ?? item.lineNo ?? 0),
          partName: String(item.partName ?? ""),
          description: String(item.description ?? ""),
          quantity: Number(item.quantity ?? estimateItem?.quantity ?? 1),
          sale: normalizeMoney(item.sale) || fallbackSale,
          status: String(item.status ?? estimateItem?.status ?? "pending"),
          approvedType: (item.approvedType ?? estimateItem?.approved_type ?? null) as EstimateItemCostType | null,
          selectedType,
          typeSales: typeSaleOptions,
        };
      });
    const selectedTypeByItemId: Record<string, EstimateItemCostType> = {};
    for (const row of lineItems) {
      if (row.selectedType) selectedTypeByItemId[row.id] = row.selectedType;
    }
    return NextResponse.json({
      data: {
        estimate: {
          id: String(resolved.estimate.id),
          status: String(resolved.estimate.status ?? "draft"),
          vatRate: Number(resolved.estimate.vat_rate ?? 0),
          customerName: String(resolved.estimate.customer_name ?? ""),
          customerPhone: String(resolved.estimate.customer_phone ?? ""),
          carLabel: [resolved.estimate.car_make, resolved.estimate.car_model].filter(Boolean).join(" "),
          carPlate: String(resolved.estimate.car_plate ?? ""),
          createdAt: String(resolved.estimate.created_at ?? ""),
        },
      approval: {
        status: String(approval.status ?? "pending"),
        approvedAt: approval.approvedAt ?? null,
        expiresAt: approvalExpiresAt,
        isExpired: approvalExpired,
        customerName: approval.customerName ?? null,
        termsAccepted: Boolean(approval.termsAccepted),
        signatureDataUrl: typeof approval.signatureDataUrl === "string" ? approval.signatureDataUrl : null,
        jobCardId: approval.jobCardId ?? resolved.linkedJobCardId ?? null,
        purchaseOrderId: approval.purchaseOrderId ?? resolved.linkedPurchaseOrderId ?? null,
        selectedItemIds: Array.isArray(approval.selectedItemIds) ? approval.selectedItemIds : [],
        selectedTypeByItemId,
      },
        items: lineItems,
      },
    });
  } catch (err: any) {
    console.error("GET /api/public/estimate-approval/[token] error", err);
    return NextResponse.json(
      {
        error: "Failed to load estimate approval data",
        details: err?.message ? String(err.message) : null,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await Promise.resolve(params);
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }
  if (!parsed.data.termsAccepted) {
    return NextResponse.json({ error: "You must accept terms before submit" }, { status: 400 });
  }
  const signature = String(parsed.data.signatureDataUrl ?? "").trim();
  if (!/^data:image\/png;base64,/.test(signature)) {
    return NextResponse.json({ error: "Please add your signature before submitting." }, { status: 400 });
  }

  const resolved = await resolveEstimateByToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Estimate approval link not found" }, { status: 404 });
  }

  const meta = (resolved.estimate.meta ?? {}) as Record<string, any>;
  const currentApproval = (meta.customerEstimateApproval ?? {}) as Record<string, any>;
  if (String(currentApproval.status ?? "").toLowerCase() === "approved") {
    return NextResponse.json({ error: "This estimate is already approved." }, { status: 400 });
  }
  if (isExpired(String(currentApproval.expiresAt ?? "").trim() || null)) {
    return NextResponse.json(
      { error: "This estimate has expired. Please request a new estimate." },
      { status: 400 }
    );
  }

  const allowedIds = new Set(resolved.items.map((item: any) => String(item.id)));
  const selectedByList = parsed.data.selectedItemIds
    .map((id) => String(id).trim())
    .filter((id) => allowedIds.has(id));
  const selectedByTypeMap = Object.keys(parsed.data.selectedTypeByItemId ?? {})
    .map((id) => String(id).trim())
    .filter((id) => allowedIds.has(id));
  const selectedItemIds = Array.from(new Set([...selectedByList, ...selectedByTypeMap]));
  const persistedPricingByLineItemId = (resolved.estimate.meta?.aiMarketPricingByLineItemId ?? {}) as Record<
    string,
    { averages?: Partial<Record<EstimateItemCostType, number | null>> }
  >;
  const selectedTypeByItemId: Record<string, EstimateItemCostType> = {};
  for (const [itemId, rawType] of Object.entries(parsed.data.selectedTypeByItemId ?? {})) {
    const id = String(itemId ?? "").trim();
    if (!id || !allowedIds.has(id)) continue;
    if (!selectedItemIds.includes(id)) continue;
    const type = String(rawType ?? "").trim().toLowerCase();
    if (type === "oe" || type === "oem" || type === "aftm" || type === "used") {
      selectedTypeByItemId[id] = type as EstimateItemCostType;
    }
  }

  const mappedItems = resolved.items.map((item: any, idx: number) => {
    const id = String(item.id ?? "");
    const selected = selectedItemIds.includes(id);
    const nextStatus: EstimateItemStatus = selected ? "approved" : "rejected";
    const chosenType = selected ? getChosenTypeForItem(id, item, selectedTypeByItemId) : (item.approvedType ?? null);
    const qty = Math.max(1, Number(item.quantity ?? 1) || 1);
    const pricingKey = String(item.inspectionItemId ?? item.id ?? "").trim();
    const quoteCosts = {
      ...normalizeCostMap(persistedPricingByLineItemId[pricingKey]?.averages),
      ...normalizeCostMap(item.quoteCosts),
    } as Partial<Record<EstimateItemCostType, number>>;
    const chosenUnitCost =
      chosenType && Number.isFinite(Number(quoteCosts?.[chosenType] ?? NaN))
        ? Number(quoteCosts?.[chosenType] ?? 0)
        : Number(item.cost ?? 0) / qty;
    const approvedCost = Number((chosenUnitCost * qty).toFixed(2));
    const nextSale =
      selected && chosenType && Number.isFinite(chosenUnitCost) && chosenUnitCost > 0
        ? Number((chosenUnitCost * SALE_RATIO_BY_TYPE[chosenType].target * qty).toFixed(2))
        : normalizeMoney(item.sale);

    return {
      id,
      lineNo: Number(item.lineNo ?? idx + 1),
      inspectionItemId: item.inspectionItemId ?? null,
      partName: String(item.partName ?? ""),
      description: item.description ?? null,
      type: (String(item.type ?? "genuine") as any),
      quantity: qty,
      cost: approvedCost,
      sale: nextSale,
      gpPercent: item.gpPercent != null ? Number(item.gpPercent) : null,
      status: nextStatus,
      approvedType: chosenType ?? null,
      approvedCost: approvedCost,
    };
  });
  const sql = getSql();
  const estimateItems = Array.isArray((resolved as any).estimateItems) ? ((resolved as any).estimateItems as any[]) : [];
  const usedEstimateItemIds = new Set<string>();
  const matchedLineItemIds = new Set<string>();
  for (const item of mappedItems) {
    const selected = selectedItemIds.includes(String(item.id));
    const nextCustomerApprovalStatus = selected ? "approved" : "rejected";
    const nextLineItemStatus = selected ? "Approved" : "Rejected";
    const nextEstimateItemStatus = selected ? "approved" : "rejected";
    await sql`
      UPDATE line_items
      SET
        customer_approval_status = ${nextCustomerApprovalStatus},
        status = ${nextLineItemStatus},
        approved_type = ${item.approvedType ?? null},
        approved_cost = ${item.approvedCost ?? null},
        approved_sale = ${item.sale ?? null},
        updated_at = NOW()
      WHERE company_id = ${resolved.estimate.company_id}
        AND id = ${item.id}
    `;

    const currentLineItemId = String(item.id ?? "").trim();
    const currentPartName = normalizeMatchText(item.partName ?? "");
    const currentDescription = normalizeMatchText(item.description ?? "");
    const currentQty = Number(item.quantity ?? 1);
    const matchedEstimateItem =
      estimateItems.find((ei: any) => String(ei?.inspection_item_id ?? "").trim() === currentLineItemId) ??
      estimateItems.find((ei: any) => String(ei?.id ?? "").trim() === currentLineItemId) ??
      estimateItems.find((ei: any) => {
        const estimateItemId = String(ei?.id ?? "").trim();
        if (!estimateItemId || usedEstimateItemIds.has(estimateItemId)) return false;
        const nameMatch = normalizeMatchText(ei?.part_name ?? "") === currentPartName;
        if (!nameMatch) return false;
        const qtyMatch = Number(ei?.quantity ?? 1) === currentQty;
        if (!qtyMatch) return false;
        const estimateDesc = normalizeMatchText(ei?.description ?? "");
        if (!currentDescription || !estimateDesc) return true;
        return estimateDesc === currentDescription;
      }) ??
      null;

    if (matchedEstimateItem?.id) {
      matchedLineItemIds.add(currentLineItemId);
      usedEstimateItemIds.add(String(matchedEstimateItem.id));
      await sql`
        UPDATE estimate_items
        SET
          inspection_item_id = COALESCE(inspection_item_id, ${currentLineItemId}::uuid),
          status = ${nextEstimateItemStatus},
          approved_type = ${item.approvedType ?? null},
          approved_cost = ${item.approvedCost ?? null},
          sale = ${item.sale ?? null},
          updated_at = NOW()
        WHERE estimate_id = ${resolved.estimate.id}
          AND id = ${String(matchedEstimateItem.id)}
      `;
    }
  }

  const unmatchedMappedItems = mappedItems.filter((item) => !matchedLineItemIds.has(String(item.id ?? "").trim()));
  if (unmatchedMappedItems.length > 0) {
    const remainingEstimateItems = estimateItems
      .filter((ei: any) => !usedEstimateItemIds.has(String(ei?.id ?? "").trim()))
      .sort((a: any, b: any) => Number(a?.line_no ?? 0) - Number(b?.line_no ?? 0));
    for (let i = 0; i < unmatchedMappedItems.length && i < remainingEstimateItems.length; i++) {
      const item = unmatchedMappedItems[i];
      const ei = remainingEstimateItems[i];
      const selected = selectedItemIds.includes(String(item.id));
      const nextEstimateItemStatus = selected ? "approved" : "rejected";
      await sql`
        UPDATE estimate_items
        SET
          status = ${nextEstimateItemStatus},
          approved_type = ${item.approvedType ?? null},
          approved_cost = ${item.approvedCost ?? null},
          sale = ${item.sale ?? null},
          updated_at = NOW()
        WHERE estimate_id = ${resolved.estimate.id}
          AND id = ${String(ei.id)}
      `;
    }
  }

  await sql`
    UPDATE estimate_items ei
    SET
      inspection_item_id = li.id,
      updated_at = NOW()
    FROM line_items li
    WHERE ei.estimate_id = ${resolved.estimate.id}
      AND ei.inspection_item_id IS NULL
      AND li.company_id = ${resolved.estimate.company_id}
      AND li.inspection_id = ${resolved.estimate.inspection_id}
      AND LOWER(COALESCE(li.product_name, '')) = LOWER(COALESCE(ei.part_name, ''))
      AND LOWER(COALESCE(li.description, '')) = LOWER(COALESCE(ei.description, ''))
  `;

  await sql`
    UPDATE estimate_items ei
    SET
      status = CASE
        WHEN LOWER(COALESCE(li.customer_approval_status, '')) = 'approved' THEN 'approved'
        WHEN LOWER(COALESCE(li.customer_approval_status, '')) = 'rejected' THEN 'rejected'
        ELSE ei.status
      END,
      approved_type = COALESCE(li.approved_type, ei.approved_type),
      approved_cost = COALESCE(li.approved_cost, ei.approved_cost),
      sale = COALESCE(li.approved_sale, ei.sale),
      updated_at = NOW()
    FROM line_items li
    WHERE ei.estimate_id = ${resolved.estimate.id}
      AND li.company_id = ${resolved.estimate.company_id}
      AND ei.inspection_item_id = li.id
  `;

  let orderedCount = 0;
  const selectedInspectionLineItemIds = mappedItems
    .filter((item: any) => selectedItemIds.includes(String(item.id)))
    .map((item: any) => String(item.id))
    .filter(Boolean);
  if (selectedInspectionLineItemIds.length > 0 && resolved.estimate.inspection_id) {
    orderedCount = await markLineItemsOrderedByIds(String(resolved.estimate.inspection_id), selectedInspectionLineItemIds);
  }

  let jobCardId: string | null = null;
  let jobCardCreated = false;
  let purchaseOrderId: string | null = null;
  let purchaseOrderCreated = false;
  let purchaseOrderError: string | null = null;
  const purchaseOrdersCreated: Array<{ poId: string; vendorId: string | null; vendorName: string | null; itemsCount: number }> = [];
  const selectedQuoteByLineItemId: Record<string, { quoteId: string; vendorId: string | null; selectedType: EstimateItemCostType; reason: string }> = {};
  if (selectedItemIds.length > 0) {
    const existingJobCardRows = await sql<any[]>/* sql */ `
      SELECT id
      FROM job_cards
      WHERE estimate_id = ${resolved.estimate.id}
        AND status IN ('Pending', 'Re-Assigned')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (existingJobCardRows[0]?.id) {
      jobCardId = String(existingJobCardRows[0].id);
    } else {
      const createdJobCardRows = await sql<any[]>/* sql */ `
        INSERT INTO job_cards (
          done_by,
          estimate_id,
          lead_id,
          status
        ) VALUES (
          NULL,
          ${resolved.estimate.id},
          ${resolved.estimate.lead_id ?? null},
          'Pending'
        )
        RETURNING id
      `;
      if (createdJobCardRows[0]?.id) {
        jobCardId = String(createdJobCardRows[0].id);
        jobCardCreated = true;
      }
    }

    if (jobCardId && resolved.estimate.inspection_id) {
      if (selectedInspectionLineItemIds.length > 0) {
        await sql<any[]>/* sql */ `
          UPDATE line_items li
          SET job_card_id = ${jobCardId}
          WHERE li.company_id = ${resolved.estimate.company_id}
            AND li.inspection_id = ${resolved.estimate.inspection_id}
            AND li.job_card_id IS NULL
            AND li.id::text = ANY(${sql.array(selectedInspectionLineItemIds)})
            AND LOWER(COALESCE(li.customer_approval_status, '')) = 'approved'
        `;
      } else {
        await sql<any[]>/* sql */ `
          UPDATE line_items li
          SET job_card_id = ${jobCardId}
          WHERE li.company_id = ${resolved.estimate.company_id}
            AND li.inspection_id = ${resolved.estimate.inspection_id}
            AND li.job_card_id IS NULL
            AND LOWER(COALESCE(li.customer_approval_status, '')) = 'approved'
        `;
      }
    }

    try {
      const leadRows = resolved.estimate.lead_id
        ? await sql<any[]>/* sql */ `
            SELECT branch_id
            FROM leads
            WHERE id = ${resolved.estimate.lead_id}
            LIMIT 1
          `
        : [];
      const branchId = leadRows[0]?.branch_id ? String(leadRows[0].branch_id) : null;
      const approvedMappedItems = mappedItems.filter((item: any) => selectedItemIds.includes(String(item.id)));
      const bestQuotesByLineItemId = await selectBestQuotesByLineItem({
        companyId: String(resolved.estimate.company_id),
        lineItemIds: approvedMappedItems.map((item) => String(item.id)),
        selectedTypeByItemId,
      });

      const groupedByVendor = new Map<
        string,
        {
          vendorId: string | null;
          vendorName: string | null;
          items: Array<{
            lineItemId: string;
            partName: string;
            description: string | null;
            quantity: number;
            unitCost: number;
            quoteId: string | null;
            selectedType: EstimateItemCostType | null;
            reason: string | null;
          }>;
        }
      >();
      for (const item of approvedMappedItems) {
        const lineItemId = String(item.id);
        const qty = Math.max(1, Number(item.quantity ?? 1) || 1);
        const totalCost = Number(item.approvedCost ?? item.cost ?? 0);
        const fallbackUnitCost = qty > 0 ? Number((totalCost / qty).toFixed(2)) : 0;
        const bestQuote = bestQuotesByLineItemId.get(lineItemId);
        const vendorId = bestQuote?.vendorId ?? null;
        const vendorName = bestQuote?.vendorName ?? null;
        const groupKey = vendorId || "__no_vendor__";
        const group = groupedByVendor.get(groupKey) ?? {
          vendorId,
          vendorName,
          items: [],
        };
        if (bestQuote) {
          selectedQuoteByLineItemId[lineItemId] = {
            quoteId: bestQuote.quoteId,
            vendorId: bestQuote.vendorId,
            selectedType: bestQuote.selectedType,
            reason: bestQuote.reason,
          };
        }
        group.items.push({
          lineItemId,
          partName: String(item.partName ?? "Part"),
          description: String(item.description ?? "").trim() || null,
          quantity: bestQuote?.selectedQty && bestQuote.selectedQty > 0 ? bestQuote.selectedQty : qty,
          unitCost: bestQuote?.selectedPrice && bestQuote.selectedPrice > 0 ? bestQuote.selectedPrice : fallbackUnitCost,
          quoteId: bestQuote?.quoteId ?? null,
          selectedType: bestQuote?.selectedType ?? (item.approvedType ?? null),
          reason: bestQuote?.reason ?? null,
        });
        groupedByVendor.set(groupKey, group);
      }

      for (const [, group] of groupedByVendor.entries()) {
        const autoPoItems = group.items
          .map((entry) => ({
            name: entry.partName,
            description: entry.description,
            quantity: entry.quantity,
            unitCost: Number.isFinite(entry.unitCost) ? entry.unitCost : 0,
            estimateItemId: entry.lineItemId,
            quoteId: entry.quoteId,
            lineStatus: null,
          }))
          .filter((entry) => entry.quantity > 0);
        if (!autoPoItems.length) continue;
        const autoPo = await WorkshopProcurement.createManualPo({
          companyId: String(resolved.estimate.company_id),
          poType: "po",
          vendorId: group.vendorId,
          vendorName: group.vendorName,
          currency: "AED",
          createdBy: null,
          notes: `AUTO-ESTIMATE:${String(resolved.estimate.id)};LEAD:${String(resolved.estimate.lead_id ?? "")};BRANCH:${branchId ?? ""};JOB_CARD:${jobCardId ?? ""};VENDOR:${group.vendorId ?? "UNASSIGNED"}`,
          items: autoPoItems,
        });
        const createdPoId = String(autoPo.po.id);
        purchaseOrdersCreated.push({
          poId: createdPoId,
          vendorId: group.vendorId,
          vendorName: group.vendorName,
          itemsCount: autoPoItems.length,
        });
        if (!purchaseOrderId) purchaseOrderId = createdPoId;
        await WorkshopProcurement.updatePurchaseOrderHeader(String(resolved.estimate.company_id), createdPoId, {
          status: "issued",
        });
      }
      purchaseOrderCreated = purchaseOrdersCreated.length > 0;

      for (const item of approvedMappedItems) {
        const lineItemId = String(item.id);
        const picked = selectedQuoteByLineItemId[lineItemId];
        if (!picked?.quoteId) continue;
        const orderedQtyByType = {
          oe: picked.selectedType === "oe" ? Number(item.quantity ?? 1) : 0,
          oem: picked.selectedType === "oem" ? Number(item.quantity ?? 1) : 0,
          aftm: picked.selectedType === "aftm" ? Number(item.quantity ?? 1) : 0,
          used: picked.selectedType === "used" ? Number(item.quantity ?? 1) : 0,
        };
        await sql`
          UPDATE part_quotes
          SET
            status = 'Ordered',
            ordered_type = ${picked.selectedType},
            ordered_unit_price = ${Number(item.approvedCost ?? item.cost ?? 0) / Math.max(1, Number(item.quantity ?? 1))},
            ordered_oe_qty = ${orderedQtyByType.oe || null},
            ordered_oem_qty = ${orderedQtyByType.oem || null},
            ordered_aftm_qty = ${orderedQtyByType.aftm || null},
            ordered_used_qty = ${orderedQtyByType.used || null},
            updated_at = NOW()
          WHERE company_id = ${resolved.estimate.company_id}
            AND id = ${picked.quoteId}
        `;
      }
    } catch (err: any) {
      purchaseOrderError = err?.message ? String(err.message) : "Failed to auto-create purchase order.";
    }
  }

  if (selectedItemIds.length > 0 && !purchaseOrderCreated) {
    return NextResponse.json(
      {
        error:
          purchaseOrderError ??
          "Estimate approved but purchase order could not be auto-created. Please contact support.",
        data: {
          estimateId: String(resolved.estimate.id),
          jobCardId,
          purchaseOrderCreated: false,
        },
      },
      { status: 500 }
    );
  }

  if (selectedItemIds.length > 0 && !jobCardId) {
    return NextResponse.json(
      {
        error: "Estimate approved but job card could not be created. Please contact support.",
        data: {
          estimateId: String(resolved.estimate.id),
          purchaseOrderId,
          purchaseOrderCreated,
        },
      },
      { status: 500 }
    );
  }

  const approvedAt = new Date().toISOString();
  const nextMeta = {
    ...meta,
    customerEstimateApproval: {
      ...currentApproval,
      token,
      status: "approved",
      approvedAt,
      termsAccepted: true,
      signatureDataUrl: signature,
      customerName: String(parsed.data.customerName ?? "").trim() || null,
      jobCardId: jobCardId ?? null,
      purchaseOrderId: purchaseOrderId ?? null,
      selectedItemIds,
      selectedTypeByItemId,
      selectedQuoteByLineItemId,
      purchaseOrders: purchaseOrdersCreated,
    },
  };
  const nextEstimateStatus: EstimateStatus = selectedItemIds.length > 0 ? "approved" : "rejected";
  await updateEstimateHeader(String(resolved.estimate.company_id), String(resolved.estimate.id), {
    status: nextEstimateStatus,
    meta: nextMeta,
  });

  return NextResponse.json({
    data: {
      estimateId: String(resolved.estimate.id),
      status: nextEstimateStatus,
      approvedAt,
      selectedItemIds,
      selectedTypeByItemId,
      orderedCount,
      jobCardId,
      jobCardCreated,
      purchaseOrderId,
      purchaseOrderCreated,
      purchaseOrders: purchaseOrdersCreated,
    },
  });
}
