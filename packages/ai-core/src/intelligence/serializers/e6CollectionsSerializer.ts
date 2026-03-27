import { getSql } from "../../db";

export async function serialize(
  companyId: string,
  branchId: string | null,
  from: Date,
  to: Date
): Promise<Record<string, unknown>> {
  const sql = getSql();

  const [overdueInvoices, paidHistory] = await Promise.all([
    sql<{
      invoice_id: string;
      due_date: string;
      grand_total: number;
      status: string;
      payment_method: string | null;
      created_at: string;
    }[]>`
      SELECT
        id AS invoice_id,
        due_date::text,
        grand_total::float,
        status,
        payment_method,
        created_at::text
      FROM invoices
      WHERE company_id = ${companyId}
        AND status != 'paid'
        AND due_date IS NOT NULL
        AND due_date < NOW()
      ORDER BY due_date ASC
      LIMIT 50
    `,
    sql<{ cnt: number; total: number; avg_days_to_pay: number | null }[]>`
      SELECT
        COUNT(*)::int AS cnt,
        COALESCE(SUM(grand_total), 0)::float AS total,
        AVG(EXTRACT(EPOCH FROM (paid_at - created_at)) / 86400.0) FILTER (WHERE paid_at IS NOT NULL) AS avg_days_to_pay
      FROM invoices
      WHERE company_id = ${companyId}
        AND status = 'paid'
        AND paid_at BETWEEN ${new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000)} AND ${to}
    `,
  ]);

  const now = to;
  const enriched = overdueInvoices.map((inv) => {
    const days = Math.round(
      (now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      invoice_id: inv.invoice_id,
      days_overdue: days,
      grand_total: Math.round(inv.grand_total),
      status: inv.status,
      payment_method: inv.payment_method,
    };
  });

  const totalOverdue = enriched.reduce((s, i) => s + i.grand_total, 0);
  const critical = enriched.filter((i) => i.days_overdue >= 90).length;
  const warning = enriched.filter((i) => i.days_overdue >= 30 && i.days_overdue < 90).length;
  const watch = enriched.filter((i) => i.days_overdue < 30).length;
  const hist = paidHistory[0];

  return {
    overdue_invoices: enriched,
    total_overdue_count: enriched.length,
    total_overdue_amount: Math.round(totalOverdue),
    avg_days_overdue:
      enriched.length > 0
        ? Math.round(enriched.reduce((s, i) => s + i.days_overdue, 0) / enriched.length)
        : 0,
    priority_buckets: { critical_90d: critical, warning_30_90d: warning, watch_under_30d: watch },
    historical_avg_days_to_pay:
      hist?.avg_days_to_pay != null ? Math.round(Number(hist.avg_days_to_pay)) : null,
    paid_invoices_last_90d: hist?.cnt ?? 0,
  };
}
