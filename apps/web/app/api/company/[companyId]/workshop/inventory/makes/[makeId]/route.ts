import { NextRequest, NextResponse } from "next/server";
import {
  updateInventoryMake,
  deleteInventoryMake,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; makeId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, makeId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventoryMake(companyId, makeId, {
    name: body?.name,
    code: body?.code,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, makeId } = await params;
  await deleteInventoryMake(companyId, makeId);
  return NextResponse.json({ ok: true });
}
