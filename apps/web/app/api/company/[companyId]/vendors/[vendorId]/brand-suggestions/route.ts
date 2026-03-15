import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClientForCompany, getSql, ReferenceData } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

function normalizeBrandName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeBrands(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeBrandName(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim().toLowerCase();
  if (action === "upsert") {
    const brandName = normalizeBrandName(String(body?.brandName ?? ""));
    if (!brandName) {
      return NextResponse.json({ error: "brandName is required" }, { status: 400 });
    }
    try {
      const sql = getSql();
      const tableExistsRows = await sql<{ exists: boolean }[]>`
        SELECT to_regclass('public.part_brands') IS NOT NULL AS exists
      `;
      if (!tableExistsRows[0]?.exists) {
        return NextResponse.json({ data: { saved: false, reason: "table-missing" } }, { status: 200 });
      }
      const normalized = brandName.toLowerCase().replace(/\s+/g, " ").trim();
      await sql`
        INSERT INTO part_brands (company_id, name, normalized_name)
        VALUES (${companyId}, ${brandName}, ${normalized})
        ON CONFLICT (company_id, normalized_name)
        DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      `;
      return NextResponse.json({ data: { saved: true, brandName } }, { status: 200 });
    } catch {
      return NextResponse.json({ data: { saved: false } }, { status: 200 });
    }
  }

  const partName = String(body?.partName ?? "").trim();
  const partNumber = String(body?.partNumber ?? "").trim();
  const carMake = String(body?.carMake ?? "").trim();
  const carModel = String(body?.carModel ?? "").trim();
  const query = String(body?.query ?? "").trim();

  const sql = getSql();
  const baseBrands = ReferenceData.ReferencePartBrands.partBrands.map((b) => b.name);

  let companyBrands: string[] = [];
  try {
    const tableExistsRows = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.part_brands') IS NOT NULL AS exists
    `;
    if (tableExistsRows[0]?.exists) {
      const rows = await sql<{ name: string }[]>`
        SELECT name
        FROM part_brands
        WHERE company_id = ${companyId}
        ORDER BY updated_at DESC, name ASC
        LIMIT 100
      `;
      companyBrands = rows.map((row) => String(row.name ?? "").trim()).filter(Boolean);
    }
  } catch {
    companyBrands = [];
  }

  let aiBrands: string[] = [];
  try {
    const resolved = await getOpenAIClientForCompany(companyId);
    if (resolved.client) {
      const prompt = `
You are an automotive parts sourcing assistant.
Suggest up to 8 realistic part brands for the context below.

Context:
- Part name: ${partName || "N/A"}
- Part number: ${partNumber || "N/A"}
- Vehicle make: ${carMake || "N/A"}
- Vehicle model: ${carModel || "N/A"}
- User typed brand text: ${query || "N/A"}

Return strict JSON only:
{"brands":["Brand 1","Brand 2"]}

Rules:
- Only brand names, no notes.
- Include likely OE/OEM/aftermarket choices when relevant.
- Do not include "Other".
`;
      const completion = await resolved.client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { brands?: unknown };
      if (Array.isArray(parsed.brands)) {
        aiBrands = parsed.brands
          .map((item) => String(item ?? "").trim())
          .filter(Boolean)
          .slice(0, 8);
      }
    }
  } catch {
    aiBrands = [];
  }

  const localMerged = dedupeBrands([...companyBrands, ...baseBrands]);
  const normalizedQuery = query.toLowerCase();
  const localFiltered = normalizedQuery
    ? localMerged.filter((name) => name.toLowerCase().includes(normalizedQuery))
    : localMerged;
  const merged = dedupeBrands([...aiBrands, ...localFiltered]).slice(0, 25);
  return NextResponse.json({ data: [...merged, "Other"] });
}
