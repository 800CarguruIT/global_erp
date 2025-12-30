import { NextRequest, NextResponse } from "next/server";
import {
  getInspectionById,
  listInspectionItems,
  replaceInspectionItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionItem } from "@repo/ai-core/workshop/inspections/types";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return new NextResponse("Not found", { status: 404 });
  }
  const items = await listInspectionItems(inspectionId);
  return NextResponse.json({ data: { inspection, items } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));

  const patch = {
    status: body.status,
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
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
