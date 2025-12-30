import { NextRequest, NextResponse } from "next/server";
import { Bays } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || undefined;
  const status = (searchParams.get("status") as any) || "any";
  const bayType = (searchParams.get("bayType") as any) || "any";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const data = await Bays.listBaysByCompany(companyId, {
    branchId,
    status,
    bayType,
    activeOnly: !includeInactive,
  });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));

  const bay = await Bays.createBay(companyId, {
    branchId: body.branchId,
    code: body.code,
    name: body.name,
    bayType: body.bayType,
    capacityCars: body.capacityCars ?? 1,
    status: body.status ?? "available",
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ data: bay }, { status: 201 });
}
