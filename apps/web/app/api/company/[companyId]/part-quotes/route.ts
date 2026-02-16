import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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
          AND LOWER(COALESCE(ei.status, li.status, iori.status)) IN ('approved', 'inquiry', 'pending')
          AND COALESCE(ei.status, li.status, iori.status) IS NOT NULL
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
      pq.inventory_request_item_id,
      pq.inventory_request_id,
      pq.estimate_item_id,
      pq.line_item_id,
      v.name AS vendor_name,
      COALESCE(ei.part_name, li.product_name, iori.part_name) AS part_name,
      LOWER(COALESCE(ei.status, li.status, iori.status)) AS item_status,
      ei.approved_type,
      car.id AS car_id,
      car.make AS car_make,
      car.model AS car_model,
      car.plate_number AS car_plate,
      car.vin AS car_vin,
      ior.request_number,
      v.id AS vendor_id
    FROM part_quotes pq
    LEFT JOIN estimate_items ei ON ei.id = pq.estimate_item_id
    LEFT JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN estimates est ON est.id = pq.estimate_id
    LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
    LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
    LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
    LEFT JOIN vendors v ON v.id = pq.vendor_id
    LEFT JOIN cars car ON car.id = COALESCE(est.car_id, li_inspection.car_id)
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
    sourceType: row.inventory_request_item_id ? "inventory" : "estimate",
    inventoryRequestItemId: row.inventory_request_item_id ?? null,
    estimateItemId: row.estimate_item_id ?? null,
    lineItemId: row.line_item_id ?? null,
    vendorId: row.vendor_id ?? null,
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
    updatedAt: row.updated_at,
    approvedType: row.approved_type ?? null,
  }));

  return NextResponse.json({ data });
}
