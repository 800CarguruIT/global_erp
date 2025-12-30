import { NextRequest, NextResponse } from "next/server";
import { WorkshopWorkOrders as WorkOrders } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; workOrderId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, workOrderId } = await params;
  try {
    const data = await WorkOrders.getWorkOrderWithItems(companyId, workOrderId);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET workorder failed", err);
    return NextResponse.json(
      { error: "Failed to load work order" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, workOrderId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    if (body.header) {
      await WorkOrders.updateWorkOrderHeader(companyId, workOrderId, body.header);
    }
    if (Array.isArray(body.items) && body.items.length) {
      await WorkOrders.updateWorkOrderItemsStatuses(
        companyId,
        workOrderId,
        body.items,
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH workorder failed", err);
    return NextResponse.json(
      { error: "Failed to update work order" },
      { status: 500 },
    );
  }
}
