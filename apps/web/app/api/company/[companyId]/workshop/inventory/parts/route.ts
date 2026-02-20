import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryParts,
  createInventoryPart,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const yearId = req.nextUrl.searchParams.get("yearId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventoryParts(companyId, { yearId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const partNumber = String(body?.partNumber ?? "").trim();
  const partCode = String(body?.partCode ?? "").trim();
  const yearId = String(body?.yearId ?? "").trim();
  if (!name || !partNumber || !partCode || !yearId) {
    return NextResponse.json({ error: "name_partNumber_partCode_year_required" }, { status: 400 });
  }
  const created = await createInventoryPart(companyId, {
    yearId,
    name,
    partType: body?.partType ?? null,
    partNumber,
    partCode,
  });
  return NextResponse.json({ data: created }, { status: 201 });
}
