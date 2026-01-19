import { NextRequest, NextResponse } from "next/server";
import {
  listPurchaseOrders,
  createPoFromVendorQuote,
  createManualPo,
} from "@repo/ai-core/workshop/procurement/repository";
import type { PurchaseOrderStatus, PurchaseOrderType } from "@repo/ai-core/workshop/procurement/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as PurchaseOrderStatus | null;
  const vendorId = searchParams.get("vendorId");
  const data = await listPurchaseOrders(companyId, {
    status: status ?? undefined,
    vendorId: vendorId ?? undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.mode === "fromQuote") {
    if (!body.quoteId) return new NextResponse("quoteId required", { status: 400 });
    const res = await createPoFromVendorQuote(companyId, body.quoteId, (body.poType as PurchaseOrderType) ?? "po");
    return NextResponse.json({ data: res }, { status: 201 });
  }
  // manual
  const res = await createManualPo({
    companyId,
    poType: (body.poType as PurchaseOrderType) ?? "po",
    vendorId: body.vendorId ?? null,
    vendorName: body.vendorName ?? null,
    vendorContact: body.vendorContact ?? null,
    currency: body.currency ?? null,
    items: Array.isArray(body.items) ? body.items : [],
  });
  return NextResponse.json({ data: res }, { status: 201 });
}
