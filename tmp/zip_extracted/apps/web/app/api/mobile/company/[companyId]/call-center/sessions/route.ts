import { NextRequest } from "next/server";
import { CallCenter } from "@repo/ai-core";
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

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit"));
    const createdByMeOnly = url.searchParams.get("createdByMeOnly") === "true";
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;

    const sessions = await CallCenter.listRecentCalls({
      scope: "company",
      companyId,
      branchId: null,
      limit,
      createdByUserId: createdByMeOnly ? userId : undefined,
    });

    return createMobileSuccessResponse({ sessions });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/call-center/sessions error:",
      error,
    );
    return handleMobileError(error);
  }
}

