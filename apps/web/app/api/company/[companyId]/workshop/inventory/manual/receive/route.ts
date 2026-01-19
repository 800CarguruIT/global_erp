import { NextRequest, NextResponse } from "next/server";
import { manualReceive } from "@repo/ai-core/workshop/inventory/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.locationId || !Array.isArray(body.items)) {
    return new NextResponse("locationId and items required", { status: 400 });
  }
  try {
    const receipts = await manualReceive(companyId, body.locationId, body.items, null);
    return NextResponse.json({ data: receipts }, { status: 201 });
  } catch (err) {
    console.error("manual receive error", err);
    return NextResponse.json({ error: "receive_failed" }, { status: 500 });
  }
}
