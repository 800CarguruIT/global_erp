import { NextRequest, NextResponse } from "next/server";
import { Fleet } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || undefined;
  const status = (searchParams.get("status") as any) || "any";
  const vehicleType = (searchParams.get("vehicleType") as any) || "any";

  const data = await Fleet.listFleetByCompany(companyId, { branchId, status, vehicleType });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));

  const fleet = await Fleet.createFleetVehicle(companyId, {
    branchId: body.branchId,
    code: body.code,
    name: body.name,
    vehicleType: body.vehicleType,
    plateNumber: body.plateNumber ?? null,
    make: body.make ?? null,
    model: body.model ?? null,
    modelYear: body.modelYear ?? null,
    capacityJobs: body.capacityJobs ?? 1,
    status: body.status ?? "available",
    isActive: body.isActive ?? true,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ data: fleet }, { status: 201 });
}
