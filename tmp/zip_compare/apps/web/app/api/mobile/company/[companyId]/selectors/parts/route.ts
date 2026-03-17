import { NextRequest } from "next/server";
import { listPartsRequirementsForCompany } from "@repo/ai-core/workshop/parts/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "../../../../utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const data = await listPartsRequirementsForCompany(companyId);
    return createMobileSuccessResponse({ parts: data });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/selectors/parts error:", error);
    return handleMobileError(error);
  }
}
