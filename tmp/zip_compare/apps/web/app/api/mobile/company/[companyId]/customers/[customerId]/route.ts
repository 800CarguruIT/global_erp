import { NextRequest } from "next/server";
import { Crm } from "@repo/ai-core";
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

    const customer = await Crm.getCustomerWithCars(customerId);
    if (!customer) {
      return createMobileErrorResponse("Customer not found", 404);
    }
    if (customer.company_id !== companyId) {
      return createMobileErrorResponse("Forbidden", 403);
    }

    const walletSummary = await Crm.getCustomerWalletSummary(companyId, customerId);

    return createMobileSuccessResponse({ customer, walletSummary });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/customers/[customerId] error:", error);
    return handleMobileError(error);
  }
}
