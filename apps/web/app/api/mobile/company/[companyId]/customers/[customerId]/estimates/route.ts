import { NextRequest } from "next/server";
import { WorkshopEstimates } from "@repo/ai-core";
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

    const data = await WorkshopEstimates.listEstimatesForCustomer(companyId, customerId);
    return createMobileSuccessResponse({ estimates: data });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/customers/[customerId]/estimates error:",
      error
    );
    return handleMobileError(error);
  }
}
