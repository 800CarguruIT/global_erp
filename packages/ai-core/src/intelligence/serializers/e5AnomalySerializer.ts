import { getSql } from "../../db";

function computeStats(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return { mean: Math.round(mean * 100) / 100, stddev: Math.round(Math.sqrt(variance) * 100) / 100 };
}

function zScore(value: number, mean: number, stddev: number): number {
  if (stddev === 0) return 0;
  return Math.round(((value - mean) / stddev) * 100) / 100;
}

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  const thirtyDaysAgo = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dailyCalls, dailyLeads, dailyRevenue] = await Promise.all([
    sql<{ day: string; cnt: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS cnt
      FROM call_sessions
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `,
    sql<{ day: string; cnt: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS cnt
      FROM leads
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `,
    sql<{ day: string; total: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COALESCE(SUM(grand_total), 0)::float AS total
      FROM invoices
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${thirtyDaysAgo} AND ${to}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `,
  ]);

  const callStats = computeStats(dailyCalls.map((d) => d.cnt));
  const leadStats = computeStats(dailyLeads.map((d) => d.cnt));
  const revenueStats = computeStats(dailyRevenue.map((d) => d.total));

  const anomalies: Array<{
    metric: string;
    day: string;
    value: number;
    mean: number;
    stddev: number;
    z_score: number;
    direction: "above" | "below";
  }> = [];

  const threshold = 2.0;

  for (const d of dailyCalls) {
    const z = zScore(d.cnt, callStats.mean, callStats.stddev);
    if (Math.abs(z) >= threshold) {
      anomalies.push({ metric: "calls_per_day", day: d.day, value: d.cnt, ...callStats, z_score: z, direction: z > 0 ? "above" : "below" });
    }
  }
  for (const d of dailyLeads) {
    const z = zScore(d.cnt, leadStats.mean, leadStats.stddev);
    if (Math.abs(z) >= threshold) {
      anomalies.push({ metric: "leads_per_day", day: d.day, value: d.cnt, ...leadStats, z_score: z, direction: z > 0 ? "above" : "below" });
    }
  }
  for (const d of dailyRevenue) {
    const z = zScore(d.total, revenueStats.mean, revenueStats.stddev);
    if (Math.abs(z) >= threshold) {
      anomalies.push({ metric: "revenue_per_day", day: d.day, value: Math.round(d.total), ...revenueStats, z_score: z, direction: z > 0 ? "above" : "below" });
    }
  }

  // Sort by absolute z-score descending
  anomalies.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

  const last7Days = to.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return {
    window_days: 30,
    anomalies: anomalies.slice(0, 10),
    series_summary: {
      calls: { ...callStats, last_7d_avg: Math.round(dailyCalls.filter((d) => d.day >= sevenDaysAgo).reduce((s, d) => s + d.cnt, 0) / 7) },
      leads: { ...leadStats, last_7d_avg: Math.round(dailyLeads.filter((d) => d.day >= sevenDaysAgo).reduce((s, d) => s + d.cnt, 0) / 7) },
      revenue: { ...revenueStats, last_7d_avg: Math.round(dailyRevenue.filter((d) => d.day >= sevenDaysAgo).reduce((s, d) => s + d.total, 0) / 7) },
    },
    z_score_threshold: threshold,
  };
}
