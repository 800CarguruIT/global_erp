import { NextRequest, NextResponse } from "next/server";
import { listStock } from "@repo/ai-core/workshop/inventory/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const q = searchParams.get("q");
  try {
    const data = await listStock(companyId, { locationId: locationId ?? undefined, search: q ?? undefined });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("inventory/stock error", err);
    return NextResponse.json({ data: [], error: "stock_unavailable" });
  }
}
