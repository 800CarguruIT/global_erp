import { getSql } from "../db";
import type {
  RccFilter, RccKpi, LeadSourceDistribution, PipelineStage,
  AgentLeaderboardEntry, HeatmapCell, LeadSourcePerformance,
  StageConversionRow, LeakageStage, MarketingSpend,
} from "./types";

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

// ────────────────────────────────────────────
// Tab 1: Overview KPIs
// Revenue is primarily in estimates (102M+), not invoices (only 3)
// ────────────────────────────────────────────

export async function getOverviewKpis(filter: RccFilter): Promise<RccKpi[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [revRow, leadRow, completedRow, spendRow] = await Promise.all([
    // Revenue = estimates grand_total (main revenue source)
    sql<{ total: number; invoiced: number }[]>`
      SELECT COALESCE(SUM(grand_total),0)::numeric as total,
             COALESCE(SUM(grand_total) FILTER (WHERE LOWER(status) = 'invoiced'),0)::numeric as invoiced
      FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
    sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM leads WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
    // Completed leads = converted (Job Completed + Completed + Car Out)
    sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM leads WHERE company_id=${companyId}
        AND lead_stage IN ('Completed','Job Completed','Car Out','Invoice Created')
        AND created_at BETWEEN ${from} AND ${to}`,
    sql<{ total: number }[]>`
      SELECT COALESCE(SUM(spend_amount),0)::numeric as total
      FROM rcc_marketing_spend WHERE company_id=${companyId}
        AND period_start >= ${from} AND period_end <= ${to}`,
  ]);

  const totalRevenue = Number(revRow[0]?.total ?? 0);
  const invoicedRevenue = Number(revRow[0]?.invoiced ?? 0);
  const totalLeads = Number(leadRow[0]?.count ?? 0);
  const completedCount = Number(completedRow[0]?.count ?? 0);
  const totalSpend = Number(spendRow[0]?.total ?? 0);
  const rpl = totalLeads === 0 ? 0 : Math.round(totalRevenue / totalLeads);
  const convRate = pct(completedCount, totalLeads);
  const cpa = completedCount === 0 ? 0 : Math.round(totalSpend / completedCount);
  const leakage = Math.round(totalRevenue - invoicedRevenue);

  return [
    { label: "Total Revenue", value: totalRevenue, formatted: `AED ${totalRevenue.toLocaleString()}` },
    { label: "Revenue Per Lead", value: rpl, formatted: `AED ${rpl.toLocaleString()}` },
    { label: "Lead → Sale Rate", value: convRate, formatted: `${convRate}%` },
    { label: "Cost Per Acquisition", value: cpa, formatted: `AED ${cpa.toLocaleString()}` },
    { label: "Revenue Leakage", value: leakage, formatted: `AED ${leakage.toLocaleString()}` },
  ];
}

// ────────────────────────────────────────────
// Lead Source Distribution (donut)
// ────────────────────────────────────────────

export async function getLeadSourceDistribution(filter: RccFilter): Promise<LeadSourceDistribution[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const rows = await sql<{ source: string; count: number }[]>`
    SELECT COALESCE(source, 'other') as source, COUNT(*)::int as count
    FROM leads
    WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    GROUP BY COALESCE(source, 'other')
    ORDER BY count DESC
  `;

  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.map(r => ({
    source: r.source,
    count: r.count,
    pct: Math.round((r.count / total) * 1000) / 10,
  }));
}

// ────────────────────────────────────────────
// Pipeline Funnel (8 stages based on lead_stage)
//
// Actual lead_stage values:
//   New Lead → Accepted → Car In → Estimate Created →
//   Job Started → Job Completed → Invoice Created → Completed/Car Out
// ────────────────────────────────────────────

export async function getPipelineFunnel(filter: RccFilter): Promise<PipelineStage[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  // Count leads that reached each stage (cumulative — if a lead is at "Job Completed", it passed through all prior stages)
  const stageGroups = {
    "New Lead": ["New Lead","Accepted","Dispatched","Reached","Car In","Estimate Created","Estimate Pending","Estimate Requested","Job Card","Job Started","Parts Ordered","Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed","DCC","Contract","Started","Inspection Started","Inspection Created","Inspection Pending","Dropped Off","Picked Up","PickedUp","Dropoff"],
    "Contacted": ["Accepted","Dispatched","Reached","Car In","Estimate Created","Estimate Pending","Estimate Requested","Job Card","Job Started","Parts Ordered","Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed","DCC","Contract","Started"],
    "Qualified": ["Accepted","Car In","Estimate Created","Estimate Pending","Estimate Requested","Job Card","Job Started","Parts Ordered","Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed","DCC","Contract"],
    "Estimate Sent": ["Estimate Created","Estimate Pending","Job Card","Job Started","Parts Ordered","Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed","DCC"],
    "Booked / Car In": ["Car In","Job Card","Job Started","Parts Ordered","Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed","DCC"],
    "Job Completed": ["Job Completed","Invoice Created","Ready to Release","Final Inspection Pending","Car Out","Completed"],
    "Invoiced": ["Invoice Created","Car Out","Completed"],
    "Completed": ["Car Out","Completed"],
  };

  const queries = Object.entries(stageGroups).map(([, stages]) =>
    sql<{ count: number }[]>`
      SELECT COUNT(*)::int as count FROM leads
      WHERE company_id=${companyId} AND lead_stage IN ${sql(stages)}
      AND created_at BETWEEN ${from} AND ${to}`
  );

  // Revenue at estimate and invoice stages
  const [estRev, invRev] = await Promise.all([
    sql<{ aed: number }[]>`
      SELECT COALESCE(SUM(grand_total),0)::numeric as aed
      FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
    sql<{ aed: number }[]>`
      SELECT COALESCE(SUM(grand_total),0)::numeric as aed
      FROM invoices WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
  ]);

  const results = await Promise.all(queries);
  const counts = results.map(r => r[0]?.count ?? 0);
  const labels = Object.keys(stageGroups);

  const aeds = [0, 0, 0, Number(estRev[0]?.aed ?? 0), 0, 0, Number(invRev[0]?.aed ?? 0), 0];

  return labels.map((label, i) => {
    const prev = i === 0 ? counts[0] : counts[i - 1];
    const lost = Math.max(0, prev - counts[i]);
    const dropPct = prev === 0 ? 0 : Math.round((lost / prev) * 1000) / 10;
    return { stage: i + 1, label, count: counts[i], aedValue: aeds[i], dropPct, leadsLost: lost };
  });
}

// ────────────────────────────────────────────
// Agent Leaderboard
// Sales agents = active employees in 'RSA Sales Department'
// ────────────────────────────────────────────

export async function getAgentLeaderboard(filter: RccFilter): Promise<AgentLeaderboardEntry[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  // List all active RSA Sales Department employees with their lead/revenue metrics
  const rows = await sql<{
    employee_id: string; agent_name: string; department: string;
    lead_count: number; completed_count: number; revenue: number;
  }[]>`
    SELECT
      e.id as employee_id,
      e.full_name as agent_name,
      e.department,
      COUNT(DISTINCT l.id)::int as lead_count,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Job Completed','Invoice Created','Car Out','Completed'))::int as completed_count,
      COALESCE(SUM(est.grand_total),0)::numeric as revenue
    FROM employees e
    LEFT JOIN leads l ON l.agent_employee_id = e.id
      AND l.company_id = ${companyId}
      AND l.created_at BETWEEN ${from} AND ${to}
    LEFT JOIN estimates est ON est.lead_id = l.id
    WHERE e.company_id = ${companyId}
      AND e.department = 'RSA Sales Department'
      AND e.status = 'active'
    GROUP BY e.id, e.full_name, e.department
    ORDER BY revenue DESC, e.full_name ASC
  `;

  return rows.map((r, i) => ({
    rank: i + 1,
    agentUserId: r.employee_id,
    agentName: r.agent_name,
    department: r.department,
    leadCount: r.lead_count,
    conversionPct: pct(r.completed_count, r.lead_count),
    revenue: Number(r.revenue),
    rpl: r.lead_count === 0 ? 0 : Math.round(Number(r.revenue) / r.lead_count),
  }));
}

// ────────────────────────────────────────────
// Revenue Heatmap (day × hour) — from estimates
// ────────────────────────────────────────────

export async function getRevenueHeatmap(filter: RccFilter): Promise<HeatmapCell[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const rows = await sql<{ day: number; hour: number; revenue: number }[]>`
    SELECT
      EXTRACT(DOW FROM created_at)::int as day,
      EXTRACT(HOUR FROM created_at)::int as hour,
      COALESCE(SUM(grand_total),0)::numeric as revenue
    FROM estimates
    WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    GROUP BY day, hour
    ORDER BY day, hour
  `;

  return rows.map(r => ({ day: r.day, hour: r.hour, revenue: Number(r.revenue) }));
}

// ────────────────────────────────────────────
// Tab 2: Lead Source Performance (end-to-end)
// ────────────────────────────────────────────

export async function getLeadSourcePerformance(filter: RccFilter): Promise<LeadSourcePerformance[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const rows = await sql<{
    source: string; leads: number; qualified: number; booked: number;
    showed: number; converted: number; revenue: number;
  }[]>`
    SELECT
      COALESCE(l.source, 'other') as source,
      COUNT(DISTINCT l.id)::int as leads,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Accepted','Car In','Estimate Created','Estimate Pending','Job Card','Job Started','Parts Ordered','Job Completed','Invoice Created','Car Out','Completed','DCC','Contract'))::int as qualified,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Car In','Job Card','Job Started','Parts Ordered','Job Completed','Invoice Created','Car Out','Completed','DCC'))::int as booked,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Job Completed','Invoice Created','Car Out','Completed'))::int as showed,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Invoice Created','Car Out','Completed'))::int as converted,
      COALESCE(SUM(est.grand_total),0)::numeric as revenue
    FROM leads l
    LEFT JOIN estimates est ON est.lead_id = l.id
    WHERE l.company_id=${companyId} AND l.created_at BETWEEN ${from} AND ${to}
    GROUP BY COALESCE(l.source, 'other')
    ORDER BY revenue DESC
  `;

  const spendRows = await sql<{ source: string; spend: number }[]>`
    SELECT source, COALESCE(SUM(spend_amount),0)::numeric as spend
    FROM rcc_marketing_spend
    WHERE company_id=${companyId} AND period_start >= ${from} AND period_end <= ${to}
    GROUP BY source
  `;
  const spendMap = new Map(spendRows.map(s => [s.source, Number(s.spend)]));

  return rows.map(r => {
    const rev = Number(r.revenue);
    const spend = spendMap.get(r.source) ?? 0;
    return {
      source: r.source,
      leads: r.leads,
      qualified: r.qualified,
      booked: r.booked,
      showed: r.showed,
      converted: r.converted,
      revenue: rev,
      rpl: r.leads === 0 ? 0 : Math.round(rev / r.leads),
      cpa: r.converted === 0 ? 0 : Math.round(spend / r.converted),
      roi: spend === 0 ? 0 : Math.round(((rev - spend) / spend) * 100),
    };
  });
}

// ────────────────────────────────────────────
// Tab 3: Source → Stage Conversion Matrix
// ────────────────────────────────────────────

export async function getConversionMatrix(filter: RccFilter): Promise<StageConversionRow[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const rows = await sql<{
    source: string; leads: number; qualified: number; booked: number;
    showed: number; converted: number;
  }[]>`
    SELECT
      COALESCE(l.source, 'other') as source,
      COUNT(DISTINCT l.id)::int as leads,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Accepted','Car In','Estimate Created','Estimate Pending','Job Card','Job Started','Parts Ordered','Job Completed','Invoice Created','Car Out','Completed','DCC','Contract'))::int as qualified,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Car In','Job Card','Job Started','Parts Ordered','Job Completed','Invoice Created','Car Out','Completed','DCC'))::int as booked,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Job Completed','Invoice Created','Car Out','Completed'))::int as showed,
      COUNT(DISTINCT l.id) FILTER (WHERE l.lead_stage IN ('Invoice Created','Car Out','Completed'))::int as converted
    FROM leads l
    WHERE l.company_id=${companyId} AND l.created_at BETWEEN ${from} AND ${to}
    GROUP BY COALESCE(l.source, 'other')
    ORDER BY leads DESC
  `;

  return rows.map(r => ({
    source: r.source,
    leadToQual: pct(r.qualified, r.leads),
    qualToBook: pct(r.booked, r.qualified),
    bookToShow: pct(r.showed, r.booked),
    showToSale: pct(r.converted, r.showed),
    endToEnd: pct(r.converted, r.leads),
  }));
}

// ────────────────────────────────────────────
// Tab 4: Leakage by Stage
// ────────────────────────────────────────────

export async function getLeakageByStage(filter: RccFilter): Promise<LeakageStage[]> {
  const pipeline = await getPipelineFunnel(filter);
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [avgRow] = await sql<{ avg: number }[]>`
    SELECT COALESCE(AVG(grand_total),0)::numeric as avg
    FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to} AND grand_total > 0
  `;
  const avgDeal = Number(avgRow?.avg ?? 0);

  const causes = [
    { cause: "No follow-up / slow response", fix: "Auto-assign + 60-sec SLA" },
    { cause: "Poor qualification script", fix: "Script overhaul + AI scoring" },
    { cause: "No urgency / weak close", fix: "Same-day booking incentive" },
    { cause: "No-show / no confirmation", fix: "Triple-touch confirmation flow" },
    { cause: "Job incomplete / quality issue", fix: "QC checklist before release" },
    { cause: "Invoice not created", fix: "Auto-invoice on job completion" },
    { cause: "Payment delay / dispute", fix: "Instant payment + follow-up" },
  ];

  const stages: LeakageStage[] = [];
  for (let i = 0; i < pipeline.length - 1; i++) {
    const lost = pipeline[i + 1].leadsLost;
    if (lost <= 0) continue;
    const c = causes[i] ?? { cause: "Unknown", fix: "Investigate" };
    stages.push({
      fromStage: pipeline[i].label,
      toStage: pipeline[i + 1].label,
      cause: c.cause,
      leadsLost: lost,
      aedLost: Math.round(lost * avgDeal),
      suggestedFix: c.fix,
    });
  }

  return stages.sort((a, b) => b.aedLost - a.aedLost);
}

// ────────────────────────────────────────────
// Marketing Spend CRUD
// ────────────────────────────────────────────

export async function getMarketingSpend(filter: RccFilter): Promise<MarketingSpend[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const rows = await sql<any[]>`
    SELECT id, company_id, source, period_start, period_end, spend_amount, currency, notes
    FROM rcc_marketing_spend
    WHERE company_id=${companyId} AND period_start >= ${from} AND period_end <= ${to}
    ORDER BY period_start DESC, source
  `;

  return rows.map(r => ({
    id: r.id,
    companyId: r.company_id,
    source: r.source,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    spendAmount: Number(r.spend_amount),
    currency: r.currency,
    notes: r.notes,
  }));
}

export async function upsertMarketingSpend(
  companyId: string, source: string, periodStart: string, periodEnd: string,
  spendAmount: number, currency: string, notes: string | null, userId: string,
) {
  const sql = getSql();
  await sql`
    INSERT INTO rcc_marketing_spend (company_id, source, period_start, period_end, spend_amount, currency, notes, created_by_user_id)
    VALUES (${companyId}, ${source}, ${periodStart}, ${periodEnd}, ${spendAmount}, ${currency}, ${notes}, ${userId})
    ON CONFLICT (company_id, source, period_start, period_end)
    DO UPDATE SET spend_amount = EXCLUDED.spend_amount, currency = EXCLUDED.currency,
                  notes = EXCLUDED.notes, updated_at = now()
  `;
}
