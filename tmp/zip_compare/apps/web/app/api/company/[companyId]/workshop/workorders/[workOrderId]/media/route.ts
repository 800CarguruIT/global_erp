import { NextRequest, NextResponse } from "next/server";
import { WorkshopWorkOrders } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string; workOrderId: string }> };

// Attach media (new/old part photos, completion video)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, workOrderId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.kind || !body.fileRef) {
      return NextResponse.json(
        { error: "kind and fileRef are required" },
        { status: 400 },
      );
    }
    await WorkshopWorkOrders.attachMediaToWorkOrderItem({
      companyId,
      workOrderId,
      workOrderItemId: body.workOrderItemId ?? null,
      kind: body.kind,
      fileRef: body.fileRef,
      note: body.note ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST work order media failed", err);
    return NextResponse.json(
      { error: "Failed to attach media" },
      { status: 500 },
    );
  }
}
