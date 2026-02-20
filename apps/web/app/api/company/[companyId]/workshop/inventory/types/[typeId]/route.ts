import { NextRequest, NextResponse } from "next/server";
import {
  updateInventoryType,
  deleteInventoryType,
} from "@repo/ai-core/workshop/inventory-types/repository";

type Params = { params: Promise<{ companyId: string; typeId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, typeId } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const updated = await updateInventoryType(companyId, typeId, {
      name: body?.name,
      code: body?.code,
      description: body?.description,
      isActive: body?.isActive,
    });
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "type_update_failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, typeId } = await params;
  try {
    await deleteInventoryType(companyId, typeId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "type_delete_failed" }, { status: 400 });
  }
}
