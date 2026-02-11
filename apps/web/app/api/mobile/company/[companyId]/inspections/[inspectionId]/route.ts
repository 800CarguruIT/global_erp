import { NextRequest } from "next/server";
import { Crm } from "@repo/ai-core";
import { getLeadById, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import {
  getInspectionById,
  listInspectionLineItems,
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
    if (!inspection) {
      return createMobileErrorResponse("Not found", 404);
    }

    const [items, lineItems, customer, car, lead] = await Promise.all([
      listInspectionItems(inspectionId),
      listInspectionLineItems(inspectionId, { source: "inspection" }),
      inspection.customerId ? Crm.getCustomerWithCars(inspection.customerId) : Promise.resolve(null),
      inspection.carId ? Crm.getCarWithCustomers(inspection.carId) : Promise.resolve(null),
      inspection.leadId ? getLeadById(companyId, inspection.leadId) : Promise.resolve(null),
    ]);

    return createMobileSuccessResponse({
      inspection,
      items,
      lineItems,
      customer:
        customer && (customer as any).company_id === companyId
          ? customer
          : null,
      car:
        car && (car as any).company_id === companyId
          ? car
          : null,
      lead,
      carInVideoId: lead?.carInVideo ?? null,
    });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/inspections/[inspectionId] error:", error);
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
    if (!inspection) {
      return createMobileErrorResponse("Not found", 404);
    }

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

    const hasInspectionPatch = Object.values(patch).some((value) => value !== undefined);
    if (hasInspectionPatch) {
      await updateInspectionPartial(companyId, inspectionId, patch);
    }
  
    if (Array.isArray(body.items)) {
      const items: InspectionItem[] = body.items;
      await replaceInspectionItems(
        inspectionId,
        items.map((i, index) => ({
          inspectionId,
          lineNo: (i as any).lineNo ?? index + 1,
          category: i.category ?? null,
          partName: i.partName,
          severity: i.severity ?? null,
          requiredAction: i.requiredAction ?? null,
          techReason: i.techReason ?? null,
          laymanReason: i.laymanReason ?? null,
          photoRefs: i.photoRefs ?? null,
        }))
      );
    }

    const leadPatch = {
      carInVideo: body.carInVideo ?? body.carin_video,
      carOutVideo: body.carOutVideo ?? body.carout_video,
    };
    const hasLeadPatch = Object.values(leadPatch).some((value) => value !== undefined);
    if (hasLeadPatch) {
      const leadId = inspection.leadId ?? body.leadId ?? null;
      if (!leadId) {
        return createMobileErrorResponse("leadId not found for inspection", 400);
      }
      await updateLeadPartial(companyId, leadId, leadPatch);
    }
  
    return createMobileSuccessResponse({ ok: true });
  } catch (error) {
    console.error("PATCH /api/mobile/company/[companyId]/inspections/[inspectionId] error:", error);
    return handleMobileError(error);
  }
}
