import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getUserContext } from "@/lib/auth/user-context";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; jobCardId: string; lineItemId: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, jobCardId, lineItemId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    const partPic = body?.partPic ?? undefined;
    const scrapPic = body?.scrapPic ?? undefined;
    if (partPic === undefined && scrapPic === undefined) {
      return createMobileErrorResponse("No updates provided", 400);
    }

    const sql = getSql();
    const currentUserContext = await getUserContext(userId);
    if (currentUserContext.scope === "branch") {
      const currentUserBranchId = currentUserContext.companies[0]?.branchId ?? null;
      const jobCardRows = await sql`
        SELECT l.branch_id AS lead_branch_id
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = e.lead_id
        WHERE jc.id = ${jobCardId} AND e.company_id = ${companyId}
        LIMIT 1
      `;
      if (!jobCardRows.length) return createMobileErrorResponse("Not found", 404);
      const assignedBranchId = jobCardRows[0]?.lead_branch_id ?? null;
      if (!currentUserBranchId || !assignedBranchId || currentUserBranchId !== assignedBranchId) {
        return createMobileErrorResponse("Only assigned workshop can perform this action.", 403);
      }
    }

    const rows = await sql`
      UPDATE line_items
      SET
        part_pic = COALESCE(${partPic ?? null}, part_pic),
        scrap_pic = COALESCE(${scrapPic ?? null}, scrap_pic)
      WHERE id = ${lineItemId}
        AND job_card_id = ${jobCardId}
        AND company_id = ${companyId}
      RETURNING id, part_pic, scrap_pic
    `;
    const updated = rows[0];
    if (!updated) return createMobileErrorResponse("Not found", 404);

    return createMobileSuccessResponse({ lineItem: updated });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/workshop/job-cards/[jobCardId]/line-items/[lineItemId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
