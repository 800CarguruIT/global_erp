import { NextRequest, NextResponse } from "next/server";
import {
  getPurchaseOrderWithItems,
  updatePurchaseOrderHeader,
  replacePurchaseOrderItems,
} from "@repo/ai-core/workshop/procurement/repository";
import type { PurchaseOrderStatus, PurchaseOrderType } from "@repo/ai-core/workshop/procurement/types";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;
  const data = await getPurchaseOrderWithItems(companyId, poId);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;
  const body = await req.json().catch(() => ({}));

  await updatePurchaseOrderHeader(companyId, poId, {
    status: body.status as PurchaseOrderStatus | undefined,
    expectedDate: body.expectedDate ?? null,
    notes: body.notes ?? null,
    poType: body.poType as PurchaseOrderType | undefined,
    vendorName: body.vendorName ?? null,
    vendorContact: body.vendorContact ?? null,
  });

  if (Array.isArray(body.items)) {
    await replacePurchaseOrderItems(companyId, poId, body.items);
  }

  const refreshed = await getPurchaseOrderWithItems(companyId, poId);
  return NextResponse.json({ data: refreshed });
}
