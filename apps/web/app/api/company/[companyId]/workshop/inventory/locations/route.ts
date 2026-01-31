import { NextRequest, NextResponse } from "next/server";
import {
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from "@repo/ai-core/workshop/inventory/repository";
import type { InventoryLocationType } from "@repo/ai-core/workshop/inventory/types";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const branchId = req.nextUrl.searchParams.get("branchId") || undefined;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
  try {
    const data = await listLocations(companyId, { branchId, includeInactive });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("inventory/locations error", err);
    return NextResponse.json({ data: [], error: "locations_unavailable" });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const locationType = (body.locationType as InventoryLocationType) ?? "warehouse";
  const branchId = body.branchId ? String(body.branchId) : null;
  const fleetVehicleId = body.fleetVehicleId ? String(body.fleetVehicleId) : null;
  try {
    const loc = await createLocation(companyId, {
      name,
      locationType,
      branchId,
      fleetVehicleId,
    });
    return NextResponse.json({ data: loc }, { status: 201 });
  } catch (err: any) {
    console.error("inventory/locations create error", err);
    return NextResponse.json(
      {
        error: "inventory_location_creation_failed",
        message: err?.message ?? "Unable to create inventory location",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return new NextResponse("id required", { status: 400 });
  await updateLocation(companyId, body.id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return new NextResponse("id required", { status: 400 });
  try {
    await deleteLocation(companyId, body.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "delete_failed" }, { status: 400 });
  }
}
