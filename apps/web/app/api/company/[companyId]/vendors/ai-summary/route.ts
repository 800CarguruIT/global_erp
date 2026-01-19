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

  try {
    const allowed = await canUseAi("ai.vendor.summary" as any, { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const summaryUrl = new URL(`/api/company/${companyId}/vendors/summary`, base).toString();
    const summaryRes = await fetch(summaryUrl, { cache: "no-store" });
    if (!summaryRes.ok) throw new Error("Failed to load vendor summary");
    const summaryJson = await summaryRes.json();
    const summary = summaryJson?.data ?? {};

    const totals = Object.values(summary as Record<string, any>).reduce(
      (acc, v: any) => {
        acc.vendors += 1;
        acc.users += v?.users ?? 0;
        acc.quotes += v?.quotes ?? 0;
        acc.pos += v?.pos ?? 0;
        acc.delivered += v?.delivered ?? 0;
        acc.returned += v?.returned ?? 0;
        return acc;
      },
      { vendors: 0, users: 0, quotes: 0, pos: 0, delivered: 0, returned: 0 }
    );

    const sql = getSql();
    const inactiveVendorsRow = await sql`
      SELECT COUNT(*)::int AS cnt
      FROM vendors
      WHERE company_id = ${companyId} AND (is_active = FALSE OR is_active IS NULL)
    `;
    const inactive = Number(inactiveVendorsRow?.[0]?.cnt ?? 0);

    const client = getOpenAIClient();
    const prompt = `
You are an AI vendor manager. Based on these metrics, suggest 2-4 concise actions and 1 appreciation:
- Vendors: ${totals.vendors} (inactive: ${inactive})
- Vendor users: ${totals.users}
- Vendor quotes: ${totals.quotes}
- Vendor PO/LPO: ${totals.pos}
- Delivered items: ${totals.delivered}
- Returned items: ${totals.returned}
Return strict JSON: { "actions": ["..."], "appreciation": "..." } with short, actionable text.
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
      totals,
      meta: { aiUsed: true },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/vendors/ai-summary error", err);
    return NextResponse.json({
      suggestions: [],
      appreciation: null,
      totals: null,
      meta: { aiUsed: false, reason: "error" },
    });
  }
}
