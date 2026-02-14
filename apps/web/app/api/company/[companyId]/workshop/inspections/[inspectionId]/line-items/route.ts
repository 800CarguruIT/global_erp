import { NextRequest, NextResponse } from "next/server";
import {
  createInspectionLineItem,
  getInspectionById,
  listInspectionLineItems,
  markApprovedLineItemsOrdered,
  markLineItemsOrderedByNames,
} from "@repo/ai-core/workshop/inspections/repository";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { inspectionId } = await params;
  const source = _req.nextUrl.searchParams.get("source") as "inspection" | "estimate" | null;
  const items = await listInspectionLineItems(inspectionId, source ? { source } : undefined);
  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest, { params }: Params) {
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
  const created = await createInspectionLineItem({
    companyId,
    inspectionId,
    leadId: body.leadId ?? null,
    source: body.source ?? "inspection",
    productId: body.productId ?? null,
    productName: body.productName ?? null,
    description: body.description ?? null,
    quantity: body.quantity ?? 1,
    reason: body.reason ?? null,
    status: body.status ?? "Pending",
    mediaFileId: body.mediaFileId ?? null,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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
