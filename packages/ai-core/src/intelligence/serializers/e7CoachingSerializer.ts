import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  const thirtyDaysAgo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [last30, last7, callStats30] = await Promise.all([
    sql<{
      agent_id: string;
      leads_count: number;
      won_count: number;
      avg_response_min: number | null;
      avg_health: number | null;
    }[]>`
      SELECT
        agent_employee_id AS agent_id,
        COUNT(*)::int AS leads_count,
        COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won_count,
        AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0)
          FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_min,
        AVG(health_score) AS avg_health
      FROM leads
      WHERE company_id = ${companyId}
        AND agent_employee_id IS NOT NULL
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY agent_employee_id
    `,
    sql<{
      agent_id: string;
      leads_count: number;
      won_count: number;
      avg_response_min: number | null;
    }[]>`
      SELECT
        agent_employee_id AS agent_id,
        COUNT(*)::int AS leads_count,
        COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won_count,
        AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0)
          FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_min
      FROM leads
      WHERE company_id = ${companyId}
        AND agent_employee_id IS NOT NULL
        AND created_at BETWEEN ${sevenDaysAgo} AND ${to}
      GROUP BY agent_employee_id
    `,
    sql<{
      agent_id: string;
      call_count: number;
      completed: number;
      avg_duration_sec: number | null;
    }[]>`
      SELECT
        created_by_user_id AS agent_id,
        COUNT(*)::int AS call_count,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL) AS avg_duration_sec
      FROM call_sessions
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY created_by_user_id
    `,
  ]);

  const map7 = new Map(last7.map((a) => [a.agent_id, a]));
  const callMap = new Map(callStats30.map((c) => [c.agent_id, c]));

  // Compute company averages from 30d baseline
  const companyAvgWonRate =
    last30.length > 0
      ? last30.reduce((s, a) => s + (a.leads_count > 0 ? a.won_count / a.leads_count : 0), 0) / last30.length
      : 0;
  const companyAvgResponse =
    last30.filter((a) => a.avg_response_min != null).length > 0
      ? last30
          .filter((a) => a.avg_response_min != null)
          .reduce((s, a) => s + Number(a.avg_response_min), 0) /
        last30.filter((a) => a.avg_response_min != null).length
      : null;

  const agents = last30.map((a) => {
    const a7 = map7.get(a.agent_id);
    const calls = callMap.get(a.agent_id);

    const wonRate30 = a.leads_count > 0 ? a.won_count / a.leads_count : 0;
    const wonRate7 = a7 && a7.leads_count > 0 ? a7.won_count / a7.leads_count : null;
    const wonRateVsAvg = Math.round((wonRate30 - companyAvgWonRate) * 100);
    const trend = wonRate7 != null ? Math.round((wonRate7 - wonRate30) * 100) : null;

    const coachingSignals: string[] = [];
    if (wonRateVsAvg < -10) coachingSignals.push("won_rate_below_avg");
    if (trend !== null && trend < -5) coachingSignals.push("declining_7d_trend");
    if (a.avg_response_min != null && companyAvgResponse != null && Number(a.avg_response_min) > companyAvgResponse * 1.5)
      coachingSignals.push("slow_response_time");
    if (calls && calls.call_count > 0 && calls.completed / calls.call_count < 0.6)
      coachingSignals.push("low_call_completion");

    return {
      agent_id: a.agent_id,
      leads_30d: a.leads_count,
      won_rate_30d_pct: Math.round(wonRate30 * 100),
      won_rate_7d_pct: wonRate7 != null ? Math.round(wonRate7 * 100) : null,
      won_rate_vs_avg_delta: wonRateVsAvg,
      trend_7d_vs_30d: trend,
      avg_response_min_30d: a.avg_response_min != null ? Math.round(Number(a.avg_response_min)) : null,
      avg_health_30d: a.avg_health != null ? Math.round(Number(a.avg_health)) : null,
      call_count_30d: calls?.call_count ?? 0,
      call_completion_rate_pct: calls && calls.call_count > 0 ? Math.round((calls.completed / calls.call_count) * 100) : null,
      coaching_signals: coachingSignals,
    };
  });

  return {
    window_days: 30,
    agents,
    company_averages: {
      won_rate_pct: Math.round(companyAvgWonRate * 100),
      avg_response_min: companyAvgResponse != null ? Math.round(companyAvgResponse) : null,
    },
    agents_needing_coaching: agents.filter((a) => a.coaching_signals.length > 0).length,
  };
}
