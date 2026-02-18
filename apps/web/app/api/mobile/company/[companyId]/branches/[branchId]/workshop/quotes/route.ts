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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const quoteType = searchParams.get("quoteType");

    const quotes = await sql`
      SELECT
        id,
        company_id,
        estimate_id,
        lead_id,
        branch_id,
        quote_type,
        status,
        currency,
        total_amount,
        eta_preset,
        eta_hours,
        remarks,
        meta,
        created_at,
        updated_at
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND branch_id = ${branchId}
        ${status ? sql`AND status = ${status}` : sql``}
        ${quoteType ? sql`AND quote_type = ${quoteType}` : sql``}
      ORDER BY updated_at DESC
    `;

    return createMobileSuccessResponse({ quotes });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/quotes error:",
      error,
    );
    return handleMobileError(error);
  }
}

