import { NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export async function GET() {
  try {
    const sql = getSql();

    const companiesCountRes = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM companies WHERE is_active = true
    `;
    const companiesCount = companiesCountRes?.[0]?.count ?? 0;

    const leadCounts = await sql<{ lead_type: string | null; cnt: number }[]>`
      SELECT lead_type, COUNT(*)::int AS cnt
      FROM leads
      WHERE (scope = 'global' OR company_id IS NULL)
        AND COALESCE(lead_stage, '') <> 'archived'
      GROUP BY lead_type
    `;

    const leads = {
      sales: leadCounts.find((l) => l.lead_type === "sales")?.cnt ?? 0,
      support:
        leadCounts.find((l) => l.lead_type === "support")?.cnt ??
        leadCounts.find((l) => l.lead_type === "recovery")?.cnt ??
        0,
      complaint:
        leadCounts.find((l) => l.lead_type === "complaint")?.cnt ??
        leadCounts.find((l) => l.lead_type === "rsa")?.cnt ??
        0,
    };

    const subCounts = await sql<{ category: string | null; cnt: number }[]>`
      SELECT category, COUNT(*)::int AS cnt
      FROM global_subscriptions
      GROUP BY category
    `;

    const subscriptions = {
      trials: subCounts.find((s) => s.category === "trial")?.cnt ?? 0,
      active: subCounts.find((s) => s.category === "active")?.cnt ?? 0,
      expiring: subCounts.find((s) => s.category === "expiring")?.cnt ?? 0,
      expired: subCounts.find((s) => s.category === "expired")?.cnt ?? 0,
      offboarded: subCounts.find((s) => s.category === "offboarded")?.cnt ?? 0,
      renewals: subCounts.find((s) => s.category === "expiring")?.cnt ?? 0,
    };

    const agentsActiveRes = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM agents WHERE is_active = true
    `;
    const agentsActive = agentsActiveRes?.[0]?.count ?? 0;

    const callCounts = await sql<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt
      FROM calls
      WHERE started_at >= now() - interval '24 hours'
    `;

    const campaignCounts = await sql<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt
      FROM campaigns
      WHERE status IN ('live','scheduled','draft')
    `;

    return NextResponse.json({
      companies: { total: companiesCount },
      subscriptions,
      leads,
      calls: { last24h: callCounts?.[0]?.cnt ?? 0 },
      campaigns: { active: campaignCounts?.[0]?.cnt ?? 0 },
      agents: { active: agentsActive, topName: null, topConversions: 0, avgResponseMins: null },
    });
  } catch (error) {
    console.error("GET /api/global/analytics error", error);
    return NextResponse.json(
      {
        companies: { total: 0 },
        subscriptions: { active: 0, expiring: 0, expired: 0, offboarded: 0, renewals: 0, trials: 0 },
        leads: { sales: 0, support: 0, complaint: 0 },
        calls: { last24h: 0 },
        campaigns: { active: 0 },
        agents: { active: 0, topName: null, topConversions: 0, avgResponseMins: null },
      },
      { status: 200 }
    );
  }
}
