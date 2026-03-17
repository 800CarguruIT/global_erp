import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  createInspectionLineItem,
  getInspectionById,
  listInspectionLineItems,
  markApprovedLineItemsOrdered,
  markLineItemsOrderedByNames,
} from "@repo/ai-core/workshop/inspections/repository";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { inspectionId } = await params;
  const source = _req.nextUrl.searchParams.get("source") as "inspection" | "estimate" | null;
  const rawIsAdd = _req.nextUrl.searchParams.get("isAdd");
  const isAdd = rawIsAdd === null ? undefined : rawIsAdd === "1" ? 1 : 0;
  const items = await listInspectionLineItems(
    inspectionId,
    source || isAdd !== undefined ? { ...(source ? { source } : {}), ...(isAdd !== undefined ? { isAdd } : {}) } : undefined
  );
  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));
  const isAdd = body.isAdd === 1 || body.isAdd === "1" || body.isAdd === true ? 1 : 0;
  const allowEstimateAdditionalEdit = (body.source ?? "inspection") === "estimate" && isAdd === 1;
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
  const created = await createInspectionLineItem({
    companyId,
    inspectionId,
    leadId: body.leadId ?? null,
    source: body.source ?? "inspection",
    isAdd,
    productId: body.productId ?? null,
    productName: body.productName ?? null,
    partNumber: body.partNumber ?? null,
    catalogGroupKey: body.catalogGroupKey ?? null,
    clientRowKey: body.clientRowKey ?? null,
    description: body.description ?? null,
    quantity: body.quantity ?? 1,
    reason: body.reason ?? null,
    status: body.status ?? "Pending",
    mediaFileId: body.mediaFileId ?? null,
    aiQuestions: Array.isArray(body.aiQuestions) ? body.aiQuestions : [],
    aiAnswers: body.aiAnswers && typeof body.aiAnswers === "object" ? body.aiAnswers : {},
    aiRecommendation: body.aiRecommendation ?? null,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, inspectionId } = await params;
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

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "order_approved") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  const approvedNames = Array.isArray(body?.approvedNames) ? body.approvedNames : [];
  const updated = approvedNames.length
    ? await markLineItemsOrderedByNames(inspectionId, approvedNames)
    : await markApprovedLineItemsOrdered(inspectionId);
  return NextResponse.json({ data: { updated } });
}
