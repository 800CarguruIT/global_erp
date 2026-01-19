import { NextRequest, NextResponse } from "next/server";
import { getEstimateWithItems } from "@repo/ai-core/workshop/estimates/repository";

type Params = { params: Promise<{ companyId: string; vendorId: string; estimateId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, estimateId } = await params;
  if (!companyId || !estimateId) {
    return NextResponse.json({ error: "companyId and estimateId are required" }, { status: 400 });
  }

  const data = await getEstimateWithItems(companyId, estimateId);
  if (!data) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const parts = (data.items ?? [])
    .filter((item) => item.status === "inquiry")
    .map((item) => ({
      id: item.id,
      partName: item.partName,
      description: item.description ?? null,
    }));

  return NextResponse.json({ data: parts });
}
