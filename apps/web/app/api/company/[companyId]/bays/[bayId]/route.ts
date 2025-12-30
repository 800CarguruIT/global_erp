import { NextRequest, NextResponse } from "next/server";
import { Bays } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; bayId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, bayId } = await params;
  const bay = await Bays.getBay(companyId, bayId);
  if (!bay) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ data: bay });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, bayId } = await params;
  const body = await req.json().catch(() => ({}));

  const bay = await Bays.updateBay(companyId, bayId, {
    branchId: body.branchId,
    code: body.code,
    name: body.name,
    bayType: body.bayType,
    capacityCars: body.capacityCars,
    status: body.status,
    isActive: body.isActive,
    notes: body.notes,
  });

  return NextResponse.json({ data: bay });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, bayId } = await params;
  try {
    // Soft-delete: mark inactive
    await Bays.updateBay(companyId, bayId, { isActive: false, status: "blocked" as any });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /bays error", err);
    return new NextResponse("Failed to delete bay", { status: 500 });
  }
}
