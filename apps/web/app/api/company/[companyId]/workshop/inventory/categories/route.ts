import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryCategories,
  createInventoryCategory,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const inventoryTypeId = req.nextUrl.searchParams.get("inventoryTypeId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventoryCategories(companyId, { inventoryTypeId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const inventoryTypeId = String(body?.inventoryTypeId ?? "").trim();
  if (!name || !code || !inventoryTypeId) {
    return NextResponse.json({ error: "name_code_type_required" }, { status: 400 });
  }
  const created = await createInventoryCategory(companyId, {
    inventoryTypeId,
    name,
    code,
    description: body?.description ?? null,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
