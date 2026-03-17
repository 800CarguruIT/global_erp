import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  updateInventorySubcategory,
  deleteInventorySubcategory,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; subcategoryId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, subcategoryId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventorySubcategory(companyId, subcategoryId, {
    name: body?.name,
    code: body?.code,
    description: body?.description,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, subcategoryId } = await params;
  await deleteInventorySubcategory(companyId, subcategoryId);
  return NextResponse.json({ ok: true });
}
