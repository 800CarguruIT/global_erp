import { NextRequest, NextResponse } from "next/server";
import { receivePartsForEstimateItem } from "@repo/ai-core/workshop/parts/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.estimateItemId || !body.partNumber || !body.brand || !body.quantity) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  const result = await receivePartsForEstimateItem(companyId, body.estimateItemId, {
    partNumber: body.partNumber,
    brand: body.brand,
    description: body.description,
    quantity: Number(body.quantity),
    costPerUnit: body.costPerUnit != null ? Number(body.costPerUnit) : undefined,
  });

  return NextResponse.json({
    ok: true,
    grnNumber: result.grnNumber,
    part: {
      id: result.part.id,
      sku: result.part.sku,
      brand: result.part.brand,
      partNumber: result.part.partNumber,
    },
  });
}
