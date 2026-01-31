import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryModels,
  createInventoryModel,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const makeId = req.nextUrl.searchParams.get("makeId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventoryModels(companyId, { makeId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const makeId = String(body?.makeId ?? "").trim();
  if (!name || !code || !makeId) {
    return NextResponse.json({ error: "name_code_make_required" }, { status: 400 });
  }
  const created = await createInventoryModel(companyId, {
    makeId,
    name,
    code,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
