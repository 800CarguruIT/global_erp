import { NextRequest, NextResponse } from "next/server";
import { listLocations, createLocation, updateLocation } from "@repo/ai-core/workshop/inventory/repository";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const branchId = req.nextUrl.searchParams.get("branchId") || undefined;
  try {
    const data = await listLocations(companyId, { branchId });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("inventory/locations error", err);
    return NextResponse.json({ data: [], error: "locations_unavailable" });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const loc = await createLocation(companyId, {
    code: body.code,
    name: body.name,
    locationType: body.locationType,
    branchId: body.branchId ?? null,
    fleetVehicleId: body.fleetVehicleId ?? null,
  });
  return NextResponse.json({ data: loc }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return new NextResponse("id required", { status: 400 });
  await updateLocation(companyId, body.id, body);
  return NextResponse.json({ ok: true });
}
