import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { getEstimateWithItems, replaceEstimateItems, updateEstimateHeader } from "@repo/ai-core/workshop/estimates/repository";
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
  const estimateData = await getEstimateWithItems(String(estimate.company_id), String(estimate.id));
  return { estimate, items: estimateData?.items ?? [] };
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
  const lineItems = resolved.items
    .filter((item: any) => String(item.partName ?? "").trim())
    .map((item: any) => {
      const id = String(item.id);
      const pricingKey = String(item.inspectionItemId ?? item.id ?? "").trim();
      const persistedCosts = normalizeCostMap(persistedPricingByLineItemId[pricingKey]?.averages);
      const typeSaleOptions = getTypeSaleOptions(item, persistedCosts);
      const selectedType = getChosenTypeForItem(id, item, savedTypeByItemId);
      return {
        id,
        lineNo: Number(item.lineNo ?? 0),
        partName: String(item.partName ?? ""),
        description: String(item.description ?? ""),
        quantity: Number(item.quantity ?? 1),
        sale: normalizeMoney(item.sale),
        status: String(item.status ?? "pending"),
        approvedType: (item.approvedType ?? null) as EstimateItemCostType | null,
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
        selectedItemIds: Array.isArray(approval.selectedItemIds) ? approval.selectedItemIds : [],
        selectedTypeByItemId,
      },
      items: lineItems,
    },
  });
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

  await replaceEstimateItems(String(resolved.estimate.id), mappedItems as any);

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
      selectedItemIds,
      selectedTypeByItemId,
    },
  };
  const nextEstimateStatus: EstimateStatus = selectedItemIds.length > 0 ? "approved" : "rejected";
  await updateEstimateHeader(String(resolved.estimate.company_id), String(resolved.estimate.id), {
    status: nextEstimateStatus,
    meta: nextMeta,
  });

  let orderedCount = 0;
  const selectedInspectionLineItemIds = mappedItems
    .filter((item: any) => selectedItemIds.includes(String(item.id)) && item.inspectionItemId)
    .map((item: any) => String(item.inspectionItemId))
    .filter(Boolean);
  if (selectedInspectionLineItemIds.length > 0 && resolved.estimate.inspection_id) {
    orderedCount = await markLineItemsOrderedByIds(String(resolved.estimate.inspection_id), selectedInspectionLineItemIds);
  }

  let jobCardId: string | null = null;
  let jobCardCreated = false;
  if (selectedItemIds.length > 0) {
    const sql = getSql();
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
          UPDATE line_items
          SET job_card_id = ${jobCardId}
          WHERE company_id = ${resolved.estimate.company_id}
            AND inspection_id = ${resolved.estimate.inspection_id}
            AND status = 'Approved'
            AND job_card_id IS NULL
            AND id = ANY(${sql.array(selectedInspectionLineItemIds)})
        `;
      } else {
        await sql<any[]>/* sql */ `
          UPDATE line_items
          SET job_card_id = ${jobCardId}
          WHERE company_id = ${resolved.estimate.company_id}
            AND inspection_id = ${resolved.estimate.inspection_id}
            AND status = 'Approved'
            AND job_card_id IS NULL
        `;
      }
    }
  }

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
    },
  });
}
