import { NextRequest, NextResponse } from "next/server";
import { listTransfers, createTransferDraft } from "@repo/ai-core/workshop/inventory/repository";
import type { InventoryTransferStatus } from "@repo/ai-core/workshop/inventory/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as InventoryTransferStatus | null;
  try {
    const data = await listTransfers(companyId, { status: status ?? undefined });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("inventory/transfers error", err);
    return NextResponse.json({ data: [], error: "transfers_unavailable" });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.fromLocationId || !body.toLocationId || !Array.isArray(body.items)) {
    return new NextResponse("fromLocationId, toLocationId, items required", { status: 400 });
  }
  const result = await createTransferDraft(companyId, body.fromLocationId, body.toLocationId, body.items, null);
  return NextResponse.json({ data: result }, { status: 201 });
}
