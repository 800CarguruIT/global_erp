import { getSql } from "../../db";
import type {
  InventoryCategory,
  InventorySubcategory,
  InventoryCarMake,
  InventoryCarModel,
  InventoryModelYear,
  InventoryPart,
} from "../inventory/types";

const mapCategory = (row: any): InventoryCategory => ({
  id: row.id,
  companyId: row.company_id,
  inventoryTypeId: row.inventory_type_id,
  name: row.name,
  code: row.code,
  description: row.description,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSubcategory = (row: any): InventorySubcategory => ({
  id: row.id,
  companyId: row.company_id,
  categoryId: row.category_id,
  name: row.name,
  code: row.code,
  description: row.description,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapMake = (row: any): InventoryCarMake => ({
  id: row.id,
  companyId: row.company_id,
  subcategoryId: row.subcategory_id,
  name: row.name,
  code: row.code,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapModel = (row: any): InventoryCarModel => ({
  id: row.id,
  companyId: row.company_id,
  makeId: row.make_id,
  name: row.name,
  code: row.code,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapYear = (row: any): InventoryModelYear => ({
  id: row.id,
  companyId: row.company_id,
  modelId: row.model_id,
  year: Number(row.year),
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPart = (row: any): InventoryPart => ({
  id: row.id,
  companyId: row.company_id,
  yearId: row.year_id,
  name: row.name,
  partType: row.part_type,
  partNumber: row.part_number,
  partCode: row.part_code,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function listInventoryCategories(
  companyId: string,
  opts: { inventoryTypeId?: string | null; includeInactive?: boolean } = {}
): Promise<InventoryCategory[]> {
  const sql = getSql();
  const where =
    opts.inventoryTypeId
      ? sql`company_id = ${companyId} AND inventory_type_id = ${opts.inventoryTypeId}`
      : sql`company_id = ${companyId}`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_categories
    WHERE ${whereActive}
    ORDER BY name ASC
  `;
  return rows.map(mapCategory);
}

export async function createInventoryCategory(
  companyId: string,
  payload: { inventoryTypeId: string; name: string; code: string; description?: string | null }
): Promise<InventoryCategory> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_categories (
      company_id,
      inventory_type_id,
      name,
      code,
      description
    ) VALUES (
      ${companyId},
      ${payload.inventoryTypeId},
      ${payload.name},
      ${payload.code},
      ${payload.description ?? null}
    )
    RETURNING *
  `;
  return mapCategory(rows[0]);
}

export async function updateInventoryCategory(
  companyId: string,
  categoryId: string,
  patch: Partial<{ name: string; code: string; description: string | null; isActive: boolean }>
): Promise<InventoryCategory | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      code: patch.code,
      description: patch.description,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_categories
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${categoryId}
    RETURNING *
  `;
  return rows.length ? mapCategory(rows[0]) : null;
}

export async function deleteInventoryCategory(companyId: string, categoryId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_categories
    WHERE company_id = ${companyId} AND id = ${categoryId}
  `;
}

export async function listInventorySubcategories(
  companyId: string,
  opts: { categoryId?: string | null; includeInactive?: boolean } = {}
): Promise<InventorySubcategory[]> {
  const sql = getSql();
  const where =
    opts.categoryId
      ? sql`company_id = ${companyId} AND category_id = ${opts.categoryId}`
      : sql`company_id = ${companyId}`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_subcategories
    WHERE ${whereActive}
    ORDER BY name ASC
  `;
  return rows.map(mapSubcategory);
}

export async function createInventorySubcategory(
  companyId: string,
  payload: { categoryId: string; name: string; code: string; description?: string | null }
): Promise<InventorySubcategory> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_subcategories (
      company_id,
      category_id,
      name,
      code,
      description
    ) VALUES (
      ${companyId},
      ${payload.categoryId},
      ${payload.name},
      ${payload.code},
      ${payload.description ?? null}
    )
    RETURNING *
  `;
  return mapSubcategory(rows[0]);
}

export async function updateInventorySubcategory(
  companyId: string,
  subcategoryId: string,
  patch: Partial<{ name: string; code: string; description: string | null; isActive: boolean }>
): Promise<InventorySubcategory | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      code: patch.code,
      description: patch.description,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_subcategories
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${subcategoryId}
    RETURNING *
  `;
  return rows.length ? mapSubcategory(rows[0]) : null;
}

export async function deleteInventorySubcategory(companyId: string, subcategoryId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_subcategories
    WHERE company_id = ${companyId} AND id = ${subcategoryId}
  `;
}

export async function listInventoryMakes(
  companyId: string,
  opts: { subcategoryId?: string | null; includeInactive?: boolean } = {}
): Promise<InventoryCarMake[]> {
  const sql = getSql();
  const base =
    opts.subcategoryId
      ? sql`(company_id = ${companyId} OR company_id IS NULL) AND subcategory_id = ${opts.subcategoryId}`
      : sql`company_id = ${companyId} OR company_id IS NULL`;
  const where = opts.subcategoryId ? base : sql`(${base})`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_car_makes
    WHERE ${whereActive}
    ORDER BY name ASC
  `;
  return rows.map(mapMake);
}

export async function createInventoryMake(
  companyId: string,
  payload: { subcategoryId: string; name: string; code: string }
): Promise<InventoryCarMake> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_car_makes (
      company_id,
      subcategory_id,
      name,
      code
    ) VALUES (
      ${companyId},
      ${payload.subcategoryId},
      ${payload.name},
      ${payload.code}
    )
    RETURNING *
  `;
  return mapMake(rows[0]);
}

export async function updateInventoryMake(
  companyId: string,
  makeId: string,
  patch: Partial<{ name: string; code: string; isActive: boolean }>
): Promise<InventoryCarMake | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      code: patch.code,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_car_makes
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${makeId}
    RETURNING *
  `;
  return rows.length ? mapMake(rows[0]) : null;
}

export async function deleteInventoryMake(companyId: string, makeId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_car_makes
    WHERE company_id = ${companyId} AND id = ${makeId}
  `;
}

export async function listInventoryModels(
  companyId: string,
  opts: { makeId?: string | null; includeInactive?: boolean } = {}
): Promise<InventoryCarModel[]> {
  const sql = getSql();
  const base =
    opts.makeId
      ? sql`(company_id = ${companyId} OR company_id IS NULL) AND make_id = ${opts.makeId}`
      : sql`company_id = ${companyId} OR company_id IS NULL`;
  const where = opts.makeId ? base : sql`(${base})`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_car_models
    WHERE ${whereActive}
    ORDER BY name ASC
  `;
  return rows.map(mapModel);
}

export async function createInventoryModel(
  companyId: string,
  payload: { makeId: string; name: string; code: string }
): Promise<InventoryCarModel> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_car_models (
      company_id,
      make_id,
      name,
      code
    ) VALUES (
      ${companyId},
      ${payload.makeId},
      ${payload.name},
      ${payload.code}
    )
    RETURNING *
  `;
  return mapModel(rows[0]);
}

export async function updateInventoryModel(
  companyId: string,
  modelId: string,
  patch: Partial<{ name: string; code: string; isActive: boolean }>
): Promise<InventoryCarModel | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      code: patch.code,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_car_models
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${modelId}
    RETURNING *
  `;
  return rows.length ? mapModel(rows[0]) : null;
}

export async function deleteInventoryModel(companyId: string, modelId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_car_models
    WHERE company_id = ${companyId} AND id = ${modelId}
  `;
}

export async function listInventoryYears(
  companyId: string,
  opts: { modelId?: string | null; includeInactive?: boolean } = {}
): Promise<InventoryModelYear[]> {
  const sql = getSql();
  const base =
    opts.modelId
      ? sql`(company_id = ${companyId} OR company_id IS NULL) AND model_id = ${opts.modelId}`
      : sql`company_id = ${companyId} OR company_id IS NULL`;
  const where = opts.modelId ? base : sql`(${base})`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_model_years
    WHERE ${whereActive}
    ORDER BY year DESC
  `;
  return rows.map(mapYear);
}

export async function createInventoryYear(
  companyId: string,
  payload: { modelId: string; year: number }
): Promise<InventoryModelYear> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_model_years (
      company_id,
      model_id,
      year
    ) VALUES (
      ${companyId},
      ${payload.modelId},
      ${payload.year}
    )
    RETURNING *
  `;
  return mapYear(rows[0]);
}

export async function updateInventoryYear(
  companyId: string,
  yearId: string,
  patch: Partial<{ year: number; isActive: boolean }>
): Promise<InventoryModelYear | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      year: patch.year,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_model_years
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${yearId}
    RETURNING *
  `;
  return rows.length ? mapYear(rows[0]) : null;
}

export async function deleteInventoryYear(companyId: string, yearId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_model_years
    WHERE company_id = ${companyId} AND id = ${yearId}
  `;
}

export async function listInventoryParts(
  companyId: string,
  opts: { yearId?: string | null; includeInactive?: boolean } = {}
): Promise<InventoryPart[]> {
  const sql = getSql();
  const where =
    opts.yearId
      ? sql`company_id = ${companyId} AND year_id = ${opts.yearId}`
      : sql`company_id = ${companyId}`;
  const whereActive = opts.includeInactive ? where : sql`${where} AND is_active = true`;
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_parts
    WHERE ${whereActive}
    ORDER BY name ASC
  `;
  return rows.map(mapPart);
}

export async function createInventoryPart(
  companyId: string,
  payload: { yearId: string; name: string; partType?: string | null; partNumber: string; partCode: string }
): Promise<InventoryPart> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    INSERT INTO inventory_parts (
      company_id,
      year_id,
      name,
      part_type,
      part_number,
      part_code
    ) VALUES (
      ${companyId},
      ${payload.yearId},
      ${payload.name},
      ${payload.partType ?? null},
      ${payload.partNumber},
      ${payload.partCode}
    )
    RETURNING *
  `;
  return mapPart(rows[0]);
}

export async function updateInventoryPart(
  companyId: string,
  partId: string,
  patch: Partial<{ name: string; partType?: string | null; partNumber: string; partCode: string; isActive: boolean }>
): Promise<InventoryPart | null> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      name: patch.name,
      part_type: patch.partType,
      part_number: patch.partNumber,
      part_code: patch.partCode,
      is_active: patch.isActive,
    }).filter(([, value]) => value !== undefined)
  );
  if (!Object.keys(updated).length) return null;
  const rows = await sql/* sql */ `
    UPDATE inventory_parts
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${partId}
    RETURNING *
  `;
  return rows.length ? mapPart(rows[0]) : null;
}

export async function deleteInventoryPart(companyId: string, partId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_parts
    WHERE company_id = ${companyId} AND id = ${partId}
  `;
}
