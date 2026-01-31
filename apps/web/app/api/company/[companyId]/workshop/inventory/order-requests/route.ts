import { NextRequest, NextResponse } from "next/server";
import {
  createInventoryOrderRequest,
  listInventoryOrderRequests,
} from "@repo/ai-core/workshop/inventory-requests/repository";
import type {
  InventoryOrderRequestStatus,
  InventoryOrderRequestType,
} from "@repo/ai-core/workshop/inventory-requests/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const status = req.nextUrl.searchParams.get("status") as InventoryOrderRequestStatus | null;
  const requestType = req.nextUrl.searchParams.get("type") as InventoryOrderRequestType | null;
  const data = await listInventoryOrderRequests(companyId, {
    status: status ?? undefined,
    requestType: requestType ?? undefined,
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const requestType = (body.requestType as InventoryOrderRequestType) ?? "inventory";
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return NextResponse.json({ error: "items_required" }, { status: 400 });
  }
  if (requestType === "job" && !body.estimateId) {
    return NextResponse.json({ error: "estimate_required" }, { status: 400 });
  }
  const res = await createInventoryOrderRequest({
    companyId,
    requestType,
    estimateId: body.estimateId ?? null,
    notes: body.notes ?? null,
    createdBy: body.createdBy ?? null,
    items,
  });
  return NextResponse.json({ data: res }, { status: 201 });
}
