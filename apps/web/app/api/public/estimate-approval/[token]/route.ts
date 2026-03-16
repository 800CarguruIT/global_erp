import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { WorkshopProcurement } from "@repo/ai-core";
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
      const autoPoItems = mappedItems
        .filter((item: any) => selectedItemIds.includes(String(item.id)))
        .map((item: any) => {
          const qty = Math.max(1, Number(item.quantity ?? 1) || 1);
          const totalCost = Number(item.approvedCost ?? item.cost ?? 0);
          const unitCost = qty > 0 ? Number((totalCost / qty).toFixed(2)) : 0;
          return {
            name: String(item.partName ?? "Part"),
            description: String(item.description ?? "").trim() || null,
            quantity: qty,
            unitCost: Number.isFinite(unitCost) ? unitCost : 0,
            estimateItemId: String(item.id),
            quoteId: null,
            lineStatus: null,
          };
        })
        .filter((item: any) => item.quantity > 0);
      if (autoPoItems.length > 0) {
        const autoPo = await WorkshopProcurement.createManualPo({
          companyId: String(resolved.estimate.company_id),
          poType: "po",
          vendorId: null,
          vendorName: null,
          currency: "AED",
          createdBy: null,
          notes: `AUTO-ESTIMATE:${String(resolved.estimate.id)};LEAD:${String(resolved.estimate.lead_id ?? "")};BRANCH:${branchId ?? ""};JOB_CARD:${jobCardId ?? ""}`,
          items: autoPoItems,
        });
        purchaseOrderId = String(autoPo.po.id);
        purchaseOrderCreated = true;
        await WorkshopProcurement.updatePurchaseOrderHeader(String(resolved.estimate.company_id), purchaseOrderId, {
          status: "issued",
        });
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
    },
  });
}
