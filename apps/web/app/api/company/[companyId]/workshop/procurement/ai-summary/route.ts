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
    const allowed = await canUseAi("ai.procurement.summary" as any, { companyId }).catch(() => true);
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
      SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(total_cost),0)::numeric AS total_cost
      FROM purchase_orders
      WHERE company_id = ${companyId}
      GROUP BY status
    `;

    const totals = Object.fromEntries(
      (statusAgg as any[]).map((r) => [
        r.status,
        { count: Number(r.cnt ?? 0), total: Number(r.total_cost ?? 0) },
      ])
    );

    const openStatuses = ["draft", "issued", "partially_received"];
    const openTotal = openStatuses.reduce((sum, key) => sum + (totals[key]?.total ?? 0), 0);
    const openCount = openStatuses.reduce((sum, key) => sum + (totals[key]?.count ?? 0), 0);
    const receivedCount = totals["received"]?.count ?? 0;
    const cancelledCount = totals["cancelled"]?.count ?? 0;
    const totalPo = Object.values(totals).reduce((sum, v: any) => sum + (v?.count ?? 0), 0);

    const client = getOpenAIClient();
    const prompt = `
You are an AI procurement planner. Using the metrics below, propose 2-4 short recommended actions and 1 appreciation.
Metrics:
- Total POs: ${totalPo}
- Open POs (draft/issued/partial): ${openCount} | Open amount: ${openTotal}
- Received POs: ${receivedCount}
- Cancelled POs: ${cancelledCount}
Return strict JSON: { "actions": ["..."], "appreciation": "..." }
Keep sentences concise and actionable.
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
    console.error("GET /api/company/[companyId]/workshop/procurement/ai-summary error", err);
    return NextResponse.json({ suggestions: [], appreciation: null, meta: { aiUsed: false, reason: "error" } });
  }
}
