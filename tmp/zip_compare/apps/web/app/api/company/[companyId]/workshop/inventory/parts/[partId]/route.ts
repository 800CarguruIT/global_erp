import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  updateInventoryPart,
  deleteInventoryPart,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; partId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, partId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventoryPart(companyId, partId, {
    name: body?.name,
    partType: body?.partType,
    partNumber: body?.partNumber,
    partCode: body?.partCode,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, partId } = await params;
  await deleteInventoryPart(companyId, partId);
  return NextResponse.json({ ok: true });
}
