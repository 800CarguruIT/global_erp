import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  const now = to;
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [customerActivity, overdueByCustomer, totalActive] = await Promise.all([
    sql<{
      customer_id: string;
      last_activity: string | null;
      total_leads: number;
      won_leads: number;
    }[]>`
      SELECT
        c.id AS customer_id,
        MAX(l.last_activity_at)::text AS last_activity,
        COUNT(l.id)::int AS total_leads,
        COUNT(l.id) FILTER (WHERE l.lead_status = 'closed_won')::int AS won_leads
      FROM customers c
      LEFT JOIN leads l ON l.company_id = c.company_id AND l.customer_id = c.id
      WHERE c.company_id = ${companyId}
        AND c.is_active = true
      GROUP BY c.id
      HAVING MAX(l.last_activity_at) < ${d30} OR MAX(l.last_activity_at) IS NULL
    `,
    sql<{ customer_id: string; overdue_count: number; overdue_total: number }[]>`
      SELECT
        c.id AS customer_id,
        COUNT(i.id)::int AS overdue_count,
        COALESCE(SUM(i.grand_total), 0)::float AS overdue_total
      FROM customers c
      JOIN invoices i ON i.company_id = c.company_id
      WHERE c.company_id = ${companyId}
        AND i.status != 'paid'
        AND i.due_date < NOW()
      GROUP BY c.id
    `,
    sql<{ cnt: number }[]>`
      SELECT COUNT(*)::int AS cnt FROM customers
      WHERE company_id = ${companyId} AND is_active = true
    `,
  ]);

  const overdueMap = new Map(overdueByCustomer.map((o) => [o.customer_id, o]));

  const dormant30 = customerActivity.filter((c) => {
    if (!c.last_activity) return true;
    return new Date(c.last_activity) < d30;
  });
  const dormant60 = customerActivity.filter((c) => {
    if (!c.last_activity) return true;
    return new Date(c.last_activity) < d60;
  });
  const dormant90 = customerActivity.filter((c) => {
    if (!c.last_activity) return true;
    return new Date(c.last_activity) < d90;
  });

  const atRisk = dormant30.slice(0, 50).map((c) => {
    const overdue = overdueMap.get(c.customer_id);
    const daysSince = c.last_activity
      ? Math.round((now.getTime() - new Date(c.last_activity).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      customer_id: c.customer_id,
      days_since_activity: daysSince,
      total_leads: c.total_leads,
      won_leads: c.won_leads,
      overdue_invoices: overdue?.overdue_count ?? 0,
      overdue_amount: overdue ? Math.round(overdue.overdue_total) : 0,
    };
  });

  return {
    total_active_customers: totalActive[0]?.cnt ?? 0,
    customers_dormant_30d: dormant30.length,
    customers_dormant_60d: dormant60.length,
    customers_dormant_90d: dormant90.length,
    at_risk_customers: atRisk,
  };
}
