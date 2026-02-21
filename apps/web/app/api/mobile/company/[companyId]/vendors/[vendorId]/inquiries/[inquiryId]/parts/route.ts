import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; vendorId: string; inquiryId: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, vendorId, inquiryId } = await params;
    await ensureCompanyAccess(userId, companyId);

    if (!companyId || !vendorId || !inquiryId) {
      return createMobileErrorResponse(
        "companyId, vendorId and inquiryId are required",
        400,
      );
    }

    const source = req.nextUrl.searchParams.get("source") ?? "estimate";
    const sql = getSql();

    if (source === "inventory") {
      const rows = await sql`
        SELECT
          iori.id,
          iori.part_name,
          iori.description,
          iori.quantity,
          iori.part_type,
          EXISTS(
            SELECT 1
            FROM part_quotes pq
            WHERE pq.company_id = ${companyId}
              AND pq.vendor_id = ${vendorId}
              AND pq.inventory_request_item_id = iori.id
          ) AS is_submitted
        FROM inventory_order_request_items iori
        WHERE iori.request_id = ${inquiryId}
          AND iori.status = 'inquiry'
        ORDER BY iori.line_no ASC
      `;

      const parts = rows.map((row: any) => ({
        id: row.id,
        partName: row.part_name,
        description: row.description ?? null,
        quantity: Number(row.quantity ?? 0),
        partType: row.part_type ?? null,
        itemSource: "inventory_request_item",
        isSubmitted: Boolean(row.is_submitted),
      }));

      return createMobileSuccessResponse({ parts });
    }

    const rows = await sql`
      SELECT
        li.id,
        li.product_name AS part_name,
        li.description,
        li.quantity,
        NULL::text AS part_type,
        EXISTS(
          SELECT 1
          FROM part_quotes pq
          WHERE pq.company_id = ${companyId}
            AND pq.vendor_id = ${vendorId}
            AND pq.line_item_id = li.id
        ) AS is_submitted
      FROM line_items li
      WHERE li.inspection_id = ${inquiryId}
        AND li.company_id = ${companyId}
        AND LOWER(COALESCE(li.status, '')) IN ('inquiry', 'pending')
      ORDER BY li.product_name ASC
    `;

    const parts = rows.map((row: any) => ({
      id: row.id,
      partName: row.part_name,
      description: row.description ?? null,
      quantity: Number(row.quantity ?? 0),
      partType: row.part_type ?? null,
      itemSource: "line_item",
      isSubmitted: Boolean(row.is_submitted),
    }));

    return createMobileSuccessResponse({ parts });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/vendors/[vendorId]/inquiries/[inquiryId]/parts error:",
      error,
    );
    return handleMobileError(error);
  }
}

