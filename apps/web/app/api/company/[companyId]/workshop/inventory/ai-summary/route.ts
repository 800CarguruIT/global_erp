import { NextRequest, NextResponse } from "next/server";
import { canUseAi, getOpenAIClient, getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const branchId = req.nextUrl.searchParams.get("branchId") || null;

  try {
    const allowed = await canUseAi("ai.inventory.summary" as any, { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const sql = getSql();

    const [locRow] = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM inventory_locations
      WHERE company_id = ${companyId} AND is_active = TRUE
      ${branchId ? sql`AND (branch_id = ${branchId} OR fleet_vehicle_id IS NOT NULL)` : sql``}
    `;

    const [skuRow] = await sql`
      SELECT COUNT(DISTINCT part_id)::int AS cnt
      FROM inventory_stock
      WHERE company_id = ${companyId} AND COALESCE(on_hand,0) <> 0
    `;

    const [onHandRow] = await sql`
      SELECT COALESCE(SUM(on_hand),0)::numeric AS qty
      FROM inventory_stock
      WHERE company_id = ${companyId}
    `;

    let transferByStatus: Record<string, number> = {};
    // Only query transfers if the table exists to avoid runtime errors on older schemas.
    const [transferTableCheck] = await sql`
      SELECT to_regclass('public.inventory_transfers') IS NOT NULL AS exists
    `;
    if (transferTableCheck?.exists) {
      const transferCounts = await sql`
        SELECT status, COUNT(*)::int AS cnt
        FROM inventory_transfers
        WHERE company_id = ${companyId}
        GROUP BY status
      `;
      transferByStatus = Object.fromEntries((transferCounts as any[]).map((r) => [r.status, Number(r.cnt ?? 0)]));
    } else {
      transferByStatus = {};
    }

    const locationCount = Number(locRow?.cnt ?? 0);
    const skuCount = Number(skuRow?.cnt ?? 0);
    const onHand = Number(onHandRow?.qty ?? 0);
    const inTransit = Number(transferByStatus["in_transit"] ?? 0);
    const drafts = Number(transferByStatus["draft"] ?? 0);

    const client = getOpenAIClient();
    const prompt = `
You are an AI inventory planner for a company.
Use these metrics to propose 2-4 concise actions and one appreciation sentence.
Metrics:
- Active locations: ${locationCount}${branchId ? " (branch-filtered)" : ""}
- SKUs with stock: ${skuCount}
- Total on hand units: ${onHand}
- Transfers in transit: ${inTransit}
- Draft transfers: ${drafts}
Return strict JSON: { "actions": ["..."], "appreciation": "..." }.
Keep text short and actionable.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { actions?: string[]; appreciation?: string | null } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      suggestions: parsed.actions ?? [],
      appreciation: parsed.appreciation ?? null,
      meta: { aiUsed: true },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/workshop/inventory/ai-summary error", err);
    return NextResponse.json({ suggestions: [], appreciation: null, meta: { aiUsed: false, reason: "error" } });
  }
}
