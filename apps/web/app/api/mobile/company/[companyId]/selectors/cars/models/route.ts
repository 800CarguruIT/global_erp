import { NextRequest } from "next/server";
import { listInventoryModels } from "@repo/ai-core/workshop/inventory-taxonomy/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "../../../../../utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const makeId = searchParams.get("makeId") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const models = await listInventoryModels(companyId, {
      makeId,
      includeInactive,
    });

    return createMobileSuccessResponse({ models });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/selectors/cars/models error:",
      error
    );
    return handleMobileError(error);
  }
}
