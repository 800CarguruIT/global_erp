import { NextRequest, NextResponse } from "next/server";
import {
  updateInventoryCategory,
  deleteInventoryCategory,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; categoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, categoryId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventoryCategory(companyId, categoryId, {
    name: body?.name,
    code: body?.code,
    description: body?.description,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, categoryId } = await params;
  await deleteInventoryCategory(companyId, categoryId);
  return NextResponse.json({ ok: true });
}
