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
  params: Promise<{ companyId: string; requestId: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const payload = await req.json().catch(() => ({}));
    const cost = Number(payload?.cost);
    const sale = Number(payload?.sale);

    if (!Number.isFinite(cost) || cost < 0) {
      return createMobileErrorResponse("Invalid cost", 400);
    }
    if (!Number.isFinite(sale) || sale < 0) {
      return createMobileErrorResponse("Invalid sale", 400);
    }

    const sql = getSql();
    const rows = await sql`
      UPDATE recovery_requests rr
      SET
        verification_cost = ${cost},
        verification_sale = ${sale},
        verified_at = now(),
        updated_at = now()
      FROM leads l
      WHERE rr.id = ${requestId}
        AND rr.lead_id = l.id
        AND l.company_id = ${companyId}
      RETURNING rr.id
    `;

    if (!rows?.[0]) {
      return createMobileErrorResponse("Recovery request not found", 404);
    }
    return createMobileSuccessResponse({ id: rows[0].id });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/recovery-requests/[requestId]/verify error:",
      error,
    );
    return handleMobileError(error);
  }
}
