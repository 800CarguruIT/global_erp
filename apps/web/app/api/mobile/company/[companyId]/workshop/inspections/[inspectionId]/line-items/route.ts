import { NextRequest } from "next/server";
import { listInspectionLineItems } from "@repo/ai-core/workshop/inspections/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import { createMobileSuccessResponse, handleMobileError } from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const source = req.nextUrl.searchParams.get("source") as
      | "inspection"
      | "estimate"
      | null;
    const items = await listInspectionLineItems(
      inspectionId,
      source ? { source } : undefined
    );

    return createMobileSuccessResponse({ items });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/workshop/inspections/[inspectionId]/line-items error:",
      error
    );
    return handleMobileError(error);
  }
}
