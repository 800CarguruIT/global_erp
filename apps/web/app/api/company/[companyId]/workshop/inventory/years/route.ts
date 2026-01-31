import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryYears,
  createInventoryYear,
} from "@repo/ai-core/workshop/inventory-taxonomy/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const modelId = req.nextUrl.searchParams.get("modelId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  const data = await listInventoryYears(companyId, { modelId, includeInactive });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const year = Number(body?.year ?? 0);
  const modelId = String(body?.modelId ?? "").trim();
  if (!modelId || !year) {
    return NextResponse.json({ error: "model_year_required" }, { status: 400 });
  }
  const created = await createInventoryYear(companyId, { modelId, year });
  return NextResponse.json({ data: created }, { status: 201 });
}
