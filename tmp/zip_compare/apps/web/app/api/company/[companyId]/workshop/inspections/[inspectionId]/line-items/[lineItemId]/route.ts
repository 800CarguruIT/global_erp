import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  deleteInspectionLineItem,
  getInspectionById,
  updateInspectionLineItem,
} from "@repo/ai-core/workshop/inspections/repository";

type Params = {
  params: Promise<{ companyId: string; inspectionId: string; lineItemId: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, inspectionId, lineItemId } = await params;
  const body = await req.json().catch(() => ({}));
  const isAdd = body.isAdd === 1 || body.isAdd === "1" || body.isAdd === true ? 1 : 0;
  const allowEstimateAdditionalEdit = isAdd === 1;
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }
  const locked =
    Boolean(inspection.verifiedAt ?? (inspection as any).verified_at) ||
    String(inspection.status ?? "").toLowerCase() === "cancelled" ||
    Boolean((inspection as any).cancelled_at);
  if (locked && !allowEstimateAdditionalEdit) {
    return NextResponse.json({ error: "Inspection is locked and cannot be edited." }, { status: 400 });
  }
  const updated = await updateInspectionLineItem({
    companyId,
    lineItemId,
    patch: {
      isAdd:
        body.isAdd === undefined ? undefined : isAdd,
      productId: body.productId ?? undefined,
      productName: body.productName ?? undefined,
      partNumber: body.partNumber ?? undefined,
      catalogGroupKey: body.catalogGroupKey ?? undefined,
      clientRowKey: body.clientRowKey ?? undefined,
      description: body.description ?? undefined,
      quantity: body.quantity ?? undefined,
      reason: body.reason ?? undefined,
      status: body.status ?? undefined,
      mediaFileId: body.mediaFileId ?? undefined,
      aiQuestions: Array.isArray(body.aiQuestions) ? body.aiQuestions : undefined,
      aiAnswers: body.aiAnswers && typeof body.aiAnswers === "object" ? body.aiAnswers : undefined,
      aiRecommendation: body.aiRecommendation ?? undefined,
    },
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, inspectionId, lineItemId } = await params;
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
  }
  const locked =
    Boolean(inspection.verifiedAt ?? (inspection as any).verified_at) ||
    String(inspection.status ?? "").toLowerCase() === "cancelled" ||
    Boolean((inspection as any).cancelled_at);
  if (locked) {
    return NextResponse.json({ error: "Inspection is locked and cannot be edited." }, { status: 400 });
  }

  await deleteInspectionLineItem(companyId, lineItemId);
  return NextResponse.json({ ok: true });
}
