import { getSql } from "../../db";

export type CatalogLookupResult = {
  partNumber: string | null;
  brand: string | null;
  source: "catalog" | "ai";
  confidence: "verified" | "suggested";
  photoFileId: string | null;
  catalogEntryId: string | null;
};

/**
 * Look up a part number: check verified catalog first, fall back to AI.
 * Returns the best available part number for a given car + part combination.
 */
export async function lookupPartNumber(
  companyId: string,
  carMake: string,
  carModel: string | null,
  partName: string,
  opts?: { apiKey?: string; baseUrl?: string; model?: string; carYear?: string | null }
): Promise<CatalogLookupResult> {
  const sql = getSql();
  const normalizedMake = carMake.trim().toUpperCase();
  const normalizedPart = partName.trim().toLowerCase();

  // 1. Check verified_parts_catalog (exact match on make + part name)
  const catalogRows = await sql`
    SELECT id, confirmed_part_number, confirmed_brand, part_photo_file_id
    FROM verified_parts_catalog
    WHERE company_id = ${companyId}
      AND UPPER(car_make) = ${normalizedMake}
      AND LOWER(part_name) = ${normalizedPart}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (catalogRows.length > 0) {
    const row = catalogRows[0];
    return {
      partNumber: row.confirmed_part_number,
      brand: row.confirmed_brand,
      source: "catalog",
      confidence: "verified",
      photoFileId: row.part_photo_file_id,
      catalogEntryId: row.id,
    };
  }

  // 2. Try with model match (more specific)
  if (carModel) {
    const modelRows = await sql`
      SELECT id, confirmed_part_number, confirmed_brand, part_photo_file_id
      FROM verified_parts_catalog
      WHERE company_id = ${companyId}
        AND UPPER(car_make) = ${normalizedMake}
        AND LOWER(car_model) = ${carModel.trim().toLowerCase()}
        AND LOWER(part_name) = ${normalizedPart}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (modelRows.length > 0) {
      const row = modelRows[0];
      return {
        partNumber: row.confirmed_part_number,
        brand: row.confirmed_brand,
        source: "catalog",
        confidence: "verified",
        photoFileId: row.part_photo_file_id,
        catalogEntryId: row.id,
      };
    }
  }

  // 3. Fall back to AI suggestion
  if (!opts?.apiKey) {
    return { partNumber: null, brand: null, source: "ai", confidence: "suggested", photoFileId: null, catalogEntryId: null };
  }

  const carContext = [carMake, carModel, opts?.carYear].filter(Boolean).join(" ");
  const prompt = `Car: ${carContext}\nPart: ${partName}\n\nReturn the OE (Original Equipment) part number for this specific car and part. Return ONLY a JSON object: {"partNumber": "string or null", "brand": "string or null"}. If unsure, use null.`;

  try {
    const baseUrl = opts.baseUrl ?? "https://api.openai.com";
    const aiRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You are an automotive parts specialist. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!aiRes.ok) {
      return { partNumber: null, brand: null, source: "ai", confidence: "suggested", photoFileId: null, catalogEntryId: null };
    }

    const aiJson = await aiRes.json();
    const content = (aiJson?.choices?.[0]?.message?.content ?? "{}").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(content);

    return {
      partNumber: parsed.partNumber ?? null,
      brand: parsed.brand ?? null,
      source: "ai",
      confidence: "suggested",
      photoFileId: null,
      catalogEntryId: null,
    };
  } catch {
    return { partNumber: null, brand: null, source: "ai", confidence: "suggested", photoFileId: null, catalogEntryId: null };
  }
}

/**
 * Insert a verified part into the catalog after receipt with evidence.
 */
export async function upsertVerifiedCatalogEntry(input: {
  companyId: string;
  carMake: string;
  carModel?: string | null;
  carYear?: number | null;
  vin?: string | null;
  partName: string;
  partCategory?: string | null;
  confirmedPartNumber: string;
  confirmedBrand?: string | null;
  partPhotoFileId?: string | null;
  sourcePoId?: string | null;
  sourceVendorId?: string | null;
  aiSuggestedPartNumber?: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO verified_parts_catalog (
      company_id, car_make, car_model, car_year, vin,
      part_name, part_category, confirmed_part_number, confirmed_brand,
      part_photo_file_id, source_po_id, source_vendor_id, ai_suggested_part_number
    ) VALUES (
      ${input.companyId},
      ${input.carMake.trim().toUpperCase()},
      ${input.carModel ?? null},
      ${input.carYear ?? null},
      ${input.vin ?? null},
      ${input.partName},
      ${input.partCategory ?? null},
      ${input.confirmedPartNumber},
      ${input.confirmedBrand ?? null},
      ${input.partPhotoFileId ?? null},
      ${input.sourcePoId ?? null},
      ${input.sourceVendorId ?? null},
      ${input.aiSuggestedPartNumber ?? null}
    )
  `;
}
