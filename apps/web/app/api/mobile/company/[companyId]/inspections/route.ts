import { NextRequest } from "next/server";
import {
  getInspectionById,
  listInspectionItems,
  replaceInspectionItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionItem } from "@repo/ai-core/workshop/inspections/types";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inspection = await getInspectionById(companyId, inspectionId);
    console.log("GET inspection fetch", { companyId, inspectionId, found: Boolean(inspection) });
    if (!inspection) {
      return createMobileErrorResponse("Not found", 404);
    }

    const items = await listInspectionItems(inspectionId);
    return createMobileSuccessResponse({ inspection, items });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));

    const inspection = await getInspectionById(companyId, inspectionId);
    console.log("PATCH inspection fetch", { companyId, inspectionId, found: Boolean(inspection) });
    const patch = {
      status: body.status,
      startAt: body.startAt ?? body.start_at,
      completeAt: body.completeAt ?? body.complete_at,
      healthEngine: body.healthEngine,
      healthTransmission: body.healthTransmission,
      healthBrakes: body.healthBrakes,
      healthSuspension: body.healthSuspension,
      healthElectrical: body.healthElectrical,
      overallHealth: body.overallHealth,
      customerRemark: body.customerRemark,
      agentRemark: body.agentRemark,
      inspectorRemark: body.inspectorRemark,
      inspectorRemarkLayman: body.inspectorRemarkLayman,
      aiSummaryMarkdown: body.aiSummaryMarkdown,
      aiSummaryPlain: body.aiSummaryPlain,
      draftPayload: body.draftPayload,
    };

    await updateInspectionPartial(companyId, inspectionId, patch);

    if (Array.isArray(body.items)) {
      const items: InspectionItem[] = body.items;
      await replaceInspectionItems(
        inspectionId,
        items.map((item, index) => ({
          inspectionId,
          lineNo: (item as any).lineNo ?? index + 1,
          category: item.category ?? null,
          partName: item.partName,
          severity: item.severity ?? null,
          requiredAction: item.requiredAction ?? null,
          techReason: item.techReason ?? null,
          laymanReason: item.laymanReason ?? null,
          photoRefs: item.photoRefs ?? null,
        })),
      );
    }

    return createMobileSuccessResponse({ ok: true });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
