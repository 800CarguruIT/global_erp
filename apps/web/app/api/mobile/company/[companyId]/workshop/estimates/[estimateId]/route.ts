import { NextRequest } from "next/server";
import {
  getEstimateWithItems,
  updateEstimateHeader,
} from "@repo/ai-core/workshop/estimates/repository";
import type { EstimateStatus } from "@repo/ai-core/workshop/estimates/types";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; estimateId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, estimateId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const data = await getEstimateWithItems(companyId, estimateId);
    if (!data) {
      return createMobileErrorResponse("Estimate not found", 404);
    }

    return createMobileSuccessResponse({
      estimate: data.estimate,
      items: data.items,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/workshop/estimates/[estimateId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, estimateId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    await updateEstimateHeader(companyId, estimateId, {
      status: body?.status as EstimateStatus | undefined,
      vatRate:
        body?.vatRate !== undefined && body?.vatRate !== null
          ? Number(body.vatRate)
          : undefined,
      totalDiscount:
        body?.totalDiscount !== undefined && body?.totalDiscount !== null
          ? Number(body.totalDiscount)
          : undefined,
      currency:
        body?.currency !== undefined
          ? body?.currency === null
            ? null
            : String(body.currency)
          : undefined,
      meta: body?.meta,
    });

    const updated = await getEstimateWithItems(companyId, estimateId);
    if (!updated) {
      return createMobileErrorResponse("Estimate not found", 404);
    }
    return createMobileSuccessResponse({
      estimate: updated.estimate,
      items: updated.items,
    });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/workshop/estimates/[estimateId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
