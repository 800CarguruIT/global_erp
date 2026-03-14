import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { resolveRsaAccess, rsaErrorFromUnknown, rsaSuccess } from "../../utils";

function toLimit(value: string | null, fallback = 150): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

function buildStatusFilter(sql: any, statusParam: string | null) {
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
    return sql`AND LOWER(COALESCE(pq.status, '')) IN ('received', 'completed')`;
  }
  if (normalized === "returns") {
    return sql`AND LOWER(COALESCE(pq.status, '')) IN ('return', 'returned')`;
  }
  return sql`AND LOWER(COALESCE(pq.status, '')) = ${normalized}`;
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await resolveRsaAccess(req);
    const sql = getSql();
    const status = req.nextUrl.searchParams.get("status")?.trim() || null;
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || null;
    const limit = toLimit(req.nextUrl.searchParams.get("limit"), 150);
    const statusFilter = buildStatusFilter(sql, status);

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
        COALESCE(li.product_name, iori.part_name) AS part_name,
        LOWER(COALESCE(li.status, iori.status)) AS item_status,
        li.approved_type,
        car.make AS car_make,
        car.model AS car_model,
        car.plate_number AS car_plate,
        ior.request_number
      FROM part_quotes pq
      LEFT JOIN line_items li ON li.id = pq.line_item_id
      LEFT JOIN estimates est ON est.id = pq.estimate_id
      LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
      LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
      LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
      LEFT JOIN vendors v ON v.id = pq.vendor_id
      LEFT JOIN cars car ON car.id = COALESCE(est.car_id, li_inspection.car_id)
      LEFT JOIN leads lead_ref
        ON lead_ref.id = COALESCE(est.lead_id, li_inspection.lead_id)
        AND lead_ref.company_id = pq.company_id
      WHERE pq.company_id = ${companyId}
        AND LOWER(COALESCE(lead_ref.lead_type, '')) = 'rsa'
        ${statusFilter}
        AND (
          ${q}::text IS NULL
          OR LOWER(
            CONCAT_WS(
              ' ',
              COALESCE(v.name, ''),
              COALESCE(li.product_name, iori.part_name, ''),
              COALESCE(car.plate_number, ''),
              COALESCE(car.make, ''),
              COALESCE(car.model, ''),
              COALESCE(pq.status, '')
            )
          ) LIKE ${`%${q ?? ""}%`}
        )
      ORDER BY pq.updated_at DESC
      LIMIT ${limit}
    `;

    return rsaSuccess({
      rows: rows.map((row: any) => ({
        id: row.id,
        status: row.status ?? null,
        vendorName: row.vendor_name ?? null,
        partName: row.part_name ?? null,
        estimateItemStatus: row.item_status ?? null,
        carMake: row.car_make ?? null,
        carModel: row.car_model ?? null,
        carPlate: row.car_plate ?? null,
        requestNumber: row.request_number ?? null,
        sourceType: row.inventory_request_item_id ? "inventory" : "line_item",
        inventoryRequestItemId: row.inventory_request_item_id ?? null,
        estimateItemId: row.estimate_item_id ?? null,
        lineItemId: row.line_item_id ?? null,
        oem: row.oem != null ? Number(row.oem) : null,
        oe: row.oe != null ? Number(row.oe) : null,
        aftm: row.aftm != null ? Number(row.aftm) : null,
        used: row.used != null ? Number(row.used) : null,
        oemQty: row.oem_qty != null ? Number(row.oem_qty) : null,
        oeQty: row.oe_qty != null ? Number(row.oe_qty) : null,
        aftmQty: row.aftm_qty != null ? Number(row.aftm_qty) : null,
        usedQty: row.used_qty != null ? Number(row.used_qty) : null,
        oemEtd: row.oem_etd ?? null,
        oeEtd: row.oe_etd ?? null,
        aftmEtd: row.aftm_etd ?? null,
        usedEtd: row.used_etd ?? null,
        remarks: row.remarks ?? null,
        updatedAt: row.updated_at ?? null,
        approvedType: row.approved_type ?? null,
      })),
    });
  } catch (error) {
    return rsaErrorFromUnknown(error);
  }
}
