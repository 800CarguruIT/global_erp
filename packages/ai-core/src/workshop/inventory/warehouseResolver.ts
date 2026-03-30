import { getSql } from "../../db";

export interface WarehouseLocation {
  id: string;
  code: string;
  name: string;
  locationType: string;
}

/**
 * Resolve the main warehouse location for a company.
 * Priority:
 * 1. companies.main_warehouse_location_id (configured)
 * 2. First active warehouse location with no branch_id (central warehouse)
 * 3. First active location of any type (fallback)
 *
 * Returns null if no location exists at all.
 */
export async function resolveMainWarehouse(companyId: string): Promise<WarehouseLocation | null> {
  const sql = getSql();

  // 1. Check configured main warehouse
  const [company] = await sql<{ main_warehouse_location_id: string | null }[]>`
    SELECT main_warehouse_location_id FROM companies WHERE id = ${companyId}
  `;
  if (company?.main_warehouse_location_id) {
    const [loc] = await sql<any[]>`
      SELECT id, code, name, location_type FROM inventory_locations
      WHERE id = ${company.main_warehouse_location_id} AND is_active = TRUE
    `;
    if (loc) {
      return { id: loc.id, code: loc.code, name: loc.name, locationType: loc.location_type };
    }
  }

  // 2. Find central warehouse (no branch)
  const [centralWarehouse] = await sql<any[]>`
    SELECT id, code, name, location_type FROM inventory_locations
    WHERE company_id = ${companyId}
      AND location_type = 'warehouse'
      AND branch_id IS NULL
      AND is_active = TRUE
    ORDER BY created_at ASC LIMIT 1
  `;
  if (centralWarehouse) {
    return { id: centralWarehouse.id, code: centralWarehouse.code, name: centralWarehouse.name, locationType: centralWarehouse.location_type };
  }

  // 3. Fallback: any active location
  const [anyLoc] = await sql<any[]>`
    SELECT id, code, name, location_type FROM inventory_locations
    WHERE company_id = ${companyId} AND is_active = TRUE
    ORDER BY created_at ASC LIMIT 1
  `;
  if (anyLoc) {
    return { id: anyLoc.id, code: anyLoc.code, name: anyLoc.name, locationType: anyLoc.location_type };
  }

  return null;
}

/**
 * Resolve the inventory location for a specific branch.
 * Returns null if the branch has no configured location.
 */
export async function resolveBranchLocation(companyId: string, branchId: string): Promise<WarehouseLocation | null> {
  const sql = getSql();
  const [loc] = await sql<any[]>`
    SELECT id, code, name, location_type FROM inventory_locations
    WHERE company_id = ${companyId}
      AND branch_id = ${branchId}
      AND is_active = TRUE
    ORDER BY created_at ASC LIMIT 1
  `;
  if (!loc) return null;
  return { id: loc.id, code: loc.code, name: loc.name, locationType: loc.location_type };
}
