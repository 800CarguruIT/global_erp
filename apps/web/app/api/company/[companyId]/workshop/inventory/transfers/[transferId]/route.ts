import { NextRequest, NextResponse } from "next/server";
import {
  getTransferWithItems,
  updateTransferDraft,
  approveTransfer,
  startTransfer,
  completeTransfer,
} from "@repo/ai-core/workshop/inventory/repository";
import type { InventoryTransferStatus } from "@repo/ai-core/workshop/inventory/types";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

type Params = { params: Promise<{ companyId: string; transferId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, transferId } = await params;
  if (!companyId || !transferId || companyId === "undefined" || transferId === "undefined") {
    return new NextResponse("Invalid transfer request", { status: 400 });
  }
  const data = await getTransferWithItems(companyId, transferId);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, transferId } = await params;
  if (!companyId || !transferId || companyId === "undefined" || transferId === "undefined") {
    return new NextResponse("Invalid transfer request", { status: 400 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await getCurrentUserIdFromRequest(req);
    const existing = await getTransferWithItems(companyId, transferId);
    if (!existing) return new NextResponse("Not found", { status: 404 });

    if (body.items || body.notes) {
      await updateTransferDraft(companyId, transferId, { notes: body.notes, items: body.items });
    }

    if (body.approve === true) {
      await approveTransfer(companyId, transferId, userId);
    }

    if (body.start === true) {
      await startTransfer(companyId, transferId, userId);
    }

    if (body.complete === true) {
      await completeTransfer(companyId, transferId, userId);
    }

    if (body.status) {
      await updateTransferDraft(companyId, transferId, {});
      await startTransfer(companyId, transferId, null);
      await completeTransfer(companyId, transferId, null);
    }

    const refreshed = await getTransferWithItems(companyId, transferId);
    return NextResponse.json({ data: refreshed });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Failed to update transfer";
    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message === "Transfer must be approved before dispatch") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("PATCH /inventory/transfers error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
