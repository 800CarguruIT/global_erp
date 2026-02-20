import { getSql } from "../../db";
import type {
  InventoryLocation,
  InventoryLocationType,
  InventoryStockRow,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryTransferStatus,
  InventoryReceiptLabel,
} from "./types";

function mapLocation(row: any): InventoryLocation {
  return {
    id: row.id,
    companyId: row.company_id,
    code: row.code,
    name: row.name,
    locationType: row.location_type,
    branchId: row.branch_id,
    fleetVehicleId: row.fleet_vehicle_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransfer(row: any): InventoryTransfer {
  return {
    id: row.id,
    companyId: row.company_id,
    transferNumber: row.transfer_number,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTransferItem(row: any): InventoryTransferItem {
  return {
    id: row.id,
    transferId: row.transfer_id,
    lineNo: row.line_no,
    partsCatalogId: row.parts_catalog_id,
    quantity: Number(row.quantity),
  };
}

const LOCATION_CODE_PREFIX: Record<InventoryLocationType, string> = {
  warehouse: "WH-M",
  branch: "WH-B",
  fleet_vehicle: "WH-F",
  other: "WH-O",
};

function formatLocationCode(prefix: string, value: number) {
  return `${prefix}-${String(value).padStart(3, "0")}`;
}

function isCentralWarehouseCandidate(input: {
  locationType: InventoryLocationType;
  branchId?: string | null;
  fleetVehicleId?: string | null;
}) {
  return input.locationType === "warehouse" && !input.branchId && !input.fleetVehicleId;
}

function parseSequenceSuffix(code: string | undefined, prefix: string) {
  if (!code) return 0;
  const normalized = code.toUpperCase();
  const expectedPrefix = `${prefix}-`;
  if (!normalized.startsWith(expectedPrefix)) return 0;
  const suffix = normalized.slice(expectedPrefix.length);
  const parsed = Number.parseInt(suffix, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function nextCodeFromExisting(companyId: string, prefix: string) {
  const sql = getSql();
  try {
    const rows = await sql/* sql */ `
      SELECT code FROM inventory_locations
      WHERE company_id = ${companyId} AND code LIKE ${prefix + "%"}
      ORDER BY code DESC
      LIMIT 1
    `;
    const lastCode = rows[0]?.code as string | undefined;
    const nextValue = parseSequenceSuffix(lastCode, prefix) + 1;
    return formatLocationCode(prefix, nextValue);
  } catch (err: any) {
    if (isMissingTable(err)) {
      return formatLocationCode(prefix, 1);
    }
    throw err;
  }
}

async function nextLocationCode(companyId: string, locationType: InventoryLocationType) {
  const sql = getSql();
  const prefix = LOCATION_CODE_PREFIX[locationType] ?? LOCATION_CODE_PREFIX.other;
  try {
    const rows = await sql/* sql */ `
      INSERT INTO inventory_location_sequences (company_id, prefix, last_number)
      VALUES (${companyId}, ${prefix}, 1)
      ON CONFLICT (company_id, prefix)
      DO UPDATE SET last_number = inventory_location_sequences.last_number + 1
      RETURNING last_number
    `;
    const lastNumber = Number(rows[0]?.last_number ?? 1);
    return formatLocationCode(prefix, lastNumber);
  } catch (err: any) {
    if (isMissingTable(err)) {
      return nextCodeFromExisting(companyId, prefix);
    }
    throw err;
  }
}

async function centralWarehouseCount(companyId: string) {
  const sql = getSql();
  try {
    const rows = await sql/* sql */ `
      SELECT COUNT(1) AS total
      FROM inventory_locations
      WHERE company_id = ${companyId}
        AND location_type = ${"warehouse"}
        AND branch_id IS NULL
        AND fleet_vehicle_id IS NULL
        AND is_active = TRUE
    `;
    return Number(rows[0]?.total ?? 0);
  } catch (err: any) {
    if (isMissingTable(err)) {
      return 0;
    }
    throw err;
  }
}

function isMissingTable(err: any) {
  return err?.code === "42P01";
}

async function ensureFleetLocationForVehicle(
  companyId: string,
  vehicle: { id: string; branch_id: string | null; code?: string | null; name?: string | null; plate_number?: string | null }
): Promise<InventoryLocation | null> {
  const sql = getSql();

  // Try to reuse any existing location (even if it was inactive)
  const existing = await sql/* sql */ `
    SELECT * FROM inventory_locations
    WHERE company_id = ${companyId} AND fleet_vehicle_id = ${vehicle.id}
    LIMIT 1
  `;
  if (existing[0]) {
    const row = existing[0];
    if (!row.is_active) {
      await sql/* sql */ `UPDATE inventory_locations SET is_active = TRUE WHERE id = ${row.id}`;
      row.is_active = true;
    }
    return mapLocation(row);
  }

  const fallbackName =
    vehicle.name || vehicle.plate_number || `Fleet vehicle ${String(vehicle.id).slice(0, 6)}`;
  try {
    const loc = await createLocation(companyId, {
      name: fallbackName,
      locationType: "fleet_vehicle",
      branchId: vehicle.branch_id,
      fleetVehicleId: vehicle.id,
    });
    return loc;
  } catch (err) {
    console.error("ensureFleetLocationForVehicle failed", vehicle.id, err);
    return null;
  }
}

export async function listLocations(companyId: string, opts: { branchId?: string | null } = {}): Promise<InventoryLocation[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_locations
    WHERE company_id = ${companyId} AND is_active = TRUE
    ${opts.branchId ? sql`AND (branch_id IS NULL OR branch_id = ${opts.branchId} OR fleet_vehicle_id IS NOT NULL)` : sql``}
    ORDER BY code
  `;
  let locations = rows.map(mapLocation);

  // Ensure fleet vehicles have locations and are included in the list (particularly for branch views)
  const fleetRows = await sql/* sql */ `
    SELECT id, branch_id, code, name, plate_number, inventory_location_id
    FROM fleet_vehicles
    WHERE company_id = ${companyId}
    ${opts.branchId ? sql`AND branch_id = ${opts.branchId}` : sql``}
      AND is_active = TRUE
  `;
  if (fleetRows.length) {
    const existingFleetIds = new Set(locations.map((l) => l.fleetVehicleId).filter(Boolean) as string[]);
    for (const vehicle of fleetRows) {
      if (existingFleetIds.has(vehicle.id)) continue;
      const ensured = await ensureFleetLocationForVehicle(companyId, vehicle);
      if (ensured) {
        locations.push(ensured);
        if (!vehicle.inventory_location_id) {
          await sql/* sql */ `
            UPDATE fleet_vehicles
            SET inventory_location_id = ${ensured.id}
            WHERE company_id = ${companyId} AND id = ${vehicle.id}
          `;
        }
      }
    }
  }

  return locations.sort((a, b) => a.code.localeCompare(b.code));
}

export async function createLocation(
  companyId: string,
  input: {
    code?: string | null;
    name: string;
    locationType: InventoryLocationType;
    branchId?: string | null;
    fleetVehicleId?: string | null;
  }
): Promise<InventoryLocation> {
  const sql = getSql();
  const centralCount = await centralWarehouseCount(companyId);
  const isCentral = isCentralWarehouseCandidate(input);
  if (!centralCount && !isCentral) {
    throw new Error("Create the central warehouse before adding branches, fleets, or other locations.");
  }

  const branchId = input.branchId ?? null;
  const fleetVehicleId = input.fleetVehicleId ?? null;
  let manualCode = input.code?.trim() ?? undefined;
  if (manualCode) manualCode = manualCode.toUpperCase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = manualCode ?? (await nextLocationCode(companyId, input.locationType));
    try {
      const rows = await sql/* sql */ `
        INSERT INTO inventory_locations (
          company_id,
          code,
          name,
          location_type,
          branch_id,
          fleet_vehicle_id
        ) VALUES (
          ${companyId},
          ${code},
          ${input.name.trim()},
          ${input.locationType},
          ${branchId},
          ${fleetVehicleId}
        )
        RETURNING *
      `;
      return mapLocation(rows[0]);
    } catch (err: any) {
      if (err?.code === "23505") {
        manualCode = undefined;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unable to assign a unique location code, please retry.");
}

export async function updateLocation(
  companyId: string,
  locationId: string,
  patch: Partial<Omit<InventoryLocation, "id" | "companyId" | "createdAt" | "updatedAt">>
): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    UPDATE inventory_locations
    SET ${sql({
      code: patch.code,
      name: patch.name,
      location_type: patch.locationType,
      branch_id: patch.branchId,
      fleet_vehicle_id: patch.fleetVehicleId,
      is_active: patch.isActive,
    })}
    WHERE company_id = ${companyId} AND id = ${locationId}
  `;
}

export async function listStock(
  companyId: string,
  opts: { locationId?: string | null; search?: string | null } = {}
): Promise<InventoryStockRow[]> {
  const sql = getSql();
  const conditions = [sql`pc.company_id = ${companyId}`];
  if (opts.locationId) {
    conditions.push(sql`loc.id = ${opts.locationId}`);
  }
  if (opts.search) {
    const q = `%${opts.search}%`;
    conditions.push(sql`(pc.part_number ILIKE ${q} OR pc.sku ILIKE ${q} OR pc.description ILIKE ${q})`);
  }
  const where = conditions.reduce((prev, curr, idx) => (idx === 0 ? curr : sql`${prev} AND ${curr}`));

  try {
    const rows = await sql/* sql */ `
      SELECT
        pc.id AS part_id,
        pc.part_number,
        pc.description,
        loc.id AS location_id,
        st.location_code,
        loc.name AS location_name,
        COALESCE(st.on_hand, 0) AS on_hand
      FROM parts_catalog pc
      LEFT JOIN inventory_stock st ON st.part_id = pc.id AND st.company_id = pc.company_id
      LEFT JOIN inventory_locations loc ON loc.company_id = pc.company_id AND loc.code = st.location_code
      WHERE ${where}
      ORDER BY pc.part_number, st.location_code
    `;

    return rows.map((row: any) => ({
      partsCatalogId: row.part_id,
      partCode: row.part_number,
      partName: row.description,
      locationId: row.location_id,
      locationCode: row.location_code,
      locationName: row.location_name,
      onHand: Number(row.on_hand ?? 0),
    }));
  } catch (err: any) {
    if (isMissingTable(err)) {
      console.warn("inventory:listStock missing tables, returning empty set", err?.message);
      return [];
    }
    throw err;
  }
}

export async function listMovements(
  companyId: string,
  opts: { partId?: string; locationId?: string; limit?: number } = {}
): Promise<any[]> {
  const sql = getSql();
  const conditions = [sql`company_id = ${companyId}`];
  if (opts.partId) conditions.push(sql`part_id = ${opts.partId}`);
  if (opts.locationId) conditions.push(sql`location_id = ${opts.locationId}`);
  const where = conditions.reduce((prev, curr, idx) => (idx === 0 ? curr : sql`${prev} AND ${curr}`));
  const limit = opts.limit ?? 100;

  const rows = await sql/* sql */ `
    SELECT * FROM inventory_movements
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

async function getLocationCode(locationId: string | null): Promise<string> {
  if (!locationId) return "MAIN";
  const sql = getSql();
  const rows = await sql/* sql */ `SELECT code FROM inventory_locations WHERE id = ${locationId} LIMIT 1`;
  if (!rows.length) return "MAIN";
  const row = rows[0];
  return (row?.code as string | undefined) ?? "MAIN";
}

export async function manualReceive(
  companyId: string,
  locationId: string,
  items: Array<{ partsCatalogId: string; quantity: number; note?: string }>,
  userId?: string | null
): Promise<InventoryReceiptLabel[]> {
  const sql = getSql();
  const locationCode = await getLocationCode(locationId);
  const receipts: InventoryReceiptLabel[] = [];

  for (const item of items) {
    const partRows =
      await sql/* sql */ `SELECT id, part_number, description, qr_code FROM parts_catalog WHERE id = ${item.partsCatalogId} LIMIT 1`;
    if (!partRows.length) throw new Error("Part not found for receive");
    const part = partRows[0];
    let qrCode: string = part.qr_code;
    if (!qrCode) {
      qrCode = `QR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await sql/* sql */ `
        UPDATE parts_catalog
        SET qr_code = ${qrCode}
        WHERE id = ${part.id}
      `;
    }

    const grnNumber = `GRN-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    await sql/* sql */ `
      INSERT INTO inventory_movements (
        company_id,
        part_id,
        location_id,
        location_code,
        direction,
        quantity,
        source_type,
        source_id,
        grn_number,
        note,
        created_by
      ) VALUES (
        ${companyId},
        ${item.partsCatalogId},
        ${locationId},
        ${locationCode},
        ${"in"},
        ${item.quantity},
        ${"manual_receive"},
        ${null},
        ${grnNumber},
        ${item.note ?? null},
        ${userId ?? null}
      )
    `;

    receipts.push({
      grnNumber,
      qrCode,
      partCode: part.part_number,
      partName: part.description,
      locationCode,
      quantity: item.quantity,
    });
  }

  return receipts;
}

export async function manualIssue(
  companyId: string,
  locationId: string,
  items: Array<{ partsCatalogId: string; quantity: number; note?: string }>,
  userId?: string | null
): Promise<void> {
  const sql = getSql();
  const locationCode = await getLocationCode(locationId);
  for (const item of items) {
    await sql/* sql */ `
      INSERT INTO inventory_movements (
        company_id,
        part_id,
        location_id,
        location_code,
        direction,
        quantity,
        source_type,
        source_id,
        note,
        created_by
      ) VALUES (
        ${companyId},
        ${item.partsCatalogId},
        ${locationId},
        ${locationCode},
        ${"out"},
        ${item.quantity},
        ${"manual_issue"},
        ${null},
        ${item.note ?? null},
        ${userId ?? null}
      )
    `;
  }
}

async function nextTransferNumber(companyId: string): Promise<string> {
  const sql = getSql();
  const year = new Date().getFullYear();
  const prefix = `TR-${year}-`;
  const rows = await sql/* sql */ `
    SELECT transfer_number
    FROM inventory_transfer_orders
    WHERE company_id = ${companyId} AND transfer_number LIKE ${prefix + "%"}
    ORDER BY transfer_number DESC
    LIMIT 1
  `;
  if (!rows.length) return `${prefix}0001`;
  const lastRow = rows[0];
  const last = (lastRow?.transfer_number as string | undefined) ?? "";
  const num = last ? parseInt(last.replace(prefix, "")) || 0 : 0;
  return `${prefix}${(num + 1).toString().padStart(4, "0")}`;
}

export async function createTransferDraft(
  companyId: string,
  fromLocationId: string,
  toLocationId: string,
  items: Array<{ partsCatalogId: string; quantity: number }>,
  userId?: string | null
): Promise<{ transfer: InventoryTransfer; items: InventoryTransferItem[] }> {
  const sql = getSql();
  const transferNumber = await nextTransferNumber(companyId);
  const rows = await sql/* sql */ `
    INSERT INTO inventory_transfer_orders (
      company_id,
      from_location_id,
      to_location_id,
      status,
      transfer_number,
      created_by
    ) VALUES (
      ${companyId},
      ${fromLocationId},
      ${toLocationId},
      ${"draft" as InventoryTransferStatus},
      ${transferNumber},
      ${userId ?? null}
    )
    RETURNING *
  `;
  const transfer = mapTransfer(rows[0]);

  for (const [idx, item] of items.entries()) {
    await sql/* sql */ `
      INSERT INTO inventory_transfer_items (
        transfer_id,
        line_no,
        parts_catalog_id,
        quantity
      ) VALUES (
        ${transfer.id},
        ${idx + 1},
        ${item.partsCatalogId},
        ${item.quantity}
      )
    `;
  }

  const transferItems = await getTransferItems(transfer.id);
  return { transfer, items: transferItems };
}

export async function listTransfers(
  companyId: string,
  opts: { status?: InventoryTransferStatus } = {}
): Promise<InventoryTransfer[]> {
  const sql = getSql();
  const where = opts.status
    ? sql`company_id = ${companyId} AND status = ${opts.status}`
    : sql`company_id = ${companyId}`;
  try {
    const rows = await sql/* sql */ `
      SELECT * FROM inventory_transfer_orders
      WHERE ${where}
      ORDER BY created_at DESC
    `;
    return rows.map(mapTransfer);
  } catch (err: any) {
    if (isMissingTable(err)) {
      console.warn("inventory:listTransfers missing tables, returning empty set", err?.message);
      return [];
    }
    throw err;
  }
}

export async function getTransferWithItems(
  companyId: string,
  transferId: string
): Promise<{ transfer: InventoryTransfer; items: InventoryTransferItem[] } | null> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM inventory_transfer_orders WHERE company_id = ${companyId} AND id = ${transferId} LIMIT 1`;
  if (!rows.length) return null;
  const transfer = mapTransfer(rows[0]);
  const items = await getTransferItems(transferId);
  return { transfer, items };
}

async function getTransferItems(transferId: string): Promise<InventoryTransferItem[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_transfer_items
    WHERE transfer_id = ${transferId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapTransferItem);
}

export async function updateTransferDraft(
  companyId: string,
  transferId: string,
  patch: { notes?: string | null; items?: Array<{ id?: string; partsCatalogId: string; quantity: number }> }
): Promise<void> {
  const sql = getSql();
  if (patch.notes !== undefined) {
    await sql/* sql */ `
      UPDATE inventory_transfer_orders
      SET notes = ${patch.notes}
      WHERE company_id = ${companyId} AND id = ${transferId}
    `;
  }

  if (patch.items) {
    await sql/* sql */ `DELETE FROM inventory_transfer_items WHERE transfer_id = ${transferId}`;
    for (const [idx, item] of patch.items.entries()) {
      await sql/* sql */ `
        INSERT INTO inventory_transfer_items (
          transfer_id,
          line_no,
          parts_catalog_id,
          quantity
        ) VALUES (
          ${transferId},
          ${idx + 1},
          ${item.partsCatalogId},
          ${item.quantity}
        )
      `;
    }
  }
}

export async function startTransfer(
  companyId: string,
  transferId: string,
  userId?: string | null
): Promise<void> {
  const sql = getSql();
  const data = await getTransferWithItems(companyId, transferId);
  if (!data) throw new Error("Transfer not found");

  const fromCode = await getLocationCode(data.transfer.fromLocationId);

  for (const item of data.items) {
    await sql/* sql */ `
      INSERT INTO inventory_movements (
        company_id,
        part_id,
        location_id,
        location_code,
        direction,
        quantity,
        source_type,
        source_id,
        transfer_id,
        created_by
      ) VALUES (
        ${companyId},
        ${item.partsCatalogId},
        ${data.transfer.fromLocationId},
        ${fromCode},
        ${"out"},
        ${item.quantity},
        ${"transfer"},
        ${transferId},
        ${transferId},
        ${userId ?? null}
      )
    `;
  }

  await sql/* sql */ `
    UPDATE inventory_transfer_orders
    SET status = ${"in_transit" as InventoryTransferStatus}
    WHERE id = ${transferId}
  `;
}

export async function completeTransfer(
  companyId: string,
  transferId: string,
  userId?: string | null
): Promise<void> {
  const sql = getSql();
  const data = await getTransferWithItems(companyId, transferId);
  if (!data) throw new Error("Transfer not found");

  const toCode = await getLocationCode(data.transfer.toLocationId);

  for (const item of data.items) {
    await sql/* sql */ `
      INSERT INTO inventory_movements (
        company_id,
        part_id,
        location_id,
        location_code,
        direction,
        quantity,
        source_type,
        source_id,
        transfer_id,
        created_by
      ) VALUES (
        ${companyId},
        ${item.partsCatalogId},
        ${data.transfer.toLocationId},
        ${toCode},
        ${"in"},
        ${item.quantity},
        ${"transfer"},
        ${transferId},
        ${transferId},
        ${userId ?? null}
      )
    `;
  }

  await sql/* sql */ `
    UPDATE inventory_transfer_orders
    SET status = ${"completed" as InventoryTransferStatus},
        completed_by = ${userId ?? null},
        completed_at = now()
    WHERE id = ${transferId}
  `;
}
