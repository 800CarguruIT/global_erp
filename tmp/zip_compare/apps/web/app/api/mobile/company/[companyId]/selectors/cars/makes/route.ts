import { NextRequest } from "next/server";
import { listInventoryMakes } from "@repo/ai-core/workshop/inventory-taxonomy/repository";
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
    const subcategoryId = searchParams.get("subcategoryId") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";

    const makes = await listInventoryMakes(companyId, {
      subcategoryId,
      includeInactive,
    });

    return createMobileSuccessResponse({ makes });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/selectors/cars/makes error:",
      error
    );
    return handleMobileError(error);
  }
}
