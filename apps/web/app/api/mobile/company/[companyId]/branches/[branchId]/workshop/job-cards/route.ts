import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const estimateId = searchParams.get("estimateId");
    const includeAll =
      searchParams.get("all") === "1" || searchParams.get("all") === "true";

    const sql = getSql();
    const branchRows = await sql`
      SELECT id
      FROM branches
      WHERE id = ${branchId} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!branchRows[0]) {
      return createMobileErrorResponse("Branch not found", 404);
    }

    if (!estimateId) {
      const rows = await sql`
        SELECT
          jc.*,
          e.inspection_id,
          l.branch_id,
          COALESCE(b.display_name, b.name, b.code) AS branch_name,
          c.name AS customer_name,
          c.phone AS customer_phone,
          car.plate_number,
          car.make,
          car.model
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = jc.lead_id
        LEFT JOIN branches b ON b.id = l.branch_id
        LEFT JOIN inspections i ON i.id = e.inspection_id
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN cars car ON car.id = i.car_id
        WHERE e.company_id = ${companyId}
          AND l.branch_id = ${branchId}
        ORDER BY jc.created_at DESC
      `;

      return createMobileSuccessResponse({ jobCards: rows });
    }

    if (includeAll) {
      const rows = await sql`
        SELECT jc.*
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = jc.lead_id
        WHERE jc.estimate_id = ${estimateId}
          AND e.company_id = ${companyId}
          AND l.branch_id = ${branchId}
        ORDER BY jc.created_at DESC
      `;

      return createMobileSuccessResponse({ jobCards: rows });
    }

    const rows = await sql`
      SELECT jc.*
      FROM job_cards jc
      LEFT JOIN estimates e ON e.id = jc.estimate_id
      LEFT JOIN leads l ON l.id = jc.lead_id
      WHERE jc.estimate_id = ${estimateId}
        AND e.company_id = ${companyId}
        AND l.branch_id = ${branchId}
        AND jc.status IN ('Pending', 'Re-Assigned')
      LIMIT 1
    `;

    return createMobileSuccessResponse({ jobCard: rows[0] ?? null });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/job-cards error:",
      error,
    );
    return handleMobileError(error);
  }
}

