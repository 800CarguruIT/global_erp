import { NextRequest, NextResponse } from "next/server";
import {
  listInventoryTypes,
  createInventoryType,
} from "@repo/ai-core/workshop/inventory-types/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  try {
    const data = await listInventoryTypes(companyId, { includeInactive });
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err?.message ?? "types_unavailable" }, { status: 200 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  if (!name || !code) {
    return NextResponse.json({ error: "name_and_code_required" }, { status: 400 });
  }
  try {
    const created = await createInventoryType(companyId, {
      name,
      code,
      description: body?.description ?? null,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "type_create_failed" }, { status: 400 });
  }
}
