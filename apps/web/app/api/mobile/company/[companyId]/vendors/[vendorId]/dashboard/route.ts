import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

type VendorBid = {
  id: string;
  partName: string | null;
  carMake: string | null;
  carModel: string | null;
  carPlate: string | null;
  carVin: string | null;
  oem: number | null;
  oe: number | null;
  aftm: number | null;
  used: number | null;
  oemQty: number | null;
  oeQty: number | null;
  aftmQty: number | null;
  usedQty: number | null;
  oemEtd: string | null;
  oeEtd: string | null;
  aftmEtd: string | null;
  usedEtd: string | null;
  remarks: string | null;
  status: string | null;
  updatedAt: string | null;
};

const mapBidRow = (row: any): VendorBid => ({
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
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, vendorId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const limitValue = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitValue)
      ? Math.max(20, Math.min(500, limitValue))
      : 100;

    const [inquiryRows, bidRows] = await Promise.all([
      sql`
        WITH line_inquiries AS (
          SELECT
            li.inspection_id AS inquiry_id,
            'estimate'::text AS source_type,
            MAX(li.updated_at) AS updated_at,
            i.lead_id::text AS lead_key,
            i.car_id::text AS car_key,
            car.make AS car_make,
            car.model AS car_model,
            car.plate_number AS car_plate,
            car.vin AS car_vin,
            NULL::text AS request_number
          FROM line_items li
          INNER JOIN inspections i ON i.id = li.inspection_id
          LEFT JOIN cars car ON car.id = i.car_id
          WHERE li.company_id = ${companyId}
            AND LOWER(COALESCE(li.status, '')) IN ('inquiry', 'pending')
          GROUP BY li.inspection_id, i.lead_id, i.car_id, car.make, car.model, car.plate_number, car.vin
        ),
        deduped_line_inquiries AS (
          SELECT *
          FROM (
            SELECT
              li.*,
              ROW_NUMBER() OVER (
                PARTITION BY COALESCE(li.lead_key, li.car_key, li.inquiry_id::text)
                ORDER BY li.updated_at DESC
              ) AS rn
            FROM line_inquiries li
          ) ranked
          WHERE ranked.rn = 1
        )
        SELECT
          dli.inquiry_id,
          dli.source_type,
          dli.updated_at,
          dli.car_make,
          dli.car_model,
          dli.car_plate,
          dli.car_vin,
          dli.request_number
        FROM deduped_line_inquiries dli
        ORDER BY dli.updated_at DESC
        LIMIT ${limit}
      `,
      sql`
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
        LEFT JOIN cars car ON car.id = li_inspection.car_id
        WHERE pq.company_id = ${companyId}
          AND pq.vendor_id = ${vendorId}
        ORDER BY pq.updated_at DESC
        LIMIT ${limit}
      `,
    ]);

    const inquiries = inquiryRows.map((row: any) => ({
      inquiryId: row.inquiry_id,
      sourceType: row.source_type,
      requestNumber: row.request_number ?? null,
      updatedAt: row.updated_at,
      carMake: row.car_make,
      carModel: row.car_model,
      carPlate: row.car_plate,
      carVin: row.car_vin,
    }));
    const bids: VendorBid[] = bidRows.map(mapBidRow);

    const byStatus = (needle: string[]) =>
      bids.filter((bid: VendorBid) =>
        needle.includes(String(bid.status ?? "").trim().toLowerCase()),
      );

    const orders = byStatus(["ordered", "approved"]);
    const completed = byStatus(["received", "completed"]);
    const returns = byStatus(["return", "returned"]);

    return createMobileSuccessResponse({
      summary: {
        inquiries: inquiries.length,
        bids: bids.length,
        newOrders: orders.length,
        completed: completed.length,
        returns: returns.length,
      },
      inquiries,
      bids,
      orders,
      completed,
      returns,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/vendors/[vendorId]/dashboard error:",
      error,
    );
    return handleMobileError(error);
  }
}
