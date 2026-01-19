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
    const allowed = await canUseAi("ai.branchQuotes.summary" as any, { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const sql = getSql();
    const statusAgg = await sql`
      SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total_amount),0)::numeric AS total
      FROM quotes
      WHERE company_id = ${companyId} AND quote_type = 'branch_labor'
      GROUP BY status
    `;

    const byStatus = Object.fromEntries(
      (statusAgg as any[]).map((r) => [r.status, { count: Number(r.cnt ?? 0), total: Number(r.total ?? 0) }])
    );

    const totalQuotes = Object.values(byStatus).reduce((sum, v: any) => sum + (v?.count ?? 0), 0);
    const open = byStatus["open"]?.count ?? 0;
    const quoted = byStatus["quoted"]?.count ?? 0;
    const approved = byStatus["approved"]?.count ?? 0;
    const accepted = byStatus["accepted"]?.count ?? 0;
    const completed = byStatus["completed"]?.count ?? 0;
    const verified = byStatus["verified"]?.count ?? 0;
    const cancelled = byStatus["cancelled"]?.count ?? 0;

    const client = getOpenAIClient();
    const prompt = `
You are an AI branch-quote analyst. Provide 2-4 concise actions and one appreciation based on these metrics:
- Total branch quotes: ${totalQuotes}
- Open: ${open}, Quoted: ${quoted}, Approved: ${approved}, Accepted: ${accepted}
- Completed: ${completed}, Verified: ${verified}, Cancelled: ${cancelled}
Return strict JSON: { "actions": ["..."], "appreciation": "..." }.
Keep sentences short and actionable.
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
    console.error("GET /api/company/[companyId]/quotes/branch/ai-summary error", err);
    return NextResponse.json({ suggestions: [], appreciation: null, meta: { aiUsed: false, reason: "error" } });
  }
}
