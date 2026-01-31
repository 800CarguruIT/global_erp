import { NextRequest, NextResponse } from "next/server";
import {
  approveInventoryOrderRequest,
  updateInventoryOrderRequest,
  deleteInventoryOrderRequest,
} from "@repo/ai-core/workshop/inventory-requests/repository";

type Params = { params: Promise<{ companyId: string; requestId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, requestId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = (body.action ?? body.status ?? "").toString().toLowerCase();
  if (action === "approve" || action === "approved") {
    try {
      const data = await approveInventoryOrderRequest(companyId, requestId, body.approvedBy ?? null);
      return NextResponse.json({ data });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message ?? "Unable to approve" }, { status: 400 });
    }
  }
  // default: update request (only allowed for pending)
  try {
    const data = await updateInventoryOrderRequest(
      companyId,
      requestId,
      {
        requestType: body.requestType ?? undefined,
        estimateId: body.estimateId ?? undefined,
        notes: body.notes ?? undefined,
        status: body.status ?? undefined,
      },
      Array.isArray(body.items) ? body.items : undefined
    );
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unable to update" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { companyId, requestId } = await params;
  try {
    await deleteInventoryOrderRequest(companyId, requestId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unable to delete" }, { status: 400 });
  }
}
