import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany, getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

type Candidate = { url: string; source: string };

function parseJsonObjectFromText(input: string): Record<string, unknown> {
  const text = String(input ?? "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

function looksLikeImageUrl(value: string): boolean {
  const v = value.toLowerCase();
  if (!/^https?:\/\//.test(v)) return false;
  if (/\.(png|jpg|jpeg|webp|svg)(\?|$)/.test(v)) return true;
  return v.includes("image") || v.includes("diagram") || v.includes("img");
}

function collectImageCandidates(input: unknown, source: string, out: Candidate[]) {
  if (input == null) return;
  if (typeof input === "string") {
    const value = input.trim();
    if (looksLikeImageUrl(value)) out.push({ url: value, source });
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectImageCandidates(item, source, out);
    return;
  }
  if (typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const nextSource = source ? `${source}.${k}` : k;
      collectImageCandidates(v, nextSource, out);
    }
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

  const vin = String(req.nextUrl.searchParams.get("vin") ?? "").trim().toUpperCase();
  const partNumber = String(req.nextUrl.searchParams.get("partNumber") ?? "").trim();
  const partName = String(req.nextUrl.searchParams.get("partName") ?? "").trim();
  const groupName = String(req.nextUrl.searchParams.get("groupName") ?? "").trim();
  if (!vin) return NextResponse.json({ error: "vin is required" }, { status: 400 });
  if (!partNumber && !partName) {
    return NextResponse.json({ error: "partNumber or partName is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const strictRows = await sql<any[]>/* sql */ `
      SELECT
        p.raw_json AS part_raw,
        p.part_number,
        p.part_name,
        g.raw_json AS group_raw,
        g.group_name
      FROM vin_catalog_parts p
      LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
      WHERE p.car_vin = ${vin}
        AND (
          ${partNumber ? sql`p.part_number = ${partNumber}` : sql`FALSE`}
          OR ${partName ? sql`p.part_name ILIKE ${`%${partName}%`}` : sql`FALSE`}
        )
        ${groupName ? sql`AND (g.group_name ILIKE ${`%${groupName}%`})` : sql``}
      ORDER BY p.updated_at DESC
      LIMIT 50
    `;
    const normalizedNeedle = partName
      .toLowerCase()
      .replace(/^check\s+/i, "")
      .replace(/^inspect\s+/i, "")
      .replace(/[^a-z0-9\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const fuzzyRows =
      strictRows.length > 0 || !normalizedNeedle
        ? []
        : await sql<any[]>/* sql */ `
            SELECT
              p.raw_json AS part_raw,
              p.part_number,
              p.part_name,
              g.raw_json AS group_raw,
              g.group_name
            FROM vin_catalog_parts p
            LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
            WHERE p.car_vin = ${vin}
              AND p.part_name ILIKE ${`%${normalizedNeedle}%`}
              ${groupName ? sql`AND (g.group_name ILIKE ${`%${groupName}%`})` : sql``}
            ORDER BY p.updated_at DESC
            LIMIT 80
          `;
    const groupRows =
      strictRows.length > 0 || fuzzyRows.length > 0 || !groupName
        ? []
        : await sql<any[]>/* sql */ `
            SELECT
              p.raw_json AS part_raw,
              p.part_number,
              p.part_name,
              g.raw_json AS group_raw,
              g.group_name
            FROM vin_catalog_parts p
            LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
            WHERE p.car_vin = ${vin}
              AND g.group_name ILIKE ${`%${groupName}%`}
            ORDER BY p.updated_at DESC
            LIMIT 120
          `;
    const vinWideRows =
      strictRows.length > 0 || fuzzyRows.length > 0 || groupRows.length > 0
        ? []
        : await sql<any[]>/* sql */ `
            SELECT
              p.raw_json AS part_raw,
              p.part_number,
              p.part_name,
              g.raw_json AS group_raw,
              g.group_name
            FROM vin_catalog_parts p
            LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
            WHERE p.car_vin = ${vin}
            ORDER BY p.updated_at DESC
            LIMIT 120
          `;
    const rows = [...strictRows, ...fuzzyRows, ...groupRows, ...vinWideRows];

    const candidates: Candidate[] = [];
    for (const row of rows) {
      collectImageCandidates(row?.part_raw ?? null, "part_raw", candidates);
      collectImageCandidates(row?.group_raw ?? null, "group_raw", candidates);
    }
    const deduped = Array.from(new Map(candidates.map((c) => [c.url, c])).values()).slice(0, 15);
    if (!deduped.length) {
      try {
        const allowed = await canUseAi("ai.workshop.inspection.diagram" as any, { companyId }).catch(() => true);
        const resolved = await getOpenAIClientForCompany(companyId);
        if (allowed && resolved.client) {
          const webSearchPrompt = `
Find one best technical parts diagram image URL for this vehicle part.
VIN: ${vin}
Part name: ${partName || "N/A"}
Part number: ${partNumber || "N/A"}
Group: ${groupName || "N/A"}

Return strict JSON only:
{
  "diagramUrl": "https://...",
  "searchQuery": "short query if direct url unavailable"
}
Rules:
- Prefer direct image URL (png/jpg/webp/svg) from reputable parts/diagram source.
- If no reliable direct image URL is found, leave diagramUrl empty and provide searchQuery.
`;
          let aiRaw = "";
          try {
            const responsesApi = (resolved.client as any)?.responses;
            if (responsesApi?.create) {
              const response = await responsesApi.create({
                model: "gpt-4.1-mini",
                tools: [{ type: "web_search_preview" }],
                input: webSearchPrompt,
              });
              aiRaw = String(response?.output_text ?? "");
            }
          } catch {
            aiRaw = "";
          }
          if (!aiRaw) {
            const completion = await resolved.client.chat.completions.create({
              model: "gpt-4.1-mini",
              messages: [{ role: "user", content: webSearchPrompt }],
              response_format: { type: "json_object" },
            });
            aiRaw = String(completion.choices[0]?.message?.content ?? "");
          }
          const parsed = parseJsonObjectFromText(aiRaw);
          const aiUrl = String(parsed?.diagramUrl ?? "").trim();
          const aiQuery =
            String(parsed?.searchQuery ?? "").trim() ||
            `${partNumber || partName || "car part"} ${groupName || ""} diagram`.trim();
          const searchUrl = aiQuery
            ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(aiQuery)}`
            : "";
          if (looksLikeImageUrl(aiUrl)) {
            return NextResponse.json({
              found: true,
              diagramUrl: aiUrl,
              source: "ai-web-search",
              candidates: [],
              message: "Diagram loaded via AI web search fallback.",
              searchUrl,
            });
          }
          return NextResponse.json({
            found: false,
            diagramUrl: null,
            candidates: [],
            message: "No direct diagram image found; open AI search results.",
            searchUrl,
          });
        }
      } catch {
        // fall through to not-found
      }
      return NextResponse.json({
        found: false,
        diagramUrl: null,
        candidates: [],
        message: "No diagram/image URL found in VIN catalog snapshot for this part/group.",
      });
    }

    let chosen = deduped[0]!;
    try {
      const allowed = await canUseAi("ai.workshop.inspection.diagram" as any, { companyId }).catch(() => true);
      const resolved = await getOpenAIClientForCompany(companyId);
      if (allowed && resolved.client && deduped.length > 1) {
        const prompt = `
Choose the best technical diagram URL for this car part.
VIN: ${vin}
Part name: ${partName || "N/A"}
Part number: ${partNumber || "N/A"}
Group name: ${groupName || "N/A"}
Candidates: ${JSON.stringify(deduped)}
Return strict JSON: {"url":"...","reason":"short"}.
`;
        const completion = await resolved.client.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(raw) as { url?: string };
        const picked = String(parsed?.url ?? "").trim();
        const matched = deduped.find((c) => c.url === picked);
        if (matched) chosen = matched;
      }
    } catch {
      // keep first candidate if AI ranking fails
    }

    return NextResponse.json({
      found: true,
      diagramUrl: chosen.url,
      source: chosen.source,
      candidates: deduped,
      message:
        strictRows.length > 0
          ? "Diagram candidate loaded."
          : fuzzyRows.length > 0
          ? "Diagram loaded from fuzzy part-name match."
          : groupRows.length > 0
          ? "Diagram loaded from same-group fallback."
          : "Diagram loaded from VIN-wide fallback.",
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/workshop/inspections/line-item-diagram error", err);
    return NextResponse.json({ error: "Failed to fetch line item diagram." }, { status: 500 });
  }
}
