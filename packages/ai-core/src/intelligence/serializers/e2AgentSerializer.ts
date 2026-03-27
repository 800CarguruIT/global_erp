import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  // Same window duration shifted back for comparison
  const windowMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - windowMs);
  const prevTo = new Date(from.getTime());

  const [currentAgents, prevAgents, callStats] = await Promise.all([
    sql<{
      agent_id: string;
      leads_count: number;
      won_count: number;
      avg_health: number | null;
      avg_response_min: number | null;
    }[]>`
      SELECT
        agent_employee_id AS agent_id,
        COUNT(*)::int AS leads_count,
        COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won_count,
        AVG(health_score) AS avg_health,
        AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60.0)
          FILTER (WHERE first_response_at IS NOT NULL) AS avg_response_min
      FROM leads
      WHERE company_id = ${companyId}
        AND agent_employee_id IS NOT NULL
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY agent_employee_id
    `,
    sql<{ agent_id: string; leads_count: number; won_count: number }[]>`
      SELECT
        agent_employee_id AS agent_id,
        COUNT(*)::int AS leads_count,
        COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won_count
      FROM leads
      WHERE company_id = ${companyId}
        AND agent_employee_id IS NOT NULL
        AND created_at BETWEEN ${prevFrom} AND ${prevTo}
      GROUP BY agent_employee_id
    `,
    sql<{ agent_id: string; call_count: number; completed_count: number; avg_duration_sec: number | null }[]>`
      SELECT
        created_by_user_id AS agent_id,
        COUNT(*)::int AS call_count,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
        AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL) AS avg_duration_sec
      FROM call_sessions
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY created_by_user_id
    `,
  ]);

  const prevMap = new Map(prevAgents.map((a) => [a.agent_id, a]));
  const callMap = new Map(callStats.map((c) => [c.agent_id, c]));

  const agents = currentAgents.map((a) => {
    const prev = prevMap.get(a.agent_id);
    const calls = callMap.get(a.agent_id);
    const prevWonRate = prev && prev.leads_count > 0 ? prev.won_count / prev.leads_count : null;
    const currWonRate = a.leads_count > 0 ? a.won_count / a.leads_count : 0;
    const deltaPct =
      prevWonRate != null ? Math.round((currWonRate - prevWonRate) * 100) : null;

    return {
      agent_id: a.agent_id,
      leads_count: a.leads_count,
      won_count: a.won_count,
      won_rate_pct: a.leads_count > 0 ? Math.round(currWonRate * 100) : 0,
      avg_health: a.avg_health != null ? Math.round(Number(a.avg_health)) : null,
      avg_response_min: a.avg_response_min != null ? Math.round(Number(a.avg_response_min)) : null,
      won_rate_delta_pct: deltaPct,
      call_count: calls?.call_count ?? 0,
      call_completed: calls?.completed_count ?? 0,
      avg_call_duration_sec: calls?.avg_duration_sec != null ? Math.round(Number(calls.avg_duration_sec)) : null,
    };
  });

  const totalLeads = agents.reduce((s, a) => s + a.leads_count, 0);
  const avgWonRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.won_rate_pct, 0) / agents.length)
      : 0;

  return {
    window_days: Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
    agents,
    company_avg_won_rate_pct: avgWonRate,
    total_leads: totalLeads,
    active_agents: agents.length,
  };
}
