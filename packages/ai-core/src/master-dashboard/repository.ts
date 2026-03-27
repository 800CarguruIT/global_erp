import { getSql } from "../db";
import type {
  MasterDashboardFilter,
  MasterDashboardData,
  TopKpis,
  InboundMetrics,
  OutboundMetrics,
  PortfolioMetrics,
  ConversionFunnel,
  DailyDataPoint,
  TeamStats,
  TopPerformer,
  RevenueBreakdownItem,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100 * 10) / 10;
}

function gradeFromScore(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  return "C";
}

function prevPeriod(from: Date, to: Date): { prevFrom: Date; prevTo: Date } {
  const duration = to.getTime() - from.getTime();
  return {
    prevFrom: new Date(from.getTime() - duration),
    prevTo: new Date(from.getTime() - 1),
  };
}

export async function getMasterDashboardData(
  filter: MasterDashboardFilter
): Promise<MasterDashboardData> {
  const sql = getSql();
  const { companyId, from, to } = filter;
  const branchId = filter.branchId ?? null;
  const { prevFrom, prevTo } = prevPeriod(from, to);

  // Run all queries in parallel — each is a simple, single-table query
  const [
    callTotalsRes,
    prevCallTotalsRes,
    inboundAvgDurationRes,
    leadAvgResponseRes,
    outboundBookingsRes,
    leadTotalsRes,
    prevLeadTotalsRes,
    revenueTotalsRes,
    prevRevenueTotalsRes,
    portfolioAccountsRes,
    touchpointsRes,
    portfolioCarInRes,
    portfolioRevenueRes,
    portfolioUpsellRes,
    portfolioRetentionRes,
    agentLeadStatsRes,
    invoiceLeadTypeRes,
    repeatCallersRes,
    callTrendRes,
    leadTrendRes,
    revTrendRes,
  ] = await Promise.all([

    // 1. Call totals split by direction
    branchId
      ? sql<{ total: number; completed: number; inbound_total: number; inbound_completed: number; inbound_duration: number; outbound_total: number; outbound_completed: number; outbound_duration: number }[]>`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_total,
            COUNT(*) FILTER (WHERE direction = 'inbound' AND status = 'completed')::int AS inbound_completed,
            COALESCE(SUM(duration_seconds) FILTER (WHERE direction = 'inbound'), 0)::int AS inbound_duration,
            COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_total,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'completed')::int AS outbound_completed,
            COALESCE(SUM(duration_seconds) FILTER (WHERE direction = 'outbound'), 0)::int AS outbound_duration
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId} AND branch_id = ${branchId}
            AND created_at BETWEEN ${from} AND ${to}
        `
      : sql<{ total: number; completed: number; inbound_total: number; inbound_completed: number; inbound_duration: number; outbound_total: number; outbound_completed: number; outbound_duration: number }[]>`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_total,
            COUNT(*) FILTER (WHERE direction = 'inbound' AND status = 'completed')::int AS inbound_completed,
            COALESCE(SUM(duration_seconds) FILTER (WHERE direction = 'inbound'), 0)::int AS inbound_duration,
            COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_total,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'completed')::int AS outbound_completed,
            COALESCE(SUM(duration_seconds) FILTER (WHERE direction = 'outbound'), 0)::int AS outbound_duration
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId}
            AND created_at BETWEEN ${from} AND ${to}
        `,

    // 2. Call totals (prev period)
    branchId
      ? sql<{ total: number }[]>`
          SELECT COUNT(*)::int AS total
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId} AND branch_id = ${branchId}
            AND created_at BETWEEN ${prevFrom} AND ${prevTo}
        `
      : sql<{ total: number }[]>`
          SELECT COUNT(*)::int AS total
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId}
            AND created_at BETWEEN ${prevFrom} AND ${prevTo}
        `,

    // 3. Avg inbound handling time (call_sessions only — no join)
    branchId
      ? sql<{ avg_duration_secs: number | null }[]>`
          SELECT AVG(duration_seconds) FILTER (WHERE status = 'completed')::float AS avg_duration_secs
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId} AND branch_id = ${branchId}
            AND direction = 'inbound'
            AND created_at BETWEEN ${from} AND ${to}
        `
      : sql<{ avg_duration_secs: number | null }[]>`
          SELECT AVG(duration_seconds) FILTER (WHERE status = 'completed')::float AS avg_duration_secs
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId}
            AND direction = 'inbound'
            AND created_at BETWEEN ${from} AND ${to}
        `,

    // 4. Avg lead response time (leads only — no join with call_sessions)
    branchId
      ? sql<{ avg_response_secs: number | null }[]>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (first_response_at::timestamptz - created_at::timestamptz))
          )::float AS avg_response_secs
          FROM leads
          WHERE company_id = ${companyId} AND branch_id = ${branchId}
            AND source = 'call'
            AND first_response_at IS NOT NULL
            AND created_at BETWEEN ${from} AND ${to}
        `
      : sql<{ avg_response_secs: number | null }[]>`
          SELECT AVG(
            EXTRACT(EPOCH FROM (first_response_at::timestamptz - created_at::timestamptz))
          )::float AS avg_response_secs
          FROM leads
          WHERE company_id = ${companyId}
            AND source = 'call'
            AND first_response_at IS NOT NULL
            AND created_at BETWEEN ${from} AND ${to}
        `,

    // 5. Outbound bookings (leads table only — no join with call_sessions)
    branchId
      ? sql<{ outbound_bookings: number; car_in_count: number; closed_won_count: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS outbound_bookings,
            COUNT(*) FILTER (WHERE lead_status = 'car_in')::int AS car_in_count,
            COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS closed_won_count
          FROM leads
          WHERE company_id = ${companyId} AND branch_id = ${branchId}
            AND agent_employee_id IS NOT NULL
            AND created_at BETWEEN ${from} AND ${to}
        `
      : sql<{ outbound_bookings: number; car_in_count: number; closed_won_count: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS outbound_bookings,
            COUNT(*) FILTER (WHERE lead_status = 'car_in')::int AS car_in_count,
            COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS closed_won_count
          FROM leads
          WHERE company_id = ${companyId}
            AND agent_employee_id IS NOT NULL
            AND created_at BETWEEN ${from} AND ${to}
        `,

    // 6. Lead totals
    branchId
      ? sql<{ total_leads: number; booked: number; car_in: number; closed_won: number; cancelled: number; call_source_leads: number }[]>`
          SELECT
            COUNT(*)::int AS total_leads,
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS booked,
            COUNT(*) FILTER (WHERE lead_status = 'car_in')::int AS car_in,
            COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS closed_won,
            COUNT(*) FILTER (WHERE lead_stage = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE source = 'call')::int AS call_source_leads
          FROM leads
          WHERE company_id = ${companyId} AND branch_id = ${branchId}
            AND created_at BETWEEN ${from} AND ${to}
        `
      : sql<{ total_leads: number; booked: number; car_in: number; closed_won: number; cancelled: number; call_source_leads: number }[]>`
          SELECT
            COUNT(*)::int AS total_leads,
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS booked,
            COUNT(*) FILTER (WHERE lead_status = 'car_in')::int AS car_in,
            COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS closed_won,
            COUNT(*) FILTER (WHERE lead_stage = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE source = 'call')::int AS call_source_leads
          FROM leads
          WHERE company_id = ${companyId}
            AND created_at BETWEEN ${from} AND ${to}
        `,

    // 7. Lead totals (prev period)
    sql<{ booked: number }[]>`
      SELECT COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS booked
      FROM leads
      WHERE company_id = ${companyId}
        AND created_at BETWEEN ${prevFrom} AND ${prevTo}
    `,

    // 8. Revenue totals (current)
    sql<{ total_revenue: number }[]>`
      SELECT COALESCE(SUM(grand_total), 0)::float AS total_revenue
      FROM invoices
      WHERE company_id = ${companyId}
        AND status = 'paid'
        AND created_at BETWEEN ${from} AND ${to}
    `,

    // 9. Revenue totals (prev period)
    sql<{ total_revenue: number }[]>`
      SELECT COALESCE(SUM(grand_total), 0)::float AS total_revenue
      FROM invoices
      WHERE company_id = ${companyId}
        AND status = 'paid'
        AND created_at BETWEEN ${prevFrom} AND ${prevTo}
    `,

    // 10. Portfolio: returning customers active this period
    // (customers who had a lead BEFORE this period AND again in this period)
    branchId
      ? sql<{ active_accounts: number }[]>`
          SELECT COUNT(DISTINCT l.customer_id)::int AS active_accounts
          FROM leads l
          WHERE l.company_id = ${companyId} AND l.branch_id = ${branchId}
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `
      : sql<{ active_accounts: number }[]>`
          SELECT COUNT(DISTINCT l.customer_id)::int AS active_accounts
          FROM leads l
          WHERE l.company_id = ${companyId}
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `,

    // 11. Portfolio: touchpoints — calls to returning customers only
    branchId
      ? sql<{ touchpoints: number }[]>`
          SELECT COUNT(*)::int AS touchpoints
          FROM call_sessions cs
          WHERE cs.scope = 'company' AND cs.company_id = ${companyId} AND cs.branch_id = ${branchId}
            AND cs.to_entity_type = 'customer'
            AND cs.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = cs.to_entity_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `
      : sql<{ touchpoints: number }[]>`
          SELECT COUNT(*)::int AS touchpoints
          FROM call_sessions cs
          WHERE cs.scope = 'company' AND cs.company_id = ${companyId}
            AND cs.to_entity_type = 'customer'
            AND cs.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = cs.to_entity_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `,

    // 12. Portfolio: car-in bookings from returning customers
    branchId
      ? sql<{ bookings_car_in: number }[]>`
          SELECT COUNT(*)::int AS bookings_car_in
          FROM leads l
          WHERE l.company_id = ${companyId} AND l.branch_id = ${branchId}
            AND l.lead_status = 'car_in'
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `
      : sql<{ bookings_car_in: number }[]>`
          SELECT COUNT(*)::int AS bookings_car_in
          FROM leads l
          WHERE l.company_id = ${companyId}
            AND l.lead_status = 'car_in'
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
        `,

    // 13. Portfolio: revenue from returning customers
    sql<{ total_sales: number }[]>`
      SELECT COALESCE(SUM(i.grand_total), 0)::float AS total_sales
      FROM invoices i
      WHERE i.company_id = ${companyId}
        AND i.status = 'paid'
        AND i.customer_id IS NOT NULL
        AND i.created_at BETWEEN ${from} AND ${to}
        AND EXISTS (
          SELECT 1 FROM leads prev
          WHERE prev.customer_id = i.customer_id
            AND prev.company_id = ${companyId}
            AND prev.created_at < ${from}
        )
    `,

    // 14. Portfolio: upsell — returning customers who booked >1 distinct service type this period
    branchId
      ? sql<{ upsell_customers: number; total_returning: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE type_count > 1)::int AS upsell_customers,
            COUNT(*)::int AS total_returning
          FROM (
            SELECT l.customer_id, COUNT(DISTINCT l.lead_type)::int AS type_count
            FROM leads l
            WHERE l.company_id = ${companyId} AND l.branch_id = ${branchId}
              AND l.customer_id IS NOT NULL
              AND l.created_at BETWEEN ${from} AND ${to}
              AND EXISTS (
                SELECT 1 FROM leads prev
                WHERE prev.customer_id = l.customer_id
                  AND prev.company_id = ${companyId}
                  AND prev.created_at < ${from}
              )
            GROUP BY l.customer_id
          ) sub
        `
      : sql<{ upsell_customers: number; total_returning: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE type_count > 1)::int AS upsell_customers,
            COUNT(*)::int AS total_returning
          FROM (
            SELECT l.customer_id, COUNT(DISTINCT l.lead_type)::int AS type_count
            FROM leads l
            WHERE l.company_id = ${companyId}
              AND l.customer_id IS NOT NULL
              AND l.created_at BETWEEN ${from} AND ${to}
              AND EXISTS (
                SELECT 1 FROM leads prev
                WHERE prev.customer_id = l.customer_id
                  AND prev.company_id = ${companyId}
                  AND prev.created_at < ${from}
              )
            GROUP BY l.customer_id
          ) sub
        `,

    // 15. Portfolio: retention — customers active in prev period who returned this period
    sql<{ retained: number; prev_period_active: number }[]>`
      SELECT
        COUNT(DISTINCT curr.customer_id)::int AS retained,
        COUNT(DISTINCT prev.customer_id)::int AS prev_period_active
      FROM (
        SELECT DISTINCT customer_id
        FROM leads
        WHERE company_id = ${companyId} AND customer_id IS NOT NULL
          AND created_at BETWEEN ${prevFrom} AND ${prevTo}
      ) prev
      LEFT JOIN (
        SELECT DISTINCT customer_id
        FROM leads
        WHERE company_id = ${companyId} AND customer_id IS NOT NULL
          AND created_at BETWEEN ${from} AND ${to}
      ) curr ON curr.customer_id = prev.customer_id
    `,

    // 16. Portfolio: per-agent stats for returning-customer leads only
    branchId
      ? sql<{ agent_employee_id: string | null; employee_name: string | null; lead_count: number; won_count: number }[]>`
          SELECT
            l.agent_employee_id,
            e.full_name AS employee_name,
            COUNT(l.id)::int AS lead_count,
            COUNT(l.id) FILTER (WHERE l.lead_status = 'closed_won')::int AS won_count
          FROM leads l
          LEFT JOIN employees e ON e.id = l.agent_employee_id
          WHERE l.company_id = ${companyId} AND l.branch_id = ${branchId}
            AND l.agent_employee_id IS NOT NULL
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
          GROUP BY l.agent_employee_id, e.full_name
          ORDER BY won_count DESC
          LIMIT 20
        `
      : sql<{ agent_employee_id: string | null; employee_name: string | null; lead_count: number; won_count: number }[]>`
          SELECT
            l.agent_employee_id,
            e.full_name AS employee_name,
            COUNT(l.id)::int AS lead_count,
            COUNT(l.id) FILTER (WHERE l.lead_status = 'closed_won')::int AS won_count
          FROM leads l
          LEFT JOIN employees e ON e.id = l.agent_employee_id
          WHERE l.company_id = ${companyId}
            AND l.agent_employee_id IS NOT NULL
            AND l.customer_id IS NOT NULL
            AND l.created_at BETWEEN ${from} AND ${to}
            AND EXISTS (
              SELECT 1 FROM leads prev
              WHERE prev.customer_id = l.customer_id
                AND prev.company_id = ${companyId}
                AND prev.created_at < ${from}
            )
          GROUP BY l.agent_employee_id, e.full_name
          ORDER BY won_count DESC
          LIMIT 20
        `,

    // 13. Revenue by lead type (for breakdown chart)
    sql<{ lead_type: string | null; total: number }[]>`
      SELECT
        l.lead_type,
        COALESCE(SUM(i.grand_total), 0)::float AS total
      FROM invoices i
      LEFT JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId}
        AND i.status = 'paid'
        AND i.created_at BETWEEN ${from} AND ${to}
      GROUP BY l.lead_type
    `,

    // 14. Repeat callers
    branchId
      ? sql<{ total_callers: number; repeat_callers: number }[]>`
          SELECT
            COUNT(DISTINCT to_entity_id)::int AS total_callers,
            COUNT(DISTINCT to_entity_id) FILTER (
              WHERE cnt > 1
            )::int AS repeat_callers
          FROM (
            SELECT to_entity_id, COUNT(*) AS cnt
            FROM call_sessions
            WHERE scope = 'company' AND company_id = ${companyId} AND branch_id = ${branchId}
              AND to_entity_type = 'customer'
              AND direction = 'inbound'
              AND created_at BETWEEN ${from} AND ${to}
            GROUP BY to_entity_id
          ) sub
        `
      : sql<{ total_callers: number; repeat_callers: number }[]>`
          SELECT
            COUNT(DISTINCT to_entity_id)::int AS total_callers,
            COUNT(DISTINCT to_entity_id) FILTER (
              WHERE cnt > 1
            )::int AS repeat_callers
          FROM (
            SELECT to_entity_id, COUNT(*) AS cnt
            FROM call_sessions
            WHERE scope = 'company' AND company_id = ${companyId}
              AND to_entity_type = 'customer'
              AND direction = 'inbound'
              AND created_at BETWEEN ${from} AND ${to}
            GROUP BY to_entity_id
          ) sub
        `,

    // 15. Daily call trend (simple GROUP BY — no generate_series)
    branchId
      ? sql<{ day: string; inbound_calls: number; outbound_calls: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_calls,
            COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_calls
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId} AND branch_id = ${branchId}
            AND created_at BETWEEN ${from} AND ${to}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY day
        `
      : sql<{ day: string; inbound_calls: number; outbound_calls: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_calls,
            COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_calls
          FROM call_sessions
          WHERE scope = 'company' AND company_id = ${companyId}
            AND created_at BETWEEN ${from} AND ${to}
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY day
        `,

    // 16. Daily lead bookings trend
    branchId
      ? sql<{ day: string; bookings: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at::timestamptz), 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS bookings
          FROM leads
          WHERE company_id = ${companyId} AND branch_id = ${branchId}
            AND created_at BETWEEN ${from} AND ${to}
          GROUP BY DATE_TRUNC('day', created_at::timestamptz)
          ORDER BY day
        `
      : sql<{ day: string; bookings: number }[]>`
          SELECT
            TO_CHAR(DATE_TRUNC('day', created_at::timestamptz), 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE lead_status IN ('car_in', 'closed_won', 'accepted'))::int AS bookings
          FROM leads
          WHERE company_id = ${companyId}
            AND created_at BETWEEN ${from} AND ${to}
          GROUP BY DATE_TRUNC('day', created_at::timestamptz)
          ORDER BY day
        `,

    // 17. Daily revenue trend
    sql<{ day: string; revenue: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COALESCE(SUM(grand_total), 0)::float AS revenue
      FROM invoices
      WHERE company_id = ${companyId}
        AND status = 'paid'
        AND created_at BETWEEN ${from} AND ${to}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY day
    `,
  ]);

  // ── Unpack rows ─────────────────────────────────────────────────────────

  const calls = rowsFrom(callTotalsRes)[0] ?? {
    total: 0, completed: 0,
    inbound_total: 0, inbound_completed: 0, inbound_duration: 0,
    outbound_total: 0, outbound_completed: 0, outbound_duration: 0,
  };
  const prevCalls = rowsFrom(prevCallTotalsRes)[0] ?? { total: 0 };
  const avgDuration = rowsFrom(inboundAvgDurationRes)[0] ?? { avg_duration_secs: null };
  const avgResponse = rowsFrom(leadAvgResponseRes)[0] ?? { avg_response_secs: null };
  const obBookings = rowsFrom(outboundBookingsRes)[0] ?? { outbound_bookings: 0, car_in_count: 0, closed_won_count: 0 };
  const leads = rowsFrom(leadTotalsRes)[0] ?? { total_leads: 0, booked: 0, car_in: 0, closed_won: 0, cancelled: 0, call_source_leads: 0 };
  const prevLeads = rowsFrom(prevLeadTotalsRes)[0] ?? { booked: 0 };
  const revenueRow = rowsFrom(revenueTotalsRes)[0] ?? { total_revenue: 0 };
  const prevRevRow = rowsFrom(prevRevenueTotalsRes)[0] ?? { total_revenue: 0 };
  const pfAccounts = rowsFrom(portfolioAccountsRes)[0] ?? { active_accounts: 0 };
  const touchpoints = rowsFrom(touchpointsRes)[0] ?? { touchpoints: 0 };
  const pfCarIn = rowsFrom(portfolioCarInRes)[0] ?? { bookings_car_in: 0 };
  const pfRevenue = rowsFrom(portfolioRevenueRes)[0] ?? { total_sales: 0 };
  const pfUpsell = rowsFrom(portfolioUpsellRes)[0] ?? { upsell_customers: 0, total_returning: 0 };
  const pfRetention = rowsFrom(portfolioRetentionRes)[0] ?? { retained: 0, prev_period_active: 0 };
  const agentStats = rowsFrom(agentLeadStatsRes);
  const invoiceByType = rowsFrom(invoiceLeadTypeRes);
  const repeatCallers = rowsFrom(repeatCallersRes)[0] ?? { total_callers: 0, repeat_callers: 0 };
  const callTrend = rowsFrom(callTrendRes);
  const leadTrend = rowsFrom(leadTrendRes);
  const revTrend = rowsFrom(revTrendRes);

  // ── Merge trend rows by date ─────────────────────────────────────────────

  const allDates = Array.from(new Set([
    ...callTrend.map((r) => r.day),
    ...leadTrend.map((r) => r.day),
    ...revTrend.map((r) => r.day),
  ])).sort();

  const callTrendMap = Object.fromEntries(callTrend.map((r) => [r.day, r]));
  const leadTrendMap = Object.fromEntries(leadTrend.map((r) => [r.day, r]));
  const revTrendMap = Object.fromEntries(revTrend.map((r) => [r.day, r]));

  const trendRows = allDates.map((day) => ({
    day,
    inbound_calls: Number(callTrendMap[day]?.inbound_calls ?? 0),
    outbound_calls: Number(callTrendMap[day]?.outbound_calls ?? 0),
    bookings: Number(leadTrendMap[day]?.bookings ?? 0),
    revenue: Number(revTrendMap[day]?.revenue ?? 0),
  }));

  // ── Derived values ──────────────────────────────────────────────────────

  const inboundAnswerRate = pct(Number(calls.inbound_completed), Number(calls.inbound_total));
  const outboundAnswerRate = pct(Number(calls.outbound_completed), Number(calls.outbound_total));
  const inboundAbandonment = pct(
    Number(calls.inbound_total) - Number(calls.inbound_completed),
    Number(calls.inbound_total)
  );
  const repeatCallRate = pct(Number(repeatCallers.repeat_callers), Number(repeatCallers.total_callers) || 1);
  const callSourceLeads = Number(leads.call_source_leads);
  const inquiryToBookingRate = pct(Number(leads.booked), callSourceLeads || Number(leads.total_leads) || 1);
  const firstCallResolutionRate = pct(
    Number(leads.closed_won) + Number(leads.car_in),
    Number(leads.total_leads) || 1
  );
  const outboundLeadToBooking = pct(Number(obBookings.outbound_bookings), Number(calls.outbound_completed) || 1);
  const showUpRate = pct(Number(leads.car_in), Number(leads.booked) || 1);
  const salesConversionRate = pct(Number(leads.closed_won), Number(leads.total_leads) || 1);

  const inboundScore = Math.round(
    (inboundAnswerRate * 0.4) + (inquiryToBookingRate * 0.3) + ((100 - inboundAbandonment) * 0.3)
  );
  const outboundScore = Math.round(
    (outboundAnswerRate * 0.2) + (showUpRate * 0.4) + (salesConversionRate * 0.4)
  );

  const activeAccounts = Number(pfAccounts.active_accounts);
  const customerToBookingRate = pct(Number(pfCarIn.bookings_car_in), activeAccounts || 1);
  const upsellRate = pct(Number(pfUpsell.upsell_customers), Number(pfUpsell.total_returning) || 1);
  const retentionRate = pct(Number(pfRetention.retained), Number(pfRetention.prev_period_active) || 1);
  const revPerCustomer = activeAccounts > 0 ? Number(pfRevenue.total_sales) / activeAccounts : 0;
  const crossSellRate = upsellRate; // same metric — multi-service-type customers
  const portfolioScore = Math.min(100, Math.round(
    (Math.min(customerToBookingRate, 100) * 0.4) + (retentionRate * 0.4) + (upsellRate * 0.2)
  ));

  // ── Revenue breakdown ────────────────────────────────────────────────────

  const LEAD_TYPE_LABEL: Record<string, string> = {
    workshop: "Workshop Services",
    rsa: "RSA",
    recovery: "Recovery",
  };
  const totalRev = invoiceByType.reduce((s, r) => s + Number(r.total), 0) || 1;
  const revenueBreakdown: RevenueBreakdownItem[] = invoiceByType.map((r) => ({
    label: LEAD_TYPE_LABEL[r.lead_type ?? ""] ?? "Other",
    value: Number(r.total),
    pct: pct(Number(r.total), totalRev),
  }));
  if (revenueBreakdown.length === 0) {
    revenueBreakdown.push({ label: "Other", value: 0, pct: 100 });
  }

  // ── Top performers ────────────────────────────────────────────────────────

  const companyAvgWonRate = agentStats.length
    ? agentStats.reduce((s, r) => s + pct(Number(r.won_count), Number(r.lead_count) || 1), 0) / agentStats.length
    : 0;
  const topPerformers: TopPerformer[] = agentStats.slice(0, 3).map((r) => ({
    agentId: r.agent_employee_id ?? "",
    name: r.employee_name ?? "Agent",
    metricValue: Number(r.won_count),
    targetPct: companyAvgWonRate > 0
      ? Math.round((pct(Number(r.won_count), Number(r.lead_count) || 1) / companyAvgWonRate) * 100)
      : 0,
  }));
  const needsAttention = agentStats
    .filter((r) => {
      const rate = pct(Number(r.won_count), Number(r.lead_count) || 1);
      return rate < companyAvgWonRate * 0.7 && Number(r.lead_count) >= 3;
    })
    .slice(0, 2)
    .map((r) => ({
      agentId: r.agent_employee_id ?? "",
      name: r.employee_name ?? "Agent",
      issue: `Conversion ${pct(Number(r.won_count), Number(r.lead_count) || 1).toFixed(0)}% (avg ${companyAvgWonRate.toFixed(0)}%)`,
    }));

  // ── Trend arrays ──────────────────────────────────────────────────────────

  const inboundTrend: DailyDataPoint[] = trendRows.map((r) => ({
    date: r.day,
    calls: r.inbound_calls,
    bookings: r.bookings,
    revenue: r.revenue,
  }));
  const outboundTrend: DailyDataPoint[] = trendRows.map((r) => ({
    date: r.day,
    calls: r.outbound_calls,
    bookings: r.bookings,
    revenue: r.revenue,
  }));

  // ── Team stats ────────────────────────────────────────────────────────────

  const inboundTeamStats: TeamStats = {
    totalCalls: Number(calls.inbound_total),
    answerRate: inboundAnswerRate,
    bookings: callSourceLeads,
    conversionRate: inquiryToBookingRate,
    score: inboundScore,
    grade: gradeFromScore(inboundScore),
  };
  const outboundTeamStats: TeamStats = {
    totalCalls: Number(calls.outbound_total),
    answerRate: outboundAnswerRate,
    bookings: Number(obBookings.outbound_bookings),
    conversionRate: outboundLeadToBooking,
    score: outboundScore,
    grade: gradeFromScore(outboundScore),
  };
  const portfolioTeamStats: TeamStats = {
    totalCalls: Number(touchpoints.touchpoints),
    answerRate: pct(Number(calls.completed), Number(calls.total) || 1),
    bookings: Number(leads.booked),
    conversionRate: customerToBookingRate,
    score: portfolioScore,
    grade: gradeFromScore(portfolioScore),
  };

  // ── Assemble ──────────────────────────────────────────────────────────────

  const topKpis: TopKpis = {
    totalRevenue: Number(revenueRow.total_revenue),
    totalBookings: Number(leads.booked),
    totalCallsHandled: Number(calls.total),
    showUpRate,
    totalCancellations: Number(leads.cancelled),
    prevTotalRevenue: Number(prevRevRow.total_revenue),
    prevTotalBookings: Number(prevLeads.booked),
    prevTotalCalls: Number(prevCalls.total),
  };

  const inbound: InboundMetrics = {
    callsReceived: Number(calls.inbound_total),
    answerRate: inboundAnswerRate,
    avgHandlingTimeSecs: Math.round(Number(avgDuration.avg_duration_secs) || 0),
    avgResponseTimeSecs: Math.round(Number(avgResponse.avg_response_secs) || 0),
    firstCallResolutionRate,
    bookingsCreated: callSourceLeads,
    abandonmentRate: inboundAbandonment,
    repeatCallRate,
    trend: inboundTrend,
    teamStats: inboundTeamStats,
  };

  const outbound: OutboundMetrics = {
    totalDials: Number(calls.outbound_total),
    answerRate: outboundAnswerRate,
    totalTalkTimeSecs: Number(calls.outbound_duration),
    contactsMade: Number(calls.outbound_completed),
    bookingsSet: Number(obBookings.outbound_bookings),
    showUpRate,
    leadToBookingConversion: outboundLeadToBooking,
    noShowRate: 100 - showUpRate,
    salesConversionRate,
    trend: outboundTrend,
    teamStats: outboundTeamStats,
  };

  const portfolio: PortfolioMetrics = {
    customersManaged: activeAccounts,
    monthlyTouchpoints: Number(touchpoints.touchpoints),
    bookingsCarIn: Number(pfCarIn.bookings_car_in),
    totalSales: Number(pfRevenue.total_sales),
    upsellRate,
    retentionRate,
    customerToBookingRate,
    crossSellRate,
    revenuePerCustomer: Math.round(revPerCustomer),
    revenueBreakdown,
    topPerformers,
    needsAttention,
    teamStats: portfolioTeamStats,
  };

  const funnel: ConversionFunnel = {
    totalCalls: Number(calls.total),
    connected: Number(calls.completed),
    leadsCreated: Number(leads.total_leads),
    bookings: Number(leads.booked),
    showUps: Number(leads.car_in),
    revenue: Number(revenueRow.total_revenue),
    overallConversionRate: pct(Number(leads.booked), Number(calls.total) || 1),
  };

  return { period: { from, to }, topKpis, inbound, outbound, portfolio, funnel };
}
