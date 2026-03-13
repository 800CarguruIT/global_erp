import { getSql } from "../../db";

type VinCatalogGroupInput = {
  id?: string;
  level?: number;
  name?: string;
};

type VinCatalogPartInput = {
  code?: string;
  name?: string;
  groups?: VinCatalogGroupInput[];
};

type VinCatalogCarInput = {
  id?: string;
  make?: string;
  title?: string;
  model?: string;
  year?: string;
  description?: string;
  info?: {
    title?: string;
    description?: string;
  };
  brand?: {
    name?: string;
  };
};

type UpsertVinCatalogParams = {
  vin: string;
  car: VinCatalogCarInput;
  parts: VinCatalogPartInput[];
  partsBrand?: unknown;
};

type VinCatalogSnapshot = {
  vin: string;
  car: {
    id: string;
    make: string;
    model: string;
    year: string;
    description: string;
    title: string;
  };
  partsBrand: any;
  parts: Array<{
    code: string;
    name: string;
    groups: Array<{ id: string; level: number; name: string }>;
  }>;
  partsCount: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDescriptionMap(description: string) {
  const out: Record<string, string> = {};
  const pieces = description
    .split(/[;\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const piece of pieces) {
    const idx = piece.indexOf(":");
    if (idx <= 0) continue;
    const key = piece.slice(0, idx).trim().toUpperCase();
    const value = piece.slice(idx + 1).trim();
    if (!value) continue;
    out[key] = value;
  }
  return out;
}

function buildCarUpsertPayload(car: VinCatalogCarInput, partsBrand?: unknown) {
  const sourceCarId = normalizeText(car?.id);
  if (!sourceCarId) throw new Error("source car id is required");
  const model = normalizeText(car?.model);
  const title = normalizeText(car?.info?.title || car?.title);
  const make = normalizeText(car?.brand?.name || car?.make);
  const combinedDescription = normalizeText(car?.info?.description || car?.description);
  const descriptionMap = parseDescriptionMap(combinedDescription);
  const yearRaw = normalizeText(car?.year);
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;
  return {
    sourceCarId,
    title,
    model,
    make,
    combinedDescription,
    year,
    descriptionMap,
    rawJson: { car, partsBrand: partsBrand ?? null } as any,
  };
}

async function upsertCarRow(
  trx: any,
  vin: string,
  car: VinCatalogCarInput,
  partsBrand?: unknown
): Promise<{ carRefId: string }> {
  const payload = buildCarUpsertPayload(car, partsBrand);
  const carRows = await trx<{ id: string }[]>/* sql */ `
    INSERT INTO vin_catalog_cars (
      vin,
      source_car_id,
      title,
      name,
      make,
      model,
      year,
      description,
      engine,
      drive,
      dest,
      grade,
      trans,
      raw_json,
      updated_at
    )
    VALUES (
      ${vin},
      ${payload.sourceCarId},
      ${payload.title || null},
      ${payload.model || null},
      ${payload.make || null},
      ${payload.model || null},
      ${payload.year},
      ${payload.combinedDescription || null},
      ${payload.descriptionMap.ENGINE ?? null},
      ${payload.descriptionMap.DRIVE ?? null},
      ${payload.descriptionMap.DEST ?? null},
      ${payload.descriptionMap.GRADE ?? null},
      ${payload.descriptionMap.TRANS ?? null},
      ${payload.rawJson},
      now()
    )
    ON CONFLICT (vin, source_car_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      name = EXCLUDED.name,
      make = EXCLUDED.make,
      model = EXCLUDED.model,
      year = EXCLUDED.year,
      description = EXCLUDED.description,
      engine = EXCLUDED.engine,
      drive = EXCLUDED.drive,
      dest = EXCLUDED.dest,
      grade = EXCLUDED.grade,
      trans = EXCLUDED.trans,
      raw_json = EXCLUDED.raw_json,
      updated_at = now()
    RETURNING id
  `;
  const carRefId = normalizeText(carRows[0]?.id);
  if (!carRefId) throw new Error("failed to upsert VIN catalog car");
  return { carRefId };
}

export async function upsertVinCatalogCars(params: {
  vin: string;
  cars: VinCatalogCarInput[];
  partsBrand?: unknown;
}): Promise<{ carRefIds: string[] }> {
  const vin = normalizeText(params.vin).toUpperCase();
  if (!vin) throw new Error("VIN is required");
  const cars = Array.isArray(params.cars) ? params.cars : [];
  if (!cars.length) return { carRefIds: [] };
  const sql = getSql();
  return sql.begin(async (trx) => {
    const carRefIds: string[] = [];
    for (const car of cars) {
      if (!normalizeText(car?.id)) continue;
      const { carRefId } = await upsertCarRow(trx, vin, car, params.partsBrand);
      carRefIds.push(carRefId);
    }
    return { carRefIds };
  });
}

export async function upsertVinCatalogSnapshot(params: UpsertVinCatalogParams): Promise<{ carRefId: string }> {
  const vin = normalizeText(params.vin).toUpperCase();
  if (!vin) throw new Error("VIN is required");
  const sql = getSql();
  return sql.begin(async (trx) => {
    const { carRefId } = await upsertCarRow(trx, vin, params.car, params.partsBrand);

    // Replace parts/groups snapshot for this exact car variant.
    await trx/* sql */ `
      DELETE FROM vin_catalog_parts
      WHERE car_ref_id = ${carRefId}
    `;

    for (let idx = 0; idx < params.parts.length; idx += 1) {
      const part = params.parts[idx] ?? {};
      const partNumber = normalizeText(part.code) || `unknown-${idx + 1}`;
      const partName = normalizeText(part.name);
      const partRows = await trx<{ id: string }[]>/* sql */ `
        INSERT INTO vin_catalog_parts (
          car_ref_id,
          car_vin,
          part_number,
          part_name,
          source_index,
          raw_json,
          updated_at
        )
        VALUES (
          ${carRefId},
          ${vin},
          ${partNumber},
          ${partName || null},
          ${idx},
          ${part as any},
          now()
        )
        ON CONFLICT (car_ref_id, part_number, source_index)
        DO UPDATE SET
          part_name = EXCLUDED.part_name,
          raw_json = EXCLUDED.raw_json,
          updated_at = now()
        RETURNING id
      `;
      const partRefId = String(partRows[0]?.id ?? "");
      if (!partRefId) continue;

      const groups = Array.isArray(part.groups) ? part.groups : [];
      for (const group of groups) {
        const groupSourceId = normalizeText(group?.id) || null;
        const groupLevel = Number(group?.level ?? 0) || null;
        const groupName = normalizeText(group?.name) || null;
        await trx/* sql */ `
          INSERT INTO vin_catalog_part_groups (
            part_ref_id,
            group_source_id,
            group_level,
            group_name,
            raw_json,
            updated_at
          )
          VALUES (
            ${partRefId},
            ${groupSourceId},
            ${groupLevel},
            ${groupName},
            ${group as any},
            now()
          )
          ON CONFLICT (part_ref_id, group_source_id, group_level, group_name)
          DO UPDATE SET
            raw_json = EXCLUDED.raw_json,
            updated_at = now()
        `;
      }
    }

    return { carRefId };
  });
}

export async function getVinCatalogCarsByVin(vinInput: string): Promise<
  Array<{
    id: string;
    make: string;
    model: string;
    year: string;
    description: string;
    title: string;
  }>
> {
  const vin = normalizeText(vinInput).toUpperCase();
  if (!vin) return [];
  const sql = getSql();
  const rows = await sql<any[]>/* sql */ `
    SELECT *
    FROM vin_catalog_cars
    WHERE vin = ${vin}
    ORDER BY updated_at DESC, created_at DESC
  `;

  return rows.map((row) => {
    const sourceRaw = (row.raw_json ?? null) as any;
    const sourceCar = sourceRaw?.car ?? sourceRaw ?? {};
    return {
      id: normalizeText(row.source_car_id),
      make: normalizeText(row.make),
      model: normalizeText(row.model || row.name),
      year: row.year == null ? "" : String(row.year),
      description: normalizeText(row.description),
      title: normalizeText(row.title || sourceCar?.info?.title),
    };
  });
}

export async function getVinCatalogSnapshotByVinAndCarId(
  vinInput: string,
  sourceCarIdInput: string
): Promise<VinCatalogSnapshot | null> {
  const vin = normalizeText(vinInput).toUpperCase();
  const sourceCarId = normalizeText(sourceCarIdInput);
  if (!vin || !sourceCarId) return null;
  const sql = getSql();
  const carRows = await sql<any[]>/* sql */ `
    SELECT *
    FROM vin_catalog_cars
    WHERE vin = ${vin}
      AND source_car_id = ${sourceCarId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const carRow = carRows[0];
  if (!carRow) return null;

  const sourceRaw = (carRow.raw_json ?? null) as any;
  const sourceCar = sourceRaw?.car ?? sourceRaw ?? {};
  const partsBrand = sourceRaw?.partsBrand ?? null;

  const flatRows = await sql<any[]>/* sql */ `
    SELECT
      p.id AS part_id,
      p.part_number,
      p.part_name,
      p.source_index,
      g.group_source_id,
      g.group_level,
      g.group_name
    FROM vin_catalog_parts p
    LEFT JOIN vin_catalog_part_groups g
      ON g.part_ref_id = p.id
    WHERE p.car_ref_id = ${carRow.id}
    ORDER BY p.source_index ASC, g.group_level ASC NULLS LAST, g.group_name ASC NULLS LAST
  `;

  const partsMap = new Map<string, { code: string; name: string; groups: Array<{ id: string; level: number; name: string }> }>();
  for (const row of flatRows) {
    const partId = normalizeText(row.part_id);
    if (!partId) continue;
    if (!partsMap.has(partId)) {
      partsMap.set(partId, {
        code: normalizeText(row.part_number),
        name: normalizeText(row.part_name),
        groups: [],
      });
    }
    if (row.group_name != null || row.group_source_id != null || row.group_level != null) {
      partsMap.get(partId)!.groups.push({
        id: normalizeText(row.group_source_id),
        level: Number(row.group_level ?? 0) || 0,
        name: normalizeText(row.group_name),
      });
    }
  }

  const parts = Array.from(partsMap.values());
  return {
    vin,
    car: {
      id: normalizeText(carRow.source_car_id),
      make: normalizeText(carRow.make),
      model: normalizeText(carRow.model || carRow.name),
      year: carRow.year == null ? "" : String(carRow.year),
      description: normalizeText(carRow.description),
      title: normalizeText(carRow.title || sourceCar?.info?.title),
    },
    partsBrand,
    parts,
    partsCount: parts.length,
  };
}

export async function getVinCatalogSnapshotByVin(vinInput: string): Promise<VinCatalogSnapshot | null> {
  const vin = normalizeText(vinInput).toUpperCase();
  if (!vin) return null;
  const sql = getSql();
  const row = await sql<{ source_car_id: string }[]>/* sql */ `
    SELECT source_car_id
    FROM vin_catalog_cars
    WHERE vin = ${vin}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;
  const sourceCarId = normalizeText(row[0]?.source_car_id);
  if (!sourceCarId) return null;
  return getVinCatalogSnapshotByVinAndCarId(vin, sourceCarId);
}
