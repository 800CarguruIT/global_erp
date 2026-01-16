import { NextRequest, NextResponse } from "next/server";
import {
  deleteInspectionLineItem,
  updateInspectionLineItem,
} from "@repo/ai-core/workshop/inspections/repository";

type Params = {
  params: Promise<{ companyId: string; inspectionId: string; lineItemId: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, lineItemId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInspectionLineItem({
    companyId,
    lineItemId,
    patch: {
      productId: body.productId ?? undefined,
      productName: body.productName ?? undefined,
      description: body.description ?? undefined,
      quantity: body.quantity ?? undefined,
      reason: body.reason ?? undefined,
      status: body.status ?? undefined,
      mediaFileId: body.mediaFileId ?? undefined,
    },
  });
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { companyId, lineItemId } = await params;
  await deleteInspectionLineItem(companyId, lineItemId);
  return NextResponse.json({ ok: true });
}
