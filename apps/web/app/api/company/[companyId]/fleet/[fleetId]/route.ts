import { NextRequest, NextResponse } from "next/server";
import { Fleet } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; fleetId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, fleetId } = await params;
  const fleet = await Fleet.getFleetVehicle(companyId, fleetId);
  if (!fleet) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ data: fleet });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, fleetId } = await params;
  const body = await req.json().catch(() => ({}));
  const fleet = await Fleet.updateFleetVehicle(companyId, fleetId, {
    branchId: body.branchId,
    code: body.code,
    name: body.name,
    vehicleType: body.vehicleType,
    plateNumber: body.plateNumber,
    make: body.make,
    model: body.model,
    modelYear: body.modelYear,
    capacityJobs: body.capacityJobs,
    status: body.status,
    isActive: body.isActive,
    inventoryLocationId: body.inventoryLocationId,
    notes: body.notes,
  });
  return NextResponse.json({ data: fleet });
}
