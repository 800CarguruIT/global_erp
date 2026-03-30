import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  _branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  // Previous window for trend comparison
  const windowMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - windowMs);
  const prevTo = new Date(from.getTime());

  const [callMetrics, crmMetrics, prevCallMetrics] = await Promise.all([
    // Per-agent call metrics (current window, grouped by extension)
    sql<{
      user_id: string;
      agent_name: string;
      total_calls: number;
      held_calls: number;
      missed_calls: number;
      avg_duration_sec: number | null;
    }[]>`
      SELECT
        COALESCE(u.id::text, cs.to_number) AS user_id,
        COALESCE(u.full_name, e.full_name, u.email, 'Ext ' || cs.to_number) AS agent_name,
        COUNT(cs.id)::int AS total_calls,
        COUNT(cs.id) FILTER (WHERE cs.status = 'completed' AND cs.duration_seconds > 0)::int AS held_calls,
        COUNT(cs.id) FILTER (WHERE cs.status IN ('failed', 'cancelled'))::int AS missed_calls,
        AVG(cs.duration_seconds) FILTER (WHERE cs.status = 'completed' AND cs.duration_seconds > 0) AS avg_duration_sec
      FROM call_sessions cs
      LEFT JOIN users u ON u.mobile = cs.to_number AND u.company_id = ${companyId}
      LEFT JOIN employees e ON e.id = u.employee_id
      WHERE cs.company_id = ${companyId}
        AND cs.created_at >= ${from} AND cs.created_at < ${to}
      GROUP BY COALESCE(u.id::text, cs.to_number), COALESCE(u.full_name, e.full_name, u.email, 'Ext ' || cs.to_number)
    `,

    // Per-agent CRM metrics
    sql<{
      user_id: string;
      chsc_sold: number;
      chsc_car_in: number;
      total_collection: number;
      appts: number;
    }[]>`
      SELECT
        COALESCE(l.lead_owner_user_id, l.created_by_user_id) AS user_id,
        COUNT(DISTINCT l.id) FILTER (
          WHERE l.lead_status = 'closed_won'
            AND UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC'
        )::int AS chsc_sold,
        COUNT(DISTINCT l.id) FILTER (
          WHERE UPPER(TRIM(COALESCE(c.customer_type, ''))) = 'CHSC'
        )::int AS chsc_car_in,
        0::numeric AS total_collection,
        COUNT(DISTINCT lb.id) FILTER (WHERE lb.status = 'active')::int AS appts
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN lead_bookings lb ON lb.lead_id = l.id AND lb.company_id = ${companyId}
      WHERE l.company_id = ${companyId}
        AND COALESCE(l.lead_owner_user_id, l.created_by_user_id) IS NOT NULL
        AND l.created_at >= ${from} AND l.created_at < ${to}
      GROUP BY COALESCE(l.lead_owner_user_id, l.created_by_user_id)
    `,

    // Previous window call totals (for held_rate_delta)
    sql<{
      user_id: string;
      total_calls: number;
      held_calls: number;
    }[]>`
      SELECT
        created_by_user_id AS user_id,
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE status = 'completed' AND duration_seconds > 0)::int AS held_calls
      FROM call_sessions
      WHERE company_id = ${companyId}
        AND created_at >= ${prevFrom} AND created_at < ${prevTo}
      GROUP BY created_by_user_id
    `,
  ]);

  const crmMap = new Map(crmMetrics.map((r) => [r.user_id, r]));
  const prevMap = new Map(prevCallMetrics.map((r) => [r.user_id, r]));

  const agents = callMetrics.map((cm) => {
    const crm = crmMap.get(cm.user_id);
    const prev = prevMap.get(cm.user_id);

    const totalCalls = Number(cm.total_calls);
    const heldCalls = Number(cm.held_calls);
    const heldRatePct = totalCalls > 0 ? Math.round((heldCalls / totalCalls) * 100) : 0;

    const prevHeldRate =
      prev && Number(prev.total_calls) > 0
        ? Math.round((Number(prev.held_calls) / Number(prev.total_calls)) * 100)
        : null;

    const chscSold = Number(crm?.chsc_sold ?? 0);
    const chscCarIn = Number(crm?.chsc_car_in ?? 0);
    const chscConvPct = chscCarIn > 0 ? Math.round((chscSold / chscCarIn) * 100) : 0;
    const collection = Number(crm?.total_collection ?? 0);

    return {
      agent_name: cm.agent_name,
      total_calls: totalCalls,
      held_calls: heldCalls,
      held_rate_pct: heldRatePct,
      held_rate_delta_pct: prevHeldRate != null ? heldRatePct - prevHeldRate : null,
      missed_calls: Number(cm.missed_calls),
      avg_duration_sec:
        cm.avg_duration_sec != null ? Math.round(Number(cm.avg_duration_sec)) : null,
      chsc_sold: chscSold,
      chsc_car_in: chscCarIn,
      chsc_conv_pct: chscConvPct,
      collection: Math.round(collection),
      appointments: Number(crm?.appts ?? 0),
    };
  });

  const totalCalls = agents.reduce((s, a) => s + a.total_calls, 0);
  const totalHeld = agents.reduce((s, a) => s + a.held_calls, 0);
  const totalCollection = agents.reduce((s, a) => s + a.collection, 0);

  // Inhouse vs Remote group comparison
  const locationRes = await sql<{
    location: string;
    total_calls: number;
    held_calls: number;
    agent_count: number;
  }[]>`
    SELECT
      COALESCE(u.dialer_location, 'inhouse') AS location,
      COUNT(cs.id)::int AS total_calls,
      COUNT(cs.id) FILTER (WHERE cs.status = 'completed' AND cs.duration_seconds > 0)::int AS held_calls,
      COUNT(DISTINCT COALESCE(u.id::text, cs.to_number))::int AS agent_count
    FROM call_sessions cs
    LEFT JOIN users u ON (u.mobile = cs.to_number OR u.id = cs.created_by_user_id) AND u.company_id = ${companyId}
    WHERE cs.company_id = ${companyId}
      AND cs.created_at >= ${from} AND cs.created_at < ${to}
    GROUP BY COALESCE(u.dialer_location, 'inhouse')
  `;
  const locRows = locationRes;
  const inhouseRow = locRows.find((r) => r.location === "inhouse");
  const remoteRow = locRows.find((r) => r.location === "remote");

  function locSummary(row: typeof inhouseRow) {
    const t = Number(row?.total_calls ?? 0);
    const h = Number(row?.held_calls ?? 0);
    return {
      agents: Number(row?.agent_count ?? 0),
      total_calls: t,
      held_calls: h,
      held_rate_pct: t > 0 ? Math.round((h / t) * 100) : 0,
    };
  }

  return {
    window_days: Math.max(1, Math.round(windowMs / (1000 * 60 * 60 * 24))),
    active_agents: agents.length,
    company_avg_held_rate_pct:
      totalCalls > 0 ? Math.round((totalHeld / totalCalls) * 100) : 0,
    company_avg_collection_per_agent:
      agents.length > 0 ? Math.round(totalCollection / agents.length) : 0,
    inhouse_summary: locSummary(inhouseRow),
    remote_summary: locSummary(remoteRow),
    agents,
  };
}
