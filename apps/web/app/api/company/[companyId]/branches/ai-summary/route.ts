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
    const allowed = await canUseAi("ai.branch.summary" as any, { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const sql = getSql();

    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const summaryUrl = new URL(`/api/company/${companyId}/branches/summary`, base).toString();
    const summaryRes = await fetch(summaryUrl, { cache: "no-store" });
    if (!summaryRes.ok) throw new Error("Failed to load branch summary");
    const summaryJson = await summaryRes.json();
    const totals = summaryJson?.totals ?? {
      branches: 0,
      users: 0,
      bays: 0,
      fleet: 0,
      leads: { assigned: 0, inprocess: 0, completed: 0 },
      checkedInCars: 0,
    };

    const client = getOpenAIClient();
    const prompt = `
You are an AI ops lead. Using the metrics below, propose 2-4 concise actions and 1 short appreciation.
Metrics:
- Branches: ${totals.branches}
- Users (employees + branch users): ${totals.users}
- Bays: ${totals.bays}
- Fleet: ${totals.fleet}
- Leads assigned/in-process/completed: ${totals.leads.assigned}/${totals.leads.inprocess}/${totals.leads.completed}
- Checked-in cars (work orders queued/in-progress): ${totals.checkedInCars}
Return strict JSON: { "actions": ["..."], "appreciation": "..." } with brief, actionable text.
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
    console.error("GET /api/company/[companyId]/branches/ai-summary error", err);
    return NextResponse.json({ suggestions: [], appreciation: null, totals: null, meta: { aiUsed: false, reason: "error" } });
  }
}
