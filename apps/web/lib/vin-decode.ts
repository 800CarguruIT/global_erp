/**
 * VIN Decode Service
 * Uses NHTSA free API for base decode + AI enrichment for non-US / incomplete data.
 */

export interface VinDecodeResult {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  bodyType: string | null;
  engineType: string | null;
  engineDisplacement: string | null;
  cylinders: number | null;
  driveType: string | null;
  fuelType: string | null;
  transmissionType: string | null;
  trimLevel: string | null;
  plantCountry: string | null;
  source: "nhtsa" | "ai" | "nhtsa+ai";
  raw?: Record<string, string>;
}

interface NhtsaVariable {
  Variable: string;
  Value: string | null;
  ValueId: string | null;
  VariableId: number;
}

const NHTSA_API = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin";

/**
 * Decode a VIN using the free NHTSA API.
 * Works best for North American VINs; returns partial data for other markets.
 */
async function decodeVinViaNhtsa(vin: string): Promise<Partial<VinDecodeResult>> {
  const url = `${NHTSA_API}/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return {};

  const json = await res.json();
  const results: NhtsaVariable[] = json?.Results ?? [];

  const get = (varName: string): string | null => {
    const entry = results.find(
      (r) => r.Variable === varName && r.Value && r.Value.trim() !== ""
    );
    return entry?.Value?.trim() ?? null;
  };

  const yearStr = get("Model Year");
  const cylStr = get("Engine Number of Cylinders");

  const raw: Record<string, string> = {};
  for (const r of results) {
    if (r.Value && r.Value.trim()) raw[r.Variable] = r.Value.trim();
  }

  return {
    vin,
    make: get("Make"),
    model: get("Model"),
    year: yearStr ? parseInt(yearStr, 10) || null : null,
    bodyType: get("Body Class"),
    engineType: get("Engine Model") ?? get("Engine Configuration"),
    engineDisplacement: get("Displacement (L)"),
    cylinders: cylStr ? parseInt(cylStr, 10) || null : null,
    driveType: get("Drive Type"),
    fuelType: get("Fuel Type - Primary"),
    transmissionType: get("Transmission Style"),
    trimLevel: get("Trim") ?? get("Trim2") ?? get("Series"),
    plantCountry: get("Plant Country"),
    raw,
  };
}

/**
 * Use AI to decode or enrich VIN data.
 * Called when NHTSA returns incomplete results (common for non-US VINs).
 */
async function enrichVinWithAi(
  vin: string,
  partial: Partial<VinDecodeResult>,
  opts?: { apiKey?: string; baseUrl?: string; model?: string }
): Promise<VinDecodeResult> {
  const knownFields = Object.entries(partial)
    .filter(([k, v]) => v != null && k !== "vin" && k !== "raw" && k !== "source")
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = knownFields
    ? `Given VIN "${vin}" with partial decode data: ${knownFields}. Fill in any missing vehicle details.`
    : `Decode VIN "${vin}" and provide the vehicle details.`;

  const systemPrompt = `You are an automotive VIN decoder. Given a VIN, return a JSON object with these fields:
- make (string): vehicle manufacturer
- model (string): vehicle model name
- year (number): model year
- bodyType (string): e.g. Sedan, SUV, Coupe, Hatchback, Pickup, Van
- engineType (string): engine description
- engineDisplacement (string): displacement in liters e.g. "2.0L"
- cylinders (number): number of cylinders
- driveType (string): e.g. FWD, RWD, AWD, 4WD
- fuelType (string): e.g. Gasoline, Diesel, Hybrid, Electric
- transmissionType (string): e.g. Automatic, Manual, CVT, DCT
- trimLevel (string or null): trim level if identifiable
- plantCountry (string): country of manufacture

Return ONLY valid JSON. Do not include markdown formatting. Use null for unknown fields.`;

  try {
    const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return buildResult(vin, partial, "nhtsa");
    }

    const model = opts?.model ?? process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
    const baseUrl = opts?.baseUrl ?? "https://api.openai.com";
    const aiRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!aiRes.ok) {
      return buildResult(vin, partial, "nhtsa");
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Merge: prefer NHTSA data, fill gaps with AI
    return {
      vin,
      make: partial.make ?? parsed.make ?? null,
      model: partial.model ?? parsed.model ?? null,
      year: partial.year ?? (typeof parsed.year === "number" ? parsed.year : null),
      bodyType: partial.bodyType ?? parsed.bodyType ?? null,
      engineType: partial.engineType ?? parsed.engineType ?? null,
      engineDisplacement: partial.engineDisplacement ?? parsed.engineDisplacement ?? null,
      cylinders: partial.cylinders ?? (typeof parsed.cylinders === "number" ? parsed.cylinders : null),
      driveType: partial.driveType ?? parsed.driveType ?? null,
      fuelType: partial.fuelType ?? parsed.fuelType ?? null,
      transmissionType: partial.transmissionType ?? parsed.transmissionType ?? null,
      trimLevel: partial.trimLevel ?? parsed.trimLevel ?? null,
      plantCountry: partial.plantCountry ?? parsed.plantCountry ?? null,
      source: partial.make ? "nhtsa+ai" : "ai",
      raw: partial.raw,
    };
  } catch {
    return buildResult(vin, partial, "nhtsa");
  }
}

function buildResult(
  vin: string,
  partial: Partial<VinDecodeResult>,
  source: VinDecodeResult["source"]
): VinDecodeResult {
  return {
    vin,
    make: partial.make ?? null,
    model: partial.model ?? null,
    year: partial.year ?? null,
    bodyType: partial.bodyType ?? null,
    engineType: partial.engineType ?? null,
    engineDisplacement: partial.engineDisplacement ?? null,
    cylinders: partial.cylinders ?? null,
    driveType: partial.driveType ?? null,
    fuelType: partial.fuelType ?? null,
    transmissionType: partial.transmissionType ?? null,
    trimLevel: partial.trimLevel ?? null,
    plantCountry: partial.plantCountry ?? null,
    source,
    raw: partial.raw,
  };
}

/**
 * Decode a VIN: NHTSA first, AI enrichment if incomplete.
 */
export async function decodeVin(vin: string, opts?: { apiKey?: string; baseUrl?: string; model?: string }): Promise<VinDecodeResult> {
  const cleaned = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
  if (cleaned.length !== 17) {
    throw new Error(`Invalid VIN length: expected 17 characters, got ${cleaned.length}`);
  }

  const nhtsaResult = await decodeVinViaNhtsa(cleaned);

  // If NHTSA gave us make + model + year, consider it complete enough
  if (nhtsaResult.make && nhtsaResult.model && nhtsaResult.year) {
    return buildResult(cleaned, nhtsaResult, "nhtsa");
  }

  // Otherwise, enrich with AI
  return enrichVinWithAi(cleaned, nhtsaResult, opts);
}
