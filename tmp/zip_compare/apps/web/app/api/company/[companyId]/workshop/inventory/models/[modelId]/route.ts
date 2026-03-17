import { NextRequest, NextResponse } from "next/server";
import {
import { requireAuth } from "@/lib/auth/requireAuth";

  updateInventoryModel,
  deleteInventoryModel,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string; modelId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, modelId } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateInventoryModel(companyId, modelId, {
    name: body?.name,
    code: body?.code,
    isActive: body?.isActive,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId, modelId } = await params;
  await deleteInventoryModel(companyId, modelId);
  return NextResponse.json({ ok: true });
}
