import { getSql } from "../db";
import type { AdvisorScore, PisConfig } from "./types";

export async function getAdvisorScores(companyId: string): Promise<AdvisorScore[]> {
  const sql = getSql();
  const rows = await sql<{
    advisor_user_id: string; full_name: string; composite_score: number;
    conversion_rate: number; gp_pct: number; revenue: number;
    paid_pct: number; foc_pct: number; sla_compliance: number;
    call_quality: number; customer_sat: number; tier: string;
    rank: number; score_breakdown: Record<string, number>;
  }[]>`
    SELECT s.*, u.full_name
    FROM pis_advisor_scores s
    JOIN users u ON u.id = s.advisor_user_id
    WHERE s.company_id = ${companyId}
      AND s.period_end = (SELECT MAX(period_end) FROM pis_advisor_scores WHERE company_id = ${companyId})
    ORDER BY s.composite_score DESC
  `;
  return rows.map((r, i) => ({
    advisorUserId: r.advisor_user_id,
    advisorName: r.full_name,
    compositeScore: Number(r.composite_score),
    conversionRate: Number(r.conversion_rate),
    gpPct: Number(r.gp_pct),
    revenue: Number(r.revenue),
    paidPct: Number(r.paid_pct),
    focPct: Number(r.foc_pct),
    slaCompliance: Number(r.sla_compliance),
    callQuality: Number(r.call_quality),
    customerSat: Number(r.customer_sat),
    tier: r.tier as "ELITE" | "STANDARD",
    rank: i + 1,
    scoreBreakdown: r.score_breakdown ?? {},
  }));
}

export async function computeAndStoreScores(companyId: string, config: PisConfig): Promise<AdvisorScore[]> {
  const sql = getSql();
  const weights = config.score_weights;
  const tiers = config.tier_boundaries;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = now;

  // Get advisors: active employees in Service Center Sales Department
  const advisors = await sql<{ user_id: string; employee_id: string; full_name: string }[]>`
    SELECT u.id as user_id, u.employee_id, e.full_name
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    WHERE e.company_id = ${companyId}
      AND u.is_active = true
      AND u.employee_id IS NOT NULL
      AND e.department = 'Service Center Sales Department'
  `;

  if (!advisors.length) return [];

  const scores: AdvisorScore[] = [];
  for (const adv of advisors) {
    const [leadsRes, revenueRes, callRes, estimateRes] = await Promise.all([
      // Leads: use agent_employee_id, lead_status
      sql<{ total_leads: number; converted: number }[]>`
        SELECT COUNT(*)::int as total_leads,
               COUNT(*) FILTER (WHERE lead_status IN ('closed_won','completed','car_in'))::int as converted
        FROM leads WHERE company_id = ${companyId} AND agent_employee_id = ${adv.employee_id}
          AND created_at >= ${periodStart}
      `,
      // Revenue: invoices via leads.agent_employee_id
      sql<{ total_revenue: number; total_cost: number; foc_count: number; paid_count: number; total_invoices: number }[]>`
        SELECT COALESCE(SUM(i.grand_total),0)::numeric as total_revenue,
               COALESCE(SUM(est.total_cost),0)::numeric as total_cost,
               COUNT(*) FILTER (WHERE i.grand_total = 0)::int as foc_count,
               COUNT(*) FILTER (WHERE i.paid_at IS NOT NULL)::int as paid_count,
               COUNT(*)::int as total_invoices
        FROM invoices i
        LEFT JOIN estimates est ON est.id = i.estimate_id
        JOIN leads l ON l.id = i.lead_id
        WHERE i.company_id = ${companyId} AND l.agent_employee_id = ${adv.employee_id}
          AND i.created_at >= ${periodStart}
      `,
      // Calls: use created_by_user_id (this IS a user_id)
      sql<{ total_calls: number; completed_calls: number }[]>`
        SELECT COUNT(*)::int as total_calls,
               COUNT(*) FILTER (WHERE status = 'completed')::int as completed_calls
        FROM call_sessions
        WHERE company_id = ${companyId} AND created_by_user_id = ${adv.user_id}
          AND created_at >= ${periodStart}
      `,
      // Estimates: join via leads.agent_employee_id
      sql<{ total_estimates: number; approved: number }[]>`
        SELECT COUNT(*)::int as total_estimates,
               COUNT(*) FILTER (WHERE LOWER(est.status) IN ('approved','invoiced'))::int as approved
        FROM estimates est
        JOIN leads l ON l.id = est.lead_id
        WHERE est.company_id = ${companyId} AND l.agent_employee_id = ${adv.employee_id}
          AND est.created_at >= ${periodStart}
      `,
    ]);

    const leads = leadsRes[0] ?? { total_leads: 0, converted: 0 };
    const rev = revenueRes[0] ?? { total_revenue: 0, total_cost: 0, foc_count: 0, paid_count: 0, total_invoices: 0 };
    const calls = callRes[0] ?? { total_calls: 0, completed_calls: 0 };
    const est = estimateRes[0] ?? { total_estimates: 0, approved: 0 };

    const convRate = leads.total_leads > 0 ? (leads.converted / leads.total_leads) * 100 : 0;
    const totalRev = Number(rev.total_revenue);
    const totalCost = Number(rev.total_cost);
    const gpPct = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
    const focPct = rev.total_invoices > 0 ? (rev.foc_count / rev.total_invoices) * 100 : 0;
    const paidPct = rev.total_invoices > 0 ? (rev.paid_count / rev.total_invoices) * 100 : 0;
    const callQual = calls.total_calls > 0 ? (calls.completed_calls / calls.total_calls) * 100 : 0;
    const slaComp = est.total_estimates > 0 ? (est.approved / est.total_estimates) * 100 : 0;

    // Customer satisfaction: use lead health_score avg if available, else call completion as proxy
    const custSatRaw = calls.total_calls > 0
      ? Math.min((calls.completed_calls / calls.total_calls) * 100, 100)
      : (leads.total_leads > 0 ? 60 : 50);

    const normalized = {
      conversion_rate: Math.min(convRate, 100),
      gp_pct: Math.min(Math.max(gpPct, 0), 100),
      revenue: Math.min((totalRev / 100000) * 100, 100),
      sla_compliance: Math.min(slaComp, 100),
      customer_satisfaction: custSatRaw,
      call_quality: Math.min(callQual, 100),
      foc_penalty: Math.min(focPct, 100),
    };

    const composite =
      (normalized.conversion_rate * weights.conversion_rate +
      normalized.gp_pct * weights.gp_pct +
      normalized.revenue * weights.revenue +
      normalized.sla_compliance * weights.sla_compliance +
      normalized.customer_satisfaction * weights.customer_satisfaction +
      normalized.call_quality * weights.call_quality +
      normalized.foc_penalty * weights.foc_penalty) / 100;

    const tier: "ELITE" | "STANDARD" = composite >= tiers.elite_min_score ? "ELITE" : "STANDARD";

    scores.push({
      advisorUserId: adv.user_id,
      advisorName: adv.full_name,
      compositeScore: Math.round(composite * 100) / 100,
      conversionRate: Math.round(convRate * 100) / 100,
      gpPct: Math.round(gpPct * 100) / 100,
      revenue: totalRev,
      paidPct: Math.round(paidPct * 100) / 100,
      focPct: Math.round(focPct * 100) / 100,
      slaCompliance: Math.round(slaComp * 100) / 100,
      callQuality: Math.round(callQual * 100) / 100,
      customerSat: Math.round(custSatRaw * 100) / 100,
      tier,
      rank: 0,
      scoreBreakdown: normalized,
    });
  }

  scores.sort((a, b) => b.compositeScore - a.compositeScore);
  scores.forEach((s, i) => (s.rank = i + 1));

  for (const s of scores) {
    await sql`
      INSERT INTO pis_advisor_scores (company_id, advisor_user_id, composite_score, conversion_rate, gp_pct, revenue, paid_pct, foc_pct, sla_compliance, call_quality, customer_sat, tier, rank, score_breakdown, period_start, period_end)
      VALUES (${companyId}, ${s.advisorUserId}, ${s.compositeScore}, ${s.conversionRate}, ${s.gpPct}, ${s.revenue}, ${s.paidPct}, ${s.focPct}, ${s.slaCompliance}, ${s.callQuality}, ${s.customerSat}, ${s.tier}, ${s.rank}, ${JSON.stringify(s.scoreBreakdown)}::jsonb, ${periodStart.toISOString().slice(0, 10)}, ${periodEnd.toISOString().slice(0, 10)})
      ON CONFLICT (company_id, advisor_user_id, period_start, period_end)
      DO UPDATE SET composite_score = EXCLUDED.composite_score, conversion_rate = EXCLUDED.conversion_rate, gp_pct = EXCLUDED.gp_pct, revenue = EXCLUDED.revenue, paid_pct = EXCLUDED.paid_pct, foc_pct = EXCLUDED.foc_pct, sla_compliance = EXCLUDED.sla_compliance, call_quality = EXCLUDED.call_quality, customer_sat = EXCLUDED.customer_sat, tier = EXCLUDED.tier, rank = EXCLUDED.rank, score_breakdown = EXCLUDED.score_breakdown, computed_at = now()
    `;
  }

  return scores;
}
