import { NextRequest, NextResponse } from "next/server";
import {
  getTransferWithItems,
  updateTransferDraft,
  startTransfer,
  completeTransfer,
} from "@repo/ai-core/workshop/inventory/repository";
import type { InventoryTransferStatus } from "@repo/ai-core/workshop/inventory/types";

type Params = { params: Promise<{ companyId: string; transferId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, transferId } = await params;
  const data = await getTransferWithItems(companyId, transferId);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, transferId } = await params;
  const body = await req.json().catch(() => ({}));
  const existing = await getTransferWithItems(companyId, transferId);
  if (!existing) return new NextResponse("Not found", { status: 404 });

  if (body.items || body.notes) {
    await updateTransferDraft(companyId, transferId, { notes: body.notes, items: body.items });
  }

  if (body.start === true) {
    await startTransfer(companyId, transferId, null);
  }

  if (body.complete === true) {
    await completeTransfer(companyId, transferId, null);
  }

  if (body.status) {
    await updateTransferDraft(companyId, transferId, {});
    await startTransfer(companyId, transferId, null);
    await completeTransfer(companyId, transferId, null);
  }

  const refreshed = await getTransferWithItems(companyId, transferId);
  return NextResponse.json({ data: refreshed });
}
