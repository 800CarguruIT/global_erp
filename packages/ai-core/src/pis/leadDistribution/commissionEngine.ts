import { getSql } from "../../db";
import { getConfig } from "../configRepository";
import { getAdvisorScores } from "../advisorRepository";
import type { CommissionRecord } from "../types";

export async function computeCommissions(companyId: string): Promise<CommissionRecord[]> {
  const sql = getSql();
  const config = await getConfig(companyId);
  const advisors = await getAdvisorScores(companyId);
  const rates = config.commission_rates;
  const now = new Date();
  const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const results: CommissionRecord[] = [];

  for (const adv of advisors) {
    // Get the employee_id for this user
    const [userRow] = await sql<{ employee_id: string | null }[]>`
      SELECT employee_id FROM users WHERE id = ${adv.advisorUserId}
    `;
    const empId = userRow?.employee_id;

    const [revRow] = await sql<{ revenue: number; cost: number; foc_count: number }[]>`
      SELECT COALESCE(SUM(i.grand_total),0)::numeric as revenue,
             COALESCE(SUM(est.total_cost),0)::numeric as cost,
             COUNT(*) FILTER (WHERE i.grand_total = 0)::int as foc_count
      FROM invoices i
      LEFT JOIN estimates est ON est.id = i.estimate_id
      JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId} AND l.agent_employee_id = ${empId}
        AND i.created_at >= ${periodMonth}
    `;

    const revenue = Number(revRow?.revenue ?? 0);
    const cost = Number(revRow?.cost ?? 0);
    const gp = revenue - cost;
    const gpPct = revenue > 0 ? (gp / revenue) * 100 : 0;
    const focCount = revRow?.foc_count ?? 0;

    let effectivePct = rates.base_pct;
    let performancePct = 0;
    if (adv.tier === "ELITE" && gpPct >= rates.gp_floor_pct) {
      if (adv.rank <= 3) {
        effectivePct = rates.top_pct;
        performancePct = rates.top_pct - rates.base_pct;
      } else {
        effectivePct = rates.performance_pct;
        performancePct = rates.performance_pct - rates.base_pct;
      }
    }

    const focDeduction = focCount * rates.foc_penalty_per_unit;
    const commissionAmount = Math.max((revenue * effectivePct / 100) - focDeduction, 0);

    await sql`
      INSERT INTO pis_commission_records (company_id, advisor_user_id, period_month, base_commission_pct, performance_pct, effective_pct, revenue_base, gp_base, foc_deduction, commission_amount, detail)
      VALUES (${companyId}, ${adv.advisorUserId}, ${periodMonth.toISOString().slice(0, 10)}, ${rates.base_pct}, ${performancePct}, ${effectivePct}, ${revenue}, ${gp}, ${focDeduction}, ${commissionAmount}, ${JSON.stringify({ gpPct, focCount, rank: adv.rank, tier: adv.tier })}::jsonb)
      ON CONFLICT (company_id, advisor_user_id, period_month)
      DO UPDATE SET base_commission_pct = EXCLUDED.base_commission_pct, performance_pct = EXCLUDED.performance_pct, effective_pct = EXCLUDED.effective_pct, revenue_base = EXCLUDED.revenue_base, gp_base = EXCLUDED.gp_base, foc_deduction = EXCLUDED.foc_deduction, commission_amount = EXCLUDED.commission_amount, detail = EXCLUDED.detail, computed_at = now()
    `;

    results.push({
      advisorUserId: adv.advisorUserId, advisorName: adv.advisorName, tier: adv.tier,
      basePct: rates.base_pct, performancePct, effectivePct, revenueBase: revenue,
      gpBase: gp, focDeduction, commissionAmount,
    });
  }

  return results;
}

export async function getCommissions(companyId: string): Promise<CommissionRecord[]> {
  const sql = getSql();
  const now = new Date();
  const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await sql<any[]>`
    SELECT cr.*, u.full_name as advisor_name, s.tier
    FROM pis_commission_records cr
    JOIN users u ON u.id = cr.advisor_user_id
    LEFT JOIN pis_advisor_scores s ON s.advisor_user_id = cr.advisor_user_id AND s.company_id = cr.company_id
      AND s.period_end = (SELECT MAX(period_end) FROM pis_advisor_scores WHERE company_id = ${companyId})
    WHERE cr.company_id = ${companyId} AND cr.period_month = ${periodMonth.toISOString().slice(0, 10)}
    ORDER BY cr.commission_amount DESC
  `;

  return rows.map(r => ({
    advisorUserId: r.advisor_user_id, advisorName: r.advisor_name,
    tier: (r.tier ?? "STANDARD") as "ELITE" | "STANDARD",
    basePct: Number(r.base_commission_pct), performancePct: Number(r.performance_pct),
    effectivePct: Number(r.effective_pct), revenueBase: Number(r.revenue_base),
    gpBase: Number(r.gp_base), focDeduction: Number(r.foc_deduction),
    commissionAmount: Number(r.commission_amount),
  }));
}