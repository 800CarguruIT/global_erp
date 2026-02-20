import { NextRequest } from "next/server";
import { Leads } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; customerId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const data = await Leads.listLeadsForCustomer(companyId, customerId);
    return createMobileSuccessResponse({ leads: data });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/customers/[customerId]/leads error:", error);
    return handleMobileError(error);
  }
}
