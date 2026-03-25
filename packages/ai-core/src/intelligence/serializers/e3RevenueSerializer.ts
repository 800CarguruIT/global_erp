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

  const [dailyRevenue, statusBreakdown, wonLeadsByDay] = await Promise.all([
    sql<{ day: string; revenue: number; invoice_count: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COALESCE(SUM(grand_total), 0)::float AS revenue,
        COUNT(*)::int AS invoice_count
      FROM invoices
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `,
    sql<{ status: string; cnt: number; total: number }[]>`
      SELECT
        status,
        COUNT(*)::int AS cnt,
        COALESCE(SUM(grand_total), 0)::float AS total
      FROM invoices
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY status
    `,
    sql<{ day: string; cnt: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', closed_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS cnt
      FROM leads
      WHERE company_id = ${companyId}
        AND lead_status = 'closed_won'
        AND closed_at BETWEEN ${from} AND ${to}
      GROUP BY DATE_TRUNC('day', closed_at)
      ORDER BY day
    `,
  ]);

  // Compute rolling averages in-app
  const recent7 = dailyRevenue.filter((d) => d.day >= sevenDaysAgo.toISOString().slice(0, 10));
  const rolling7dAvg =
    recent7.length > 0
      ? Math.round(recent7.reduce((s, d) => s + d.revenue, 0) / recent7.length)
      : 0;
  const rolling30dAvg =
    dailyRevenue.length > 0
      ? Math.round(dailyRevenue.reduce((s, d) => s + d.revenue, 0) / dailyRevenue.length)
      : 0;

  const statusMap = Object.fromEntries(
    statusBreakdown.map((s) => [s.status, { count: s.cnt, total: Math.round(s.total) }])
  );

  const windowRevenue = dailyRevenue
    .filter((d) => d.day >= from.toISOString().slice(0, 10))
    .reduce((s, d) => s + d.revenue, 0);

  return {
    window_days: Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
    total_window_revenue: Math.round(windowRevenue),
    daily_revenue: dailyRevenue.map((d) => ({
      day: d.day,
      revenue: Math.round(d.revenue),
      invoice_count: d.invoice_count,
    })),
    status_breakdown: statusMap,
    rolling_7d_daily_avg: rolling7dAvg,
    rolling_30d_daily_avg: rolling30dAvg,
    won_leads_by_day: wonLeadsByDay,
  };
}
