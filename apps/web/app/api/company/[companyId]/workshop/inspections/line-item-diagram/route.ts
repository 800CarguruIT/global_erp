import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany, getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

type Candidate = { url: string; source: string };

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
    const rows = await sql<any[]>/* sql */ `
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

    const candidates: Candidate[] = [];
    for (const row of rows) {
      collectImageCandidates(row?.part_raw ?? null, "part_raw", candidates);
      collectImageCandidates(row?.group_raw ?? null, "group_raw", candidates);
    }
    const deduped = Array.from(new Map(candidates.map((c) => [c.url, c])).values()).slice(0, 15);
    if (!deduped.length) {
      return NextResponse.json({
        found: false,
        diagramUrl: null,
        candidates: [],
        message: "No diagram/image URL found in VIN catalog snapshot for this part.",
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
      message: "Diagram candidate loaded.",
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/workshop/inspections/line-item-diagram error", err);
    return NextResponse.json({ error: "Failed to fetch line item diagram." }, { status: 500 });
  }
}

