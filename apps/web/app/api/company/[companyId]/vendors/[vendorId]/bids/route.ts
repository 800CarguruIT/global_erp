import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, vendorId } = await params;
  if (!companyId || !vendorId) {
    return NextResponse.json({ error: "companyId and vendorId are required" }, { status: 400 });
  }

  const sql = getSql();
  const statusParam = req.nextUrl.searchParams.get("status")?.trim() ?? "";
  const statusFilter = (() => {
    if (!statusParam) return sql``;
    const normalized = statusParam.toLowerCase();
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
      pq.status,
      COALESCE(li.product_name, iori.part_name) AS part_name,
      car.make AS car_make,
      car.model AS car_model,
      car.plate_number AS car_plate,
      car.vin AS car_vin
    FROM part_quotes pq
    LEFT JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
    LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
    LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
    LEFT JOIN cars car ON car.id = li_inspection.car_id
    WHERE pq.company_id = ${companyId}
      AND pq.vendor_id = ${vendorId}
      ${statusFilter}
    ORDER BY pq.updated_at DESC
  `;

  const data = rows.map((row: any) => ({
    id: row.id,
    partName: row.part_name,
    carMake: row.car_make,
    carModel: row.car_model,
    carPlate: row.car_plate,
    carVin: row.car_vin,
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
    status: row.status,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({ data });
}
