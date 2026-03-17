import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const sql = getSql();
  const statusParam = req.nextUrl.searchParams.get("status")?.trim() ?? "";
  const statusFilter = (() => {
    if (!statusParam) return sql``;
    const normalized = statusParam.toLowerCase();
    if (normalized === "quoted") {
      return sql`AND (
        LOWER(pq.status) IN ('pending', 'quoted', 'approved')
        OR (
          LOWER(pq.status) = 'pending'
          AND LOWER(COALESCE(li.status, iori.status)) IN ('approved', 'inquiry', 'pending')
          AND COALESCE(li.status, iori.status) IS NOT NULL
        )
      )`;
    }
    if (normalized === "completed") {
      return sql`AND pq.status IN ('Received', 'Completed')`;
    }
    if (normalized === "returns") {
      return sql`AND pq.status IN ('Return', 'Returned')`;
    }
    return sql`AND pq.status = ${statusParam}`;
  })();

  const rows = await sql`
    SELECT
      pq.id,
      pq.status,
      pq.oem,
      pq.oe,
      pq.aftm,
      pq.used,
      pq.oem_qty,
      pq.oe_qty,
      pq.aftm_qty,
      pq.used_qty,
      pq.oem_etd,
      pq.oe_etd,
      pq.aftm_etd,
      pq.used_etd,
      pq.remarks,
      pq.updated_at,
      pq.part_number,
      pq.part_brand,
      pq.oem_brand,
      pq.oe_brand,
      pq.aftm_brand,
      pq.used_brand,
      pq.oem_time,
      pq.oe_time,
      pq.aftm_time,
      pq.used_time,
      pq.delivery_note_no,
      pq.delivery_note_status,
      pq.delivery_note_payload,
      pq.ordered_type,
      pq.ordered_unit_price,
      pq.inventory_request_item_id,
      pq.inventory_request_id,
      pq.estimate_item_id,
      pq.line_item_id,
      pq.estimate_id,
      v.name AS vendor_name,
      COALESCE(li.product_name, iori.part_name) AS part_name,
      LOWER(COALESCE(li.status, iori.status)) AS item_status,
      COALESCE(li.approved_type, ei.approved_type) AS approved_type,
      est.status AS estimate_status,
      est_from_request.status AS request_estimate_status,
      est_from_inspection.status AS inspection_estimate_status,
      COALESCE(
        est.meta->'customerEstimateApproval'->>'status',
        est_from_request.meta->'customerEstimateApproval'->>'status',
        est_from_inspection.meta->'customerEstimateApproval'->>'status'
      ) AS customer_approval_status,
      COALESCE(
        est.meta->'customerEstimateApproval'->>'approvedAt',
        est_from_request.meta->'customerEstimateApproval'->>'approvedAt',
        est_from_inspection.meta->'customerEstimateApproval'->>'approvedAt'
      ) AS customer_approved_at,
      car.id AS car_id,
      COALESCE(
        NULLIF(car.make, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionMake', ''),
        NULLIF(est.meta->>'inspectionMake', ''),
        NULLIF(est.meta->>'carMake', ''),
        NULLIF(est_from_request.meta->>'inspectionMake', ''),
        NULLIF(est_from_request.meta->>'carMake', '')
      ) AS car_make,
      COALESCE(
        NULLIF(car.model, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionModel', ''),
        NULLIF(est.meta->>'inspectionModel', ''),
        NULLIF(est.meta->>'carModel', ''),
        NULLIF(est_from_request.meta->>'inspectionModel', ''),
        NULLIF(est_from_request.meta->>'carModel', '')
      ) AS car_model,
      COALESCE(
        NULLIF(car.plate_number, ''),
        NULLIF(est.meta->>'carPlate', ''),
        NULLIF(est.meta->>'plate', ''),
        NULLIF(est_from_request.meta->>'carPlate', ''),
        NULLIF(est_from_request.meta->>'plate', '')
      ) AS car_plate,
      COALESCE(
        NULLIF(car.vin, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionVin', ''),
        NULLIF(est.meta->>'inspectionVin', ''),
        NULLIF(est.meta->>'carVin', ''),
        NULLIF(est.meta->>'vin', ''),
        NULLIF(est_from_request.meta->>'inspectionVin', ''),
        NULLIF(est_from_request.meta->>'carVin', ''),
        NULLIF(est_from_request.meta->>'vin', '')
      ) AS car_vin,
      ior.request_number,
      v.id AS vendor_id,
      direct_grn.grn_number AS direct_grn_number
    FROM part_quotes pq
    LEFT JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN estimate_items ei ON ei.id = pq.estimate_item_id
    LEFT JOIN estimates est ON est.id = pq.estimate_id
    LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
    LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
    LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
    LEFT JOIN estimates est_from_request ON est_from_request.id = ior.estimate_id
    LEFT JOIN LATERAL (
      SELECT e2.status, e2.meta
      FROM estimates e2
      WHERE e2.company_id = pq.company_id
        AND (
          (li_inspection.id IS NOT NULL AND e2.inspection_id = li_inspection.id)
          OR (pq.estimate_id IS NOT NULL AND e2.id = pq.estimate_id)
          OR (ior.estimate_id IS NOT NULL AND e2.id = ior.estimate_id)
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(e2.meta->'customerEstimateApproval'->>'status', '')) = 'approved' THEN 0
          WHEN LOWER(COALESCE(e2.status, '')) = 'approved' THEN 1
          ELSE 2
        END,
        e2.updated_at DESC
      LIMIT 1
    ) est_from_inspection ON TRUE
    LEFT JOIN vendors v ON v.id = pq.vendor_id
    LEFT JOIN cars car ON car.id = COALESCE(est.car_id, est_from_request.car_id, li_inspection.car_id)
    LEFT JOIN LATERAL (
      SELECT im.grn_number
      FROM inventory_movements im
      WHERE im.direction = 'in'
        AND im.source_type = 'receipt'
        AND im.grn_number IS NOT NULL
        AND (
          (pq.inventory_request_item_id IS NOT NULL AND im.source_id = pq.inventory_request_item_id)
          OR (pq.estimate_item_id IS NOT NULL AND im.source_id = pq.estimate_item_id)
          OR (pq.line_item_id IS NOT NULL AND im.source_id = pq.line_item_id)
        )
      ORDER BY im.created_at DESC
      LIMIT 1
    ) direct_grn ON TRUE
    WHERE pq.company_id = ${companyId}
      ${statusFilter}
    ORDER BY pq.updated_at DESC
  `;

  const data = rows.map((row: any) => ({
    id: row.id,
    status: row.status,
    vendorName: row.vendor_name,
    partName: row.part_name,
    estimateItemStatus: row.item_status,
    carId: row.car_id,
    carMake: row.car_make,
    carModel: row.car_model,
    carPlate: row.car_plate,
    carVin: row.car_vin,
    requestNumber: row.request_number ?? null,
    sourceType: row.inventory_request_item_id ? "inventory" : "line_item",
    inventoryRequestItemId: row.inventory_request_item_id ?? null,
    estimateItemId: row.estimate_item_id ?? null,
    lineItemId: row.line_item_id ?? null,
    vendorId: row.vendor_id ?? null,
    grnNumber: row.direct_grn_number ?? null,
    oem: row.oem != null ? Number(row.oem) : null,
    oe: row.oe != null ? Number(row.oe) : null,
    aftm: row.aftm != null ? Number(row.aftm) : null,
    used: row.used != null ? Number(row.used) : null,
    oemQty: row.oem_qty != null ? Number(row.oem_qty) : null,
    oeQty: row.oe_qty != null ? Number(row.oe_qty) : null,
    aftmQty: row.aftm_qty != null ? Number(row.aftm_qty) : null,
    usedQty: row.used_qty != null ? Number(row.used_qty) : null,
    oemEtd: row.oem_etd,
    oeEtd: row.oe_etd,
    aftmEtd: row.aftm_etd,
    usedEtd: row.used_etd,
    remarks: row.remarks,
    partNumber: row.part_number ?? null,
    partBrand: row.part_brand ?? null,
    oemBrand: row.oem_brand ?? row.part_brand ?? null,
    oeBrand: row.oe_brand ?? row.part_brand ?? null,
    aftmBrand: row.aftm_brand ?? row.part_brand ?? null,
    usedBrand: row.used_brand ?? row.part_brand ?? null,
    oemTime: row.oem_time ?? null,
    oeTime: row.oe_time ?? null,
    aftmTime: row.aftm_time ?? null,
    usedTime: row.used_time ?? null,
    deliveryNoteNo: row.delivery_note_no ?? null,
    deliveryNoteStatus: row.delivery_note_status ?? null,
    deliveryDestinationBranchId: row.delivery_note_payload?.branchId ?? null,
    estimateId: row.estimate_id ?? null,
    estimateStatus: row.estimate_status ?? row.request_estimate_status ?? null,
    customerApprovalStatus: row.customer_approval_status ?? null,
    customerApprovedAt: row.customer_approved_at ?? null,
    isCustomerApproved:
      String(row.customer_approval_status ?? "").toLowerCase() === "approved" ||
      String(row.estimate_status ?? "").toLowerCase() === "approved" ||
      String(row.request_estimate_status ?? "").toLowerCase() === "approved" ||
      String(row.inspection_estimate_status ?? "").toLowerCase() === "approved",
    aiSuggestedType: row.ordered_type ?? row.delivery_note_payload?.selectedType ?? null,
    aiSuggestedUnitPrice:
      row.ordered_unit_price != null
        ? Number(row.ordered_unit_price)
        : row.delivery_note_payload?.selectedPrice != null
        ? Number(row.delivery_note_payload.selectedPrice)
        : null,
    aiSuggestionReason: row.delivery_note_payload?.reason ?? null,
    updatedAt: row.updated_at,
    approvedType: row.approved_type ?? null,
  }));

  return NextResponse.json({ data });
}
