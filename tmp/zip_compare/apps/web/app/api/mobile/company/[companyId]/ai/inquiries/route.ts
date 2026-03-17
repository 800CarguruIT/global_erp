import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

type InquiryRow = {
  id: string;
  provider_key: string;
  provider_call_id: string;
  from_number: string | null;
  to_number: string | null;
  inquiry_status: string;
  inquiry_summary: string | null;
  conversion_status: string;
  converted_to_lead_id: string | null;
  lead_outcome: string | null;
  outcome_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const rows = await sql<InquiryRow[]>`
      SELECT
        id,
        provider_key,
        provider_call_id,
        from_number,
        to_number,
        inquiry_status,
        inquiry_summary,
        conversion_status,
        converted_to_lead_id,
        lead_outcome,
        outcome_reason,
        created_at,
        updated_at
      FROM call_ai_inquiries
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 200
    `;

    return createMobileSuccessResponse({ inquiries: rows });
  } catch (error: any) {
    if (String(error?.code ?? "") === "42P01") {
      return createMobileSuccessResponse({
        inquiries: [],
        warning: "call_ai_inquiries table not found. Run migrations.",
      });
    }

    console.error(
      "GET /api/mobile/company/[companyId]/ai/inquiries error:",
      error,
    );
    return handleMobileError(error);
  }
}
