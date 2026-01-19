import { getSql } from "../../db";
import { createLocation, listLocations } from "../../workshop/inventory/repository";
import type { FleetBranchSummary, FleetStatus, FleetVehicle, FleetVehicleType } from "./types";

function mapFleet(row: any): FleetVehicle {
  return {
    id: row.id,
    companyId: row.company_id,
    branchId: row.branch_id,
    code: row.code,
    name: row.name,
    vehicleType: row.vehicle_type,
    plateNumber: row.plate_number,
    make: row.make,
    model: row.model,
    modelYear: row.model_year,
    capacityJobs: Number(row.capacity_jobs),
    status: row.status,
    isActive: row.is_active,
    inventoryLocationId: row.inventory_location_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listFleetByCompany(
  companyId: string,
  filters: { branchId?: string; status?: FleetStatus | "any"; vehicleType?: FleetVehicleType | "any" } = {}
): Promise<FleetVehicle[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM fleet_vehicles
    WHERE company_id = ${companyId}
    ${filters.branchId ? sql`AND branch_id = ${filters.branchId}` : sql``}
    ${filters.status && filters.status !== "any" ? sql`AND status = ${filters.status}` : sql``}
    ${filters.vehicleType && filters.vehicleType !== "any" ? sql`AND vehicle_type = ${filters.vehicleType}` : sql``}
    ORDER BY created_at DESC
  `;
  return rows.map(mapFleet);
}

export async function getFleetVehicle(companyId: string, id: string): Promise<FleetVehicle | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM fleet_vehicles
    WHERE company_id = ${companyId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapFleet(rows[0]) : null;
}

export async function createFleetVehicle(
  companyId: string,
  input: Partial<FleetVehicle> & { branchId: string; code: string; name: string; vehicleType: FleetVehicleType }
): Promise<FleetVehicle> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO fleet_vehicles (
      company_id,
      branch_id,
      code,
      name,
      vehicle_type,
      plate_number,
      make,
      model,
      model_year,
      capacity_jobs,
      status,
      is_active,
      inventory_location_id,
      notes
    )
    VALUES (
      ${companyId},
      ${input.branchId},
      ${input.code},
      ${input.name},
      ${input.vehicleType},
      ${input.plateNumber ?? null},
      ${input.make ?? null},
      ${input.model ?? null},
      ${input.modelYear ?? null},
      ${input.capacityJobs ?? 1},
      ${input.status ?? ("available" as FleetStatus)},
      ${input.isActive ?? true},
      ${input.inventoryLocationId ?? null},
      ${input.notes ?? null}
    )
    RETURNING *
  `;
  const created = mapFleet(rows[0]);

  // Create inventory location for this vehicle if not already set
  const ensured = await ensureFleetLocation(companyId, created);
  if (ensured.inventoryLocationId !== created.inventoryLocationId) {
    const updated = await sql`
      UPDATE fleet_vehicles SET inventory_location_id = ${ensured.inventoryLocationId}
      WHERE company_id = ${companyId} AND id = ${created.id}
      RETURNING *
    `;
    return mapFleet(updated[0]);
  }

  return created;
}

export async function updateFleetVehicle(
  companyId: string,
  id: string,
  patch: Partial<FleetVehicle>
): Promise<FleetVehicle> {
  const sql = getSql();
  const updated = {
    branch_id: patch.branchId,
    code: patch.code,
    name: patch.name,
    vehicle_type: patch.vehicleType,
    plate_number: patch.plateNumber,
    make: patch.make,
    model: patch.model,
    model_year: patch.modelYear,
    capacity_jobs: patch.capacityJobs,
    status: patch.status,
    is_active: patch.isActive,
    inventory_location_id: patch.inventoryLocationId,
    notes: patch.notes,
  };
  const rows = await sql`
    UPDATE fleet_vehicles
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${id}
    RETURNING *
  `;
  if (!rows[0]) {
    throw new Error("Fleet vehicle not found");
  }
  const updatedFleet = mapFleet(rows[0]);

  // Ensure location exists / is linked
  const ensured = await ensureFleetLocation(companyId, updatedFleet);
  if (ensured.inventoryLocationId !== updatedFleet.inventoryLocationId) {
    const linked = await sql`
      UPDATE fleet_vehicles SET inventory_location_id = ${ensured.inventoryLocationId}
      WHERE company_id = ${companyId} AND id = ${updatedFleet.id}
      RETURNING *
    `;
    return mapFleet(linked[0]);
  }

  return updatedFleet;
}

async function ensureFleetLocation(companyId: string, vehicle: FleetVehicle): Promise<FleetVehicle> {
  // If already linked, nothing to do
  if (vehicle.inventoryLocationId) return vehicle;

  // See if a location already exists for this vehicle
  const existing = (await listLocations(companyId)).find(
    (l) => l.fleetVehicleId === vehicle.id || l.fleet_vehicle_id === (vehicle as any).fleet_vehicle_id
  );
  if (existing) {
    return { ...vehicle, inventoryLocationId: existing.id };
  }

  // Create a unique code to avoid conflicts
  const baseCode = vehicle.code || vehicle.plateNumber || `VEH-${vehicle.id.slice(0, 6)}`;
  let attempt = 0;
  let lastError: unknown;
  while (attempt < 3) {
    try {
      const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
      const loc = await createLocation(companyId, {
        code,
        name: vehicle.name || code,
        locationType: "fleet_vehicle" as any,
        branchId: vehicle.branchId,
        fleetVehicleId: vehicle.id,
      });
      return { ...vehicle, inventoryLocationId: loc.id };
    } catch (err) {
      lastError = err;
      attempt += 1;
    }
  }
  // If all attempts fail, return original (best-effort)
  // eslint-disable-next-line no-console
  console.error("Failed to ensure fleet inventory location", lastError);
  return vehicle;
}

export async function summarizeFleetByBranch(companyId: string): Promise<FleetBranchSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT branch_id, status, COUNT(*) as count
    FROM fleet_vehicles
    WHERE company_id = ${companyId}
    GROUP BY branch_id, status
  `;
  const summaryMap = new Map<string, FleetBranchSummary>();
  for (const row of rows) {
    const branchId = row.branch_id as string;
    const status = row.status as FleetStatus;
    const count = Number(row.count);
    if (!summaryMap.has(branchId)) {
      summaryMap.set(branchId, {
        branchId,
        total: 0,
        available: 0,
        onJob: 0,
        maintenance: 0,
        outOfService: 0,
      });
    }
    const current = summaryMap.get(branchId)!;
    current.total += count;
    if (status === "available") current.available += count;
    else if (status === "on_job") current.onJob += count;
    else if (status === "maintenance") current.maintenance += count;
    else if (status === "out_of_service") current.outOfService += count;
  }
  return Array.from(summaryMap.values());
}
