import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  const [byStage, byStatus, slaStats] = await Promise.all([
    sql<{ lead_stage: string; cnt: number }[]>`
      SELECT lead_stage, COUNT(*)::int AS cnt
      FROM leads
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${from} AND ${to}
        AND lead_stage IS NOT NULL
      GROUP BY lead_stage
    `,
    sql<{ lead_status: string; cnt: number }[]>`
      SELECT lead_status, COUNT(*)::int AS cnt
      FROM leads
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY lead_status
    `,
    sql<{ total: number; responded: number; avg_response_min: number | null; sla_breaches: number }[]>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE first_response_at IS NOT NULL)::int AS responded,
        AVG(
          EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0
        ) FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_min,
        COUNT(*) FILTER (
          WHERE sla_minutes IS NOT NULL
            AND first_response_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0 > sla_minutes
        )::int AS sla_breaches
      FROM leads
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${from} AND ${to}
    `,
  ]);

  const windowDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const stats = slaStats[0] ?? { total: 0, responded: 0, avg_response_min: null, sla_breaches: 0 };

  return {
    window_days: windowDays,
    total_leads: stats.total,
    by_stage: Object.fromEntries(byStage.map((r) => [r.lead_stage, r.cnt])),
    by_status: Object.fromEntries(byStatus.map((r) => [r.lead_status, r.cnt])),
    responded_count: stats.responded,
    avg_first_response_min: stats.avg_response_min != null ? Math.round(Number(stats.avg_response_min)) : null,
    sla_breach_count: stats.sla_breaches,
    response_rate_pct: stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0,
  };
}
