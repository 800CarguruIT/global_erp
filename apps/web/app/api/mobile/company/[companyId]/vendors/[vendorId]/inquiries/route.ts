import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const rows = await sql`
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

      UNION ALL

      SELECT
        ior.id AS inquiry_id,
        'inventory' AS source_type,
        ior.updated_at,
        NULL::text AS car_make,
        NULL::text AS car_model,
        NULL::text AS car_plate,
        NULL::text AS car_vin,
        ior.request_number
      FROM inventory_order_request_items iori
      INNER JOIN inventory_order_requests ior ON ior.id = iori.request_id
      WHERE ior.company_id = ${companyId}
        AND ior.status = 'approved'
        AND iori.status = 'inquiry'

      ORDER BY updated_at DESC
    `;

    const inquiries = rows.map((row: any) => ({
      inquiryId: row.inquiry_id,
      sourceType: row.source_type,
      requestNumber: row.request_number ?? null,
      updatedAt: row.updated_at,
      carMake: row.car_make,
      carModel: row.car_model,
      carPlate: row.car_plate,
      carVin: row.car_vin,
    }));

    return createMobileSuccessResponse({ inquiries });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/vendors/[vendorId]/inquiries error:",
      error,
    );
    return handleMobileError(error);
  }
}

