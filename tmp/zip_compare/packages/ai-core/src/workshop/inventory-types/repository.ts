import { getSql } from "../../db";
import type { InventoryType } from "../inventory/types";

function mapRow(row: any): InventoryType {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    code: row.code,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listInventoryTypes(companyId: string, opts: { includeInactive?: boolean } = {}): Promise<InventoryType[]> {
  const sql = getSql();
  const where = opts.includeInactive ? sql`company_id = ${companyId}` : sql`company_id = ${companyId} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_types
    WHERE ${where}
    ORDER BY name ASC
  `;
  return rows.map(mapRow);
}

export async function createInventoryType(
  companyId: string,
  payload: { name: string; code: string; description?: string | null }
): Promise<InventoryType> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_types (
      company_id,
      name,
      code,
      description
    ) VALUES (
      ${companyId},
      ${payload.name},
      ${payload.code},
      ${payload.description ?? null}
    )
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function updateInventoryType(
  companyId: string,
  typeId: string,
  patch: Partial<{
    name: string;
    code: string;
    description: string | null;
    isActive: boolean;
  }>
): Promise<InventoryType | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      code: patch.code,
      description: patch.description,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) {
    const existing = await sql/* sql */ `
      SELECT * FROM inventory_types
      WHERE company_id = ${companyId} AND id = ${typeId}
      LIMIT 1
    `;
    return existing.length ? mapRow(existing[0]) : null;
  }
  const rows = await sql/* sql */ `
    UPDATE inventory_types
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${typeId}
    RETURNING *
  `;
  return rows.length ? mapRow(rows[0]) : null;
}

export async function deleteInventoryType(companyId: string, typeId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_types
    WHERE company_id = ${companyId} AND id = ${typeId}
  `;
}
