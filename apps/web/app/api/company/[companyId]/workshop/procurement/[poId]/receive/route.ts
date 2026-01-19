import { NextRequest, NextResponse } from "next/server";
import { receivePoItems, getPurchaseOrderWithItems } from "@repo/ai-core/workshop/procurement/repository";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.items)) {
    return new NextResponse("items required", { status: 400 });
  }
  const result = await receivePoItems(
    companyId,
    poId,
    body.items.map((i: any) => ({ itemId: i.itemId, quantity: i.quantity ?? 0 }))
  );
  return NextResponse.json({ data: result });
}
