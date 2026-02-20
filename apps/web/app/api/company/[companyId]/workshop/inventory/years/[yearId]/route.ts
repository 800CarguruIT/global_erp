import { NextRequest, NextResponse } from "next/server";
import {
  updateInventoryYear,
  deleteInventoryYear,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; yearId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, yearId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventoryYear(companyId, yearId, {
    year: body?.year != null ? Number(body.year) : undefined,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, yearId } = await params;
  await deleteInventoryYear(companyId, yearId);
  return NextResponse.json({ ok: true });
}
