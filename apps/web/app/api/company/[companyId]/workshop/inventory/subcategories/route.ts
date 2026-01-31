import { NextRequest, NextResponse } from "next/server";
import {
  listInventorySubcategories,
  createInventorySubcategory,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const categoryId = req.nextUrl.searchParams.get("categoryId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventorySubcategories(companyId, { categoryId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const categoryId = String(body?.categoryId ?? "").trim();
  if (!name || !code || !categoryId) {
    return NextResponse.json({ error: "name_code_category_required" }, { status: 400 });
  }
  const created = await createInventorySubcategory(companyId, {
    categoryId,
    name,
    code,
    description: body?.description ?? null,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
