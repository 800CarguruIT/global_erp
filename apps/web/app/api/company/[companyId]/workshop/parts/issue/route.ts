import { NextRequest, NextResponse } from "next/server";
import { issuePartsForEstimateItem } from "@repo/ai-core/workshop/parts/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.estimateItemId || !body.quantity) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  await issuePartsForEstimateItem(companyId, body.estimateItemId, {
    quantity: Number(body.quantity),
    locationCode: body.locationCode ?? "MAIN",
  });

  return NextResponse.json({ ok: true });
}
