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

  const current = await getPurchaseOrderWithItems(companyId, poId);
  if (!current) return new NextResponse("Not found", { status: 404 });

  const isDraft = String(current.po.status ?? "").toLowerCase() === "draft";
  if (Array.isArray(body.items) && isDraft) {
    await replacePurchaseOrderItems(companyId, poId, body.items);
  }

  const requestedStatus = body.status as PurchaseOrderStatus | undefined;
  if (requestedStatus === "received") {
    const latest = await getPurchaseOrderWithItems(companyId, poId);
    const items = latest?.items ?? [];
    const allItemsReceived =
      items.length > 0 && items.every((item) => String(item.status ?? "").toLowerCase() === "received");
    if (!allItemsReceived) {
      return NextResponse.json(
        { error: "Cannot mark PO as received until all line items are fully received." },
        { status: 400 }
      );
    }
  }

  // Handle delivery details update
  const hasDeliveryFields = body.deliveryBranchId || body.deliveryAddress || body.deliveryContact || body.deliveryPhone || body.deliveryNotes;
  if (hasDeliveryFields) {
    const sql = (await import("@repo/ai-core/db")).getSql();
    await sql`
      UPDATE purchase_orders SET
        delivery_branch_id = COALESCE(${body.deliveryBranchId ?? null}, delivery_branch_id),
        delivery_address = COALESCE(${body.deliveryAddress ?? null}, delivery_address),
        delivery_contact = COALESCE(${body.deliveryContact ?? null}, delivery_contact),
        delivery_phone = COALESCE(${body.deliveryPhone ?? null}, delivery_phone),
        delivery_notes = COALESCE(${body.deliveryNotes ?? null}, delivery_notes),
        delivery_set_at = COALESCE(delivery_set_at, now()),
        updated_at = now()
      WHERE id = ${poId} AND company_id = ${companyId}
    `;
  }

  await updatePurchaseOrderHeader(companyId, poId, {
    status: requestedStatus,
    expectedDate: body.expectedDate ?? null,
    notes: body.notes ?? null,
    poType: body.poType as PurchaseOrderType | undefined,
    vendorName: body.vendorName ?? null,
    vendorContact: body.vendorContact ?? null,
  });

  const refreshed = await getPurchaseOrderWithItems(companyId, poId);
  return NextResponse.json({ data: refreshed });
}
