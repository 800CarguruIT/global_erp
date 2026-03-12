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

export async function upsertVinCatalogSnapshot(params: UpsertVinCatalogParams): Promise<{ carRefId: string }> {
  const vin = normalizeText(params.vin).toUpperCase();
  if (!vin) throw new Error("VIN is required");
  const sourceCarId = normalizeText(params.car?.id);
  if (!sourceCarId) throw new Error("source car id is required");

  const model = normalizeText(params.car?.model);
  const title = normalizeText(params.car?.info?.title);
  const make = normalizeText(params.car?.brand?.name);
  const combinedDescription = normalizeText(params.car?.info?.description || params.car?.description);
  const descriptionMap = parseDescriptionMap(combinedDescription);
  const yearRaw = normalizeText(params.car?.year);
  const year = /^\d{4}$/.test(yearRaw) ? Number(yearRaw) : null;

  const sql = getSql();
  return sql.begin(async (trx) => {
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
        ${sourceCarId},
        ${title || null},
        ${model || null},
        ${make || null},
        ${model || null},
        ${year},
        ${combinedDescription || null},
        ${descriptionMap.ENGINE ?? null},
        ${descriptionMap.DRIVE ?? null},
        ${descriptionMap.DEST ?? null},
        ${descriptionMap.GRADE ?? null},
        ${descriptionMap.TRANS ?? null},
        ${{ car: params.car, partsBrand: params.partsBrand ?? null } as any},
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

    const carRefId = String(carRows[0]?.id ?? "");
    if (!carRefId) throw new Error("failed to upsert VIN catalog car");

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

export async function getVinCatalogSnapshotByVin(vinInput: string): Promise<{
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
} | null> {
  const vin = normalizeText(vinInput).toUpperCase();
  if (!vin) return null;
  const sql = getSql();

  const carRows = await sql<any[]>/* sql */ `
    SELECT *
    FROM vin_catalog_cars
    WHERE vin = ${vin}
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
