import { NextRequest } from "next/server";
import { Vendors } from "@repo/ai-core";
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
    const includeInactive =
      searchParams.get("includeInactive") === "1" ||
      searchParams.get("includeInactive") === "true";
    const search = searchParams.get("search")?.trim() || undefined;

    const vendors = await Vendors.listVendors(companyId, {
      search,
      activeOnly: !includeInactive,
    });

    return createMobileSuccessResponse({ vendors });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/vendors error:", error);
    return handleMobileError(error);
  }
}

