import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClientForCompany, getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

type SmartFaultSuggestion = {
  id: string;
  label: string;
  reason: string;
};

function normalizeSuggestions(value: unknown): SmartFaultSuggestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const label = String((item as any)?.label ?? "").trim();
      const fallbackId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `s${index + 1}`;
      const id = String((item as any)?.id ?? fallbackId);
      const reason = String((item as any)?.reason ?? "").trim();
      return { id, label, reason };
    })
    .filter((item) => Boolean(item.label))
    .slice(0, 5);
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const context = (body?.context ?? {}) as {
    partName?: string;
    partNumber?: string;
    vin?: string;
    category?: string;
    groupName?: string;
    description?: string;
    status?: string;
  };
  const fallback = normalizeSuggestions(body?.fallback);
  const partName = String(context.partName ?? "").trim();
  const partNumber = String(context.partNumber ?? "").trim();
  const vin = String(context.vin ?? "").trim().toUpperCase();
  const category = String(context.category ?? "").trim();
  const groupName = String(context.groupName ?? "").trim();
  const description = String(context.description ?? "").trim();
  const status = String(context.status ?? "").trim();

  if (!partName) return NextResponse.json({ error: "partName is required" }, { status: 400 });

  try {
    const sql = getSql();
    const catalogRows = vin
      ? await sql<any[]>/* sql */ `
          SELECT
            p.part_name,
            p.part_number,
            g.group_name
          FROM vin_catalog_parts p
          LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
          WHERE p.car_vin = ${vin}
          ORDER BY p.updated_at DESC
          LIMIT 300
        `
      : [];
    const catalogCandidates = Array.from(
      new Map(
        catalogRows
          .map((row) => {
            const label = String(row?.part_name ?? "").trim();
            const number = String(row?.part_number ?? "").trim();
            const id = `${label}-${number}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const reason = `From VIN catalog${row?.group_name ? ` (${String(row.group_name)})` : ""}.`;
            return {
              id,
              label: number ? `${label || "Part"} (${number})` : label,
              reason,
              rawLabel: label.toLowerCase(),
              rawNumber: number.toLowerCase(),
            };
          })
          .filter((item) => Boolean(item.label))
      ).values()
    );
    const filteredCatalogCandidates = catalogCandidates.filter((item) => {
      if (!item) return false;
      const partLower = partName.toLowerCase();
      const codeLower = partNumber.toLowerCase();
      if (!partLower && !codeLower) return true;
      const rawLabel = String((item as any).rawLabel ?? "");
      const rawNumber = String((item as any).rawNumber ?? "");
      if (rawLabel.includes(partLower) || (codeLower && rawNumber.includes(codeLower))) return false;
      return true;
    });

    const allowed = await canUseAi("ai.workshop.inspection.related_suggestions" as any, { companyId }).catch(() => true);
    const resolved = await getOpenAIClientForCompany(companyId);
    if (!allowed || !resolved.client) {
      const catalogFallback = filteredCatalogCandidates
        .slice(0, 5)
        .map((item) => ({ id: item.id, label: item.label, reason: item.reason }));
      return NextResponse.json({
        suggestions: catalogFallback.length > 0 ? catalogFallback : fallback,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const prompt = `
You are a workshop inspection assistant.
Given one detected issue, suggest up to 4 related components/checks that should also be inspected.

Issue:
- Part: ${partName}
- Category: ${category || "N/A"}
- Group: ${groupName || "N/A"}
- Description: ${description || "N/A"}
- Severity: ${status || "N/A"}
- VIN: ${vin || "N/A"}
- VIN catalog candidates: ${JSON.stringify(filteredCatalogCandidates.slice(0, 80).map((c) => ({ id: c.id, label: c.label })))}

Return strict JSON:
{
  "suggestions": [
    { "id": "short-id", "label": "Check ...", "reason": "short reason" }
  ]
}

Rules:
- Suggestions must be practical and workshop-relevant.
- Prefer selecting from VIN catalog candidates when relevant.
- Keep reason short and clear.
- Prefer safety-critical and commonly related items.
- No markdown. JSON only.
`;

    const completion = await resolved.client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
    const aiSuggestions = normalizeSuggestions(parsed.suggestions);
    const catalogFallback = filteredCatalogCandidates
      .slice(0, 5)
      .map((item) => ({ id: item.id, label: item.label, reason: item.reason }));
    const suggestions = aiSuggestions.length > 0 ? aiSuggestions : catalogFallback.length > 0 ? catalogFallback : fallback;

    return NextResponse.json({
      suggestions,
      meta: { aiUsed: aiSuggestions.length > 0, source: resolved.source },
    });
  } catch (err) {
    console.error("POST /api/company/[companyId]/workshop/inspections/ai-related-suggestions error", err);
    return NextResponse.json({ suggestions: fallback, error: "Failed to generate AI related suggestions." }, { status: 200 });
  }
}
