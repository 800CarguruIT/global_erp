import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryMakes,
  createInventoryMake,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const subcategoryId = req.nextUrl.searchParams.get("subcategoryId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventoryMakes(companyId, { subcategoryId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const subcategoryId = String(body?.subcategoryId ?? "").trim();
  if (!name || !code || !subcategoryId) {
    return NextResponse.json({ error: "name_code_subcategory_required" }, { status: 400 });
  }
  const created = await createInventoryMake(companyId, {
    subcategoryId,
    name,
    code,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
