import { NextRequest, NextResponse } from "next/server";
import { movePoItemToInventory } from "@repo/ai-core/workshop/procurement/repository";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;
  const body = await req.json().catch(() => ({}));
  const itemId = String(body?.itemId ?? "").trim();
  const quantity = body?.quantity;
  const partNumber = body?.partNumber ?? null;
  const partBrand = body?.partBrand ?? null;
  const unit = body?.unit ?? null;
  const category = body?.category ?? null;
  const subcategory = body?.subcategory ?? null;
  const partType = body?.partType ?? null;
  const makeId = body?.makeId ?? null;
  const modelId = body?.modelId ?? null;
  const yearId = body?.yearId ?? null;
  if (!companyId || !poId || !itemId) {
    return new NextResponse("companyId, poId, and itemId are required", { status: 400 });
  }
  try {
    const result = await movePoItemToInventory({
      companyId,
      poId,
      itemId,
      quantity: quantity != null ? Number(quantity) : undefined,
      partNumber,
      partBrand,
      unit,
      category,
      subcategory,
      partType,
      makeId,
      modelId,
      yearId,
    });
    return NextResponse.json({ data: result });
  } catch (err: any) {
    return new NextResponse(err?.message ?? "Failed to move item to inventory", { status: 400 });
  }
}
