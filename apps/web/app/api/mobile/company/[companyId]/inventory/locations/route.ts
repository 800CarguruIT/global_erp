import { NextRequest } from "next/server";
import { listLocations } from "@repo/ai-core/workshop/inventory/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") ?? undefined;
    const includeInactive =
      searchParams.get("includeInactive") === "true" ||
      searchParams.get("includeInactive") === "1";

    const locations = await listLocations(companyId, {
      branchId,
      includeInactive,
    });

    return createMobileSuccessResponse({ locations });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/inventory/locations error:",
      error,
    );
    return handleMobileError(error);
  }
}
