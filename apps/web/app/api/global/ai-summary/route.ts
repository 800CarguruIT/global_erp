import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, canUseAi } from "@repo/ai-core";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";

type AnalyticsSnapshot = {
  companies: { total: number };
  leads: { sales: number; support: number; complaint: number };
  calls: { last24h: number };
  campaigns: { active: number };
};

async function getSnapshot(): Promise<AnalyticsSnapshot> {
  const sql = getSql();
  const companiesRes = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM companies WHERE is_active = true`;
  const leadsRes = await sql<{ lead_type: string | null; cnt: number }[]>`
    SELECT lead_type, COUNT(*)::int AS cnt
    FROM leads
    WHERE (scope = 'global' OR company_id IS NULL)
      AND COALESCE(lead_stage, '') <> 'archived'
    GROUP BY lead_type
  `;
  const callsRes = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM calls
    WHERE started_at >= now() - interval '24 hours'
  `;
  const campaignsRes = await sql<{ cnt: number }[]>`
    SELECT COUNT(*)::int AS cnt
    FROM campaigns
    WHERE status IN ('live','scheduled','draft')
  `;

  return {
    companies: { total: companiesRes?.[0]?.count ?? 0 },
    leads: {
      sales: leadsRes.find((l) => l.lead_type === "sales")?.cnt ?? 0,
      support:
        leadsRes.find((l) => l.lead_type === "support")?.cnt ??
        leadsRes.find((l) => l.lead_type === "recovery")?.cnt ??
        0,
      complaint:
        leadsRes.find((l) => l.lead_type === "complaint")?.cnt ??
        leadsRes.find((l) => l.lead_type === "rsa")?.cnt ??
        0,
    },
    calls: { last24h: callsRes?.[0]?.cnt ?? 0 },
    campaigns: { active: campaignsRes?.[0]?.cnt ?? 0 },
  };
}

export async function GET(req: NextRequest) {
  try {
    const search = new URL(req.url).searchParams;
    const lang = search.get("lang") || "en";

    const allowed = await canUseAi("ai.global.summary", {}).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const snapshot = await getSnapshot();
    const client = getOpenAIClient();
    const prompt = `
You are an AI assistant generating a brief status for a global ERP control center.
Use the provided metrics to create:
1) A short bullet list (2-4 items) of recommended actions.
2) One positive note (appreciation) about a recent good thing.
Keep it concise and in the target language.

Metrics:
- Companies total: ${snapshot.companies.total}
- Leads sales/support/complaint: ${snapshot.leads.sales}/${snapshot.leads.support}/${snapshot.leads.complaint}
- Calls last 24h: ${snapshot.calls.last24h}
- Active campaigns: ${snapshot.campaigns.active}

Target language: ${lang}

Return strict JSON: { "actions": ["..."], "appreciation": "..." }
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
    console.error("GET /api/global/ai-summary error", err);
    return NextResponse.json(
      { suggestions: [], appreciation: null, meta: { aiUsed: false, reason: "error" } },
      { status: 200 }
    );
  }
}
