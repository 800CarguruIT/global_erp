import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { getCarById, getCustomerById } from "@repo/ai-core/crm/repository";
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

type Params = {
  params: Promise<{ companyId: string; branchId: string; inspectionId: string }>;
};

async function ensureInspectionInBranch(
  companyId: string,
  branchId: string,
  inspectionId: string,
) {
  const sql = getSql();
  const rows = await sql`
    SELECT i.id
    FROM inspections i
    LEFT JOIN leads l ON l.id = i.lead_id
    WHERE i.company_id = ${companyId}
      AND i.id = ${inspectionId}
      AND COALESCE(i.branch_id, l.branch_id) = ${branchId}
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inBranch = await ensureInspectionInBranch(companyId, branchId, inspectionId);
    if (!inBranch) return createMobileErrorResponse("Not found", 404);

    const inspection = await getInspectionById(companyId, inspectionId);
    if (!inspection) return createMobileErrorResponse("Not found", 404);

    const [items, customerRaw, carRaw, lead] = await Promise.all([
      listInspectionItems(inspectionId),
      inspection.customerId ? getCustomerById(inspection.customerId) : Promise.resolve(null),
      inspection.carId ? getCarById(inspection.carId) : Promise.resolve(null),
      inspection.leadId ? getLeadById(companyId, inspection.leadId) : Promise.resolve(null),
    ]);

    const customer = customerRaw && customerRaw.company_id === companyId ? customerRaw : null;
    const car = carRaw && carRaw.company_id === companyId ? carRaw : null;

    return createMobileSuccessResponse({
      inspection,
      items,
      customer,
      car,
      lead,
      carInVideoId: lead?.carInVideo ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, branchId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inBranch = await ensureInspectionInBranch(companyId, branchId, inspectionId);
    if (!inBranch) return createMobileErrorResponse("Not found", 404);

    const body = await req.json().catch(() => ({}));
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
        })),
      );
    }

    return createMobileSuccessResponse({ ok: true });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/branches/[branchId]/workshop/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
