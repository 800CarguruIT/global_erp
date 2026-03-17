import { NextRequest } from "next/server";
import { Branches } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; branchId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId } = await params;
    if (!companyId || !branchId) {
      return createMobileErrorResponse("companyId and branchId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const branch = await Branches.getBranchWithDetails(companyId, branchId);
    if (!branch) {
      return createMobileErrorResponse("Branch not found", 404);
    }

    return createMobileSuccessResponse({ branch });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/branches/[branchId] error:", error);
    return handleMobileError(error);
  }
}

