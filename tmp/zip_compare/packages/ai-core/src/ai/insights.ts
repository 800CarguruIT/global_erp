// packages/ai-core/src/ai/insights.ts
import { getSql } from "../db";
import { getOpenAIClientForCompany } from "./client";
import { canUseAi } from "./policy";

// ────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────

export type InsightSeverity = "info" | "success" | "warning" | "critical";
export type InsightCategory =
  | "revenue"
  | "operations"
  | "leads"
  | "inventory"
  | "hr"
  | "accounting"
  | "call-center"
  | "marketing"
  | "general";

export interface AiInsight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  metric?: string | number | null;
  metricLabel?: string | null;
  trend?: "up" | "down" | "flat" | null;
  trendPercent?: number | null;
  actionLabel?: string | null;
  actionHref?: string | null;
}

export interface AiInsightsResult {
  insights: AiInsight[];
  kpis: AiKpi[];
  summary: string | null;
  generatedAt: string;
  aiUsed: boolean;
}

export interface AiKpi {
  key: string;
  label: string;
  value: number;
  previousValue?: number | null;
  trend?: "up" | "down" | "flat";
  trendPercent?: number | null;
  format?: "number" | "currency" | "percent";
  subtitle?: string | null;
}

export type InsightContext =
  | { page: "company-dashboard"; companyId: string }
  | { page: "leads"; companyId: string }
  | { page: "workshop"; companyId: string }
  | { page: "inventory"; companyId: string }
  | { page: "accounting"; companyId: string }
  | { page: "hr"; companyId: string }
  | { page: "call-center"; companyId: string }
  | { page: "marketing"; companyId: string }
  | { page: "branch-dashboard"; companyId: string; branchId: string }
  | { page: "revenue"; companyId: string }
  | { page: "analytics"; companyId: string }
  | { page: "vendor"; companyId: string; vendorId: string }
  | { page: "global-dashboard" };

// ────────────────────────────────────────────────────
// Data Collectors (one per page context)
// ────────────────────────────────────────────────────

function n(v: any): number {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? num : 0;
}

async function collectCompanyDashboard(companyId: string) {
  const sql = getSql();

  const [leads] = await sql<{ total: number; open: number; won: number; lost: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lead_status IN ('open','processing'))::int AS open,
      COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won,
      COUNT(*) FILTER (WHERE lead_status = 'closed_lost')::int AS lost
    FROM leads WHERE company_id = ${companyId}
  `;

  const [jobs] = await sql<{ total: number; active: number; completed: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('in_progress','assigned','pending'))::int AS active,
      COUNT(*) FILTER (WHERE status IN ('completed','closed'))::int AS completed
    FROM work_orders WHERE company_id = ${companyId}
  `;

  const [calls] = await sql<{ today: number; missed: number }[]>`
    SELECT
      COUNT(*)::int AS today,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS missed
    FROM call_sessions
    WHERE company_id = ${companyId} AND created_at >= CURRENT_DATE
  `;

  const [invoices] = await sql<{ count: number; total_revenue: number; overdue: number }[]>`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(grand_total), 0)::numeric AS total_revenue,
      COUNT(*) FILTER (WHERE status = 'overdue' OR (due_date < CURRENT_DATE AND status != 'paid'))::int AS overdue
    FROM invoices WHERE company_id = ${companyId}
  `.catch(() => [{ count: 0, total_revenue: 0, overdue: 0 }]);

  const [weekAgo] = await sql<{ leads_last_week: number; leads_this_week: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - 14 AND created_at < CURRENT_DATE - 7)::int AS leads_last_week,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - 7)::int AS leads_this_week
    FROM leads WHERE company_id = ${companyId}
  `;

  return {
    leads: { total: n(leads?.total), open: n(leads?.open), won: n(leads?.won), lost: n(leads?.lost) },
    jobs: { total: n(jobs?.total), active: n(jobs?.active), completed: n(jobs?.completed) },
    calls: { today: n(calls?.today), missed: n(calls?.missed) },
    invoices: { count: n(invoices?.count), revenue: n(invoices?.total_revenue), overdue: n(invoices?.overdue) },
    trends: { leadsLastWeek: n(weekAgo?.leads_last_week), leadsThisWeek: n(weekAgo?.leads_this_week) },
  };
}

async function collectLeadsData(companyId: string) {
  const sql = getSql();

  const statusRows = await sql<{ status: string; count: number }[]>`
    SELECT lead_status AS status, COUNT(*)::int AS count
    FROM leads WHERE company_id = ${companyId}
    GROUP BY lead_status
  `;

  const sourceRows = await sql<{ source: string; count: number; won: number }[]>`
    SELECT
      COALESCE(source, 'unknown') AS source,
      COUNT(*)::int AS count,
      COUNT(*) FILTER (WHERE lead_status = 'closed_won')::int AS won
    FROM leads WHERE company_id = ${companyId}
    GROUP BY COALESCE(source, 'unknown')
    ORDER BY count DESC LIMIT 10
  `;

  const [aging] = await sql<{ stale_count: number; avg_age_days: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE created_at < CURRENT_DATE - 7 AND lead_status IN ('open','processing'))::int AS stale_count,
      COALESCE(AVG(EXTRACT(DAY FROM NOW() - created_at)) FILTER (WHERE lead_status IN ('open','processing')), 0)::int AS avg_age_days
    FROM leads WHERE company_id = ${companyId}
  `;

  const [velocity] = await sql<{ this_week: number; last_week: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - 7)::int AS this_week,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - 14 AND created_at < CURRENT_DATE - 7)::int AS last_week
    FROM leads WHERE company_id = ${companyId}
  `;

  return {
    byStatus: Object.fromEntries(statusRows.map((r) => [r.status, n(r.count)])),
    bySources: sourceRows.map((r) => ({ source: r.source, count: n(r.count), won: n(r.won) })),
    staleLeads: n(aging?.stale_count),
    avgAgeDays: n(aging?.avg_age_days),
    velocityThisWeek: n(velocity?.this_week),
    velocityLastWeek: n(velocity?.last_week),
  };
}

async function collectWorkshopData(companyId: string) {
  const sql = getSql();

  const statusRows = await sql<{ status: string; count: number }[]>`
    SELECT status, COUNT(*)::int AS count
    FROM work_orders WHERE company_id = ${companyId}
    GROUP BY status
  `;

  const [cycleTime] = await sql<{ avg_hours: number }[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status IN ('completed','closed')), 0)::int AS avg_hours
    FROM work_orders WHERE company_id = ${companyId}
  `;

  const [bayUtil] = await sql<{ total_bays: number; occupied: number }[]>`
    SELECT
      COUNT(*)::int AS total_bays,
      COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied
    FROM workshop_bays WHERE company_id = ${companyId}
  `.catch(() => [{ total_bays: 0, occupied: 0 }]);

  const [partsWaiting] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM work_order_items
    WHERE work_order_id IN (SELECT id FROM work_orders WHERE company_id = ${companyId} AND status = 'in_progress')
      AND status IN ('parts_pending','parts_ordered')
  `.catch(() => [{ count: 0 }]);

  return {
    byStatus: Object.fromEntries(statusRows.map((r) => [r.status, n(r.count)])),
    avgCycleTimeHours: n(cycleTime?.avg_hours),
    bayUtilization: { total: n(bayUtil?.total_bays), occupied: n(bayUtil?.occupied) },
    partsWaiting: n(partsWaiting?.count),
  };
}

async function collectInventoryData(companyId: string) {
  const sql = getSql();

  const [summary] = await sql<{ total_items: number; total_value: number; low_stock: number; zero_stock: number }[]>`
    SELECT
      COUNT(*)::int AS total_items,
      0::numeric AS total_value,
      COUNT(*) FILTER (WHERE on_hand > 0 AND on_hand <= 5)::int AS low_stock,
      COUNT(*) FILTER (WHERE on_hand <= 0)::int AS zero_stock
    FROM inventory_stock WHERE company_id = ${companyId}
  `.catch(() => [{ total_items: 0, total_value: 0, low_stock: 0, zero_stock: 0 }]);

  const [transfers] = await sql<{ pending: number }[]>`
    SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
    FROM inventory_transfer_orders WHERE company_id = ${companyId}
  `.catch(() => [{ pending: 0 }]);

  const topMoving = await sql<{ product_name: string; total_out: number }[]>`
    SELECT COALESCE(pc.part_number, pc.id::text) AS product_name, COALESCE(SUM(ABS(sm.quantity)), 0)::int AS total_out
    FROM inventory_movements sm
    LEFT JOIN parts_catalog pc ON pc.id = sm.part_id
    WHERE sm.company_id = ${companyId} AND sm.direction = 'out' AND sm.created_at >= CURRENT_DATE - 30
    GROUP BY COALESCE(pc.part_number, pc.id::text) ORDER BY total_out DESC LIMIT 5
  `.catch(() => []);

  return {
    totalItems: n(summary?.total_items),
    totalValue: n(summary?.total_value),
    lowStock: n(summary?.low_stock),
    zeroStock: n(summary?.zero_stock),
    pendingTransfers: n(transfers?.pending),
    topMoving: topMoving.map((r) => ({ name: r.product_name, qty: n(r.total_out) })),
  };
}

async function collectAccountingData(companyId: string) {
  const sql = getSql();

  const [invoiceSummary] = await sql<{ total: number; paid: number; overdue: number; revenue: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
      COUNT(*) FILTER (WHERE status != 'paid' AND due_date < CURRENT_DATE)::int AS overdue,
      COALESCE(SUM(grand_total) FILTER (WHERE status = 'paid'), 0)::numeric AS revenue
    FROM invoices WHERE company_id = ${companyId}
  `.catch(() => [{ total: 0, paid: 0, overdue: 0, revenue: 0 }]);

  const [journalCount] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM accounting_journals WHERE company_id = ${companyId}
  `.catch(() => [{ count: 0 }]);

  const monthlyRevenue = await sql<{ month: string; revenue: number }[]>`
    SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COALESCE(SUM(grand_total), 0)::numeric AS revenue
    FROM invoices WHERE company_id = ${companyId} AND status = 'paid' AND created_at >= CURRENT_DATE - 180
    GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month
  `.catch(() => []);

  return {
    invoices: { total: n(invoiceSummary?.total), paid: n(invoiceSummary?.paid), overdue: n(invoiceSummary?.overdue) },
    totalRevenue: n(invoiceSummary?.revenue),
    journalEntries: n(journalCount?.count),
    monthlyRevenue: monthlyRevenue.map((r) => ({ month: r.month, revenue: n(r.revenue) })),
  };
}

async function collectHrData(companyId: string) {
  const sql = getSql();

  const [counts] = await sql<{ total: number; technicians: number; managers: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(title, '')) LIKE '%tech%')::int AS technicians,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(title, '')) LIKE '%manager%')::int AS managers
    FROM employees WHERE company_id = ${companyId} AND scope IN ('company','branch')
  `;

  const branchDist = await sql<{ branch_name: string; count: number }[]>`
    SELECT b.name AS branch_name, COUNT(e.id)::int AS count
    FROM branches b LEFT JOIN employees e ON e.branch_id = b.id AND e.company_id = ${companyId}
    WHERE b.company_id = ${companyId} GROUP BY b.name ORDER BY count DESC
  `;

  return {
    total: n(counts?.total),
    technicians: n(counts?.technicians),
    managers: n(counts?.managers),
    byBranch: branchDist.map((r) => ({ branch: r.branch_name, count: n(r.count) })),
  };
}

async function collectCallCenterData(companyId: string) {
  const sql = getSql();

  const [stats] = await sql<{ total_today: number; answered: number; missed: number; avg_duration: number }[]>`
    SELECT
      COUNT(*)::int AS total_today,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS answered,
      COUNT(*) FILTER (WHERE status = 'failed' OR status = 'missed')::int AS missed,
      COALESCE(AVG(duration_seconds) FILTER (WHERE status = 'completed'), 0)::int AS avg_duration
    FROM call_sessions
    WHERE company_id = ${companyId} AND created_at >= CURRENT_DATE
  `;

  const [weekStats] = await sql<{ total_week: number; avg_per_day: number }[]>`
    SELECT
      COUNT(*)::int AS total_week,
      (COUNT(*)::numeric / GREATEST(EXTRACT(DAY FROM NOW() - (CURRENT_DATE - 7)), 1))::int AS avg_per_day
    FROM call_sessions
    WHERE company_id = ${companyId} AND created_at >= CURRENT_DATE - 7
  `;

  return {
    today: { total: n(stats?.total_today), answered: n(stats?.answered), missed: n(stats?.missed) },
    avgDurationSeconds: n(stats?.avg_duration),
    weekTotal: n(weekStats?.total_week),
    avgPerDay: n(weekStats?.avg_per_day),
  };
}

async function collectMarketingData(companyId: string) {
  const sql = getSql();

  const [campaigns] = await sql<{ total: number; active: number; draft: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('live','scheduled'))::int AS active,
      COUNT(*) FILTER (WHERE status = 'draft')::int AS draft
    FROM campaigns WHERE company_id = ${companyId}
  `.catch(() => [{ total: 0, active: 0, draft: 0 }]);

  const [templates] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM marketing_templates WHERE company_id = ${companyId}
  `.catch(() => [{ count: 0 }]);

  return {
    campaigns: { total: n(campaigns?.total), active: n(campaigns?.active), draft: n(campaigns?.draft) },
    templates: n(templates?.count),
  };
}

async function collectBranchDashboard(companyId: string, branchId: string) {
  const sql = getSql();

  const [jobs] = await sql<{ total: number; active: number; completed: number }[]>`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status IN ('in_progress','assigned','pending'))::int AS active,
      COUNT(*) FILTER (WHERE status IN ('completed','closed'))::int AS completed
    FROM work_orders WHERE company_id = ${companyId} AND branch_id = ${branchId}
  `;

  const [bays] = await sql<{ total: number; occupied: number }[]>`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'occupied')::int AS occupied
    FROM workshop_bays WHERE company_id = ${companyId} AND branch_id = ${branchId}
  `.catch(() => [{ total: 0, occupied: 0 }]);

  const [inventory] = await sql<{ low_stock: number }[]>`
    SELECT COUNT(*) FILTER (WHERE on_hand > 0 AND on_hand <= 5)::int AS low_stock
    FROM inventory_stock WHERE company_id = ${companyId} AND location_id IN (
      SELECT id FROM inventory_locations WHERE branch_id = ${branchId}
    )
  `.catch(() => [{ low_stock: 0 }]);

  return {
    jobs: { total: n(jobs?.total), active: n(jobs?.active), completed: n(jobs?.completed) },
    bays: { total: n(bays?.total), occupied: n(bays?.occupied) },
    lowStockItems: n(inventory?.low_stock),
  };
}

async function collectRevenueData(companyId: string) {
  const sql = getSql();

  const monthly = await sql<{ month: string; revenue: number; count: number }[]>`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') AS month,
      COALESCE(SUM(grand_total), 0)::numeric AS revenue,
      COUNT(*)::int AS count
    FROM invoices WHERE company_id = ${companyId} AND status = 'paid' AND created_at >= CURRENT_DATE - 365
    GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month
  `.catch(() => []);

  const [totals] = await sql<{ ytd: number; mtd: number; avg_ticket: number }[]>`
    SELECT
      COALESCE(SUM(grand_total) FILTER (WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)), 0)::numeric AS ytd,
      COALESCE(SUM(grand_total) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)::numeric AS mtd,
      COALESCE(AVG(grand_total), 0)::numeric AS avg_ticket
    FROM invoices WHERE company_id = ${companyId} AND status = 'paid'
  `.catch(() => [{ ytd: 0, mtd: 0, avg_ticket: 0 }]);

  const topServices = await sql<{ service: string; revenue: number }[]>`
    SELECT COALESCE(ii.description, 'Other') AS service, SUM(ii.total)::numeric AS revenue
    FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.company_id = ${companyId} AND i.status = 'paid' AND i.created_at >= CURRENT_DATE - 90
    GROUP BY COALESCE(ii.description, 'Other') ORDER BY revenue DESC LIMIT 5
  `.catch(() => []);

  return {
    monthlyRevenue: monthly.map((r) => ({ month: r.month, revenue: n(r.revenue), invoices: n(r.count) })),
    ytdRevenue: n(totals?.ytd),
    mtdRevenue: n(totals?.mtd),
    avgTicketSize: n(totals?.avg_ticket),
    topServices: topServices.map((r) => ({ service: r.service, revenue: n(r.revenue) })),
  };
}

// ────────────────────────────────────────────────────
// AI Analysis Engine
// ────────────────────────────────────────────────────

function buildPrompt(page: string, data: Record<string, any>, lang: string): string {
  return `You are an AI business analyst for an automotive workshop ERP system.
Analyze the following data snapshot for the "${page}" context and generate actionable insights.

DATA:
${JSON.stringify(data, null, 2)}

Generate a JSON response with this exact structure:
{
  "insights": [
    {
      "id": "unique-id",
      "category": "one of: revenue, operations, leads, inventory, hr, accounting, call-center, marketing, general",
      "severity": "one of: info, success, warning, critical",
      "title": "Short title (max 60 chars)",
      "description": "Actionable insight description (max 200 chars)",
      "metric": "optional number or formatted string",
      "metricLabel": "optional label for the metric",
      "trend": "up, down, or flat (if applicable)",
      "trendPercent": "optional percentage change",
      "actionLabel": "optional CTA button text",
      "actionHref": "optional relative URL to navigate to"
    }
  ],
  "summary": "One-sentence executive summary of the current state"
}

Rules:
- Generate 3-6 insights ordered by severity (critical first)
- Use "critical" severity only for genuinely urgent issues (overdue payments, zero stock, missed SLAs)
- Use "warning" for things needing attention within 1-2 days
- Use "success" to highlight positive trends
- Include actionable next steps in descriptions
- Use the ${lang} language for all text
- Be specific with numbers, not vague
- Suggest concrete actions, not generic advice`;
}

function generateRuleBasedInsights(page: string, data: Record<string, any>): AiInsight[] {
  const insights: AiInsight[] = [];
  let idx = 0;
  const id = () => `rule-${page}-${idx++}`;

  if (page === "company-dashboard" || page === "leads") {
    const stale = data.staleLeads ?? data.leads?.open ?? 0;
    if (stale > 5) {
      insights.push({
        id: id(), category: "leads", severity: "warning",
        title: `${stale} leads need attention`,
        description: `${stale} leads have been open for over 7 days without progress. Consider assigning or following up.`,
        metric: stale, metricLabel: "Stale leads", actionLabel: "View Leads", actionHref: "leads",
      });
    }
    const convRate = data.leads ? (data.leads.won / Math.max(data.leads.total, 1)) * 100 : 0;
    if (convRate > 0) {
      insights.push({
        id: id(), category: "leads", severity: convRate > 30 ? "success" : "info",
        title: `Lead conversion rate: ${convRate.toFixed(1)}%`,
        description: convRate > 30 ? "Strong conversion rate. Keep up the momentum." : "Consider improving follow-up speed to boost conversions.",
        metric: `${convRate.toFixed(1)}%`, metricLabel: "Conversion rate",
      });
    }
  }

  if (page === "company-dashboard" || page === "accounting" || page === "revenue") {
    const overdue = data.invoices?.overdue ?? 0;
    if (overdue > 0) {
      insights.push({
        id: id(), category: "accounting", severity: overdue > 10 ? "critical" : "warning",
        title: `${overdue} overdue invoice${overdue > 1 ? "s" : ""}`,
        description: `${overdue} invoice${overdue > 1 ? "s are" : " is"} past due. Follow up to maintain cash flow.`,
        metric: overdue, metricLabel: "Overdue", actionLabel: "View Invoices", actionHref: "accounting",
      });
    }
  }

  if (page === "workshop" || page === "company-dashboard") {
    const partsWaiting = data.partsWaiting ?? 0;
    if (partsWaiting > 3) {
      insights.push({
        id: id(), category: "operations", severity: "warning",
        title: `${partsWaiting} jobs waiting on parts`,
        description: "Multiple active jobs are blocked on parts procurement. Check supplier status.",
        metric: partsWaiting, metricLabel: "Waiting on parts", actionLabel: "View Procurement", actionHref: "procurement",
      });
    }
    const bayData = data.bayUtilization;
    if (bayData && bayData.total > 0) {
      const util = Math.round((bayData.occupied / bayData.total) * 100);
      insights.push({
        id: id(), category: "operations", severity: util > 90 ? "warning" : "info",
        title: `Bay utilization: ${util}%`,
        description: util > 90 ? "Nearly full capacity. Consider scheduling adjustments." : `${bayData.total - bayData.occupied} bays available for new jobs.`,
        metric: `${util}%`, metricLabel: "Bay utilization",
      });
    }
  }

  if (page === "inventory" || page === "company-dashboard") {
    const low = data.lowStock ?? 0;
    const zero = data.zeroStock ?? 0;
    if (zero > 0) {
      insights.push({
        id: id(), category: "inventory", severity: "critical",
        title: `${zero} items out of stock`,
        description: "Zero stock on active items may block workshop jobs. Reorder immediately.",
        metric: zero, metricLabel: "Out of stock", actionLabel: "Reorder", actionHref: "inventory",
      });
    }
    if (low > 0) {
      insights.push({
        id: id(), category: "inventory", severity: "warning",
        title: `${low} items at low stock`,
        description: "These items are near their reorder point. Plan procurement to avoid stockouts.",
        metric: low, metricLabel: "Low stock", actionLabel: "View Stock", actionHref: "inventory/stock",
      });
    }
  }

  if (page === "call-center") {
    const missed = data.today?.missed ?? 0;
    const total = data.today?.total ?? 0;
    if (missed > 0 && total > 0) {
      const missRate = Math.round((missed / total) * 100);
      insights.push({
        id: id(), category: "call-center", severity: missRate > 20 ? "critical" : "warning",
        title: `${missRate}% calls missed today`,
        description: `${missed} of ${total} calls were missed. ${missRate > 20 ? "Staffing may be insufficient." : "Monitor for patterns."}`,
        metric: `${missRate}%`, metricLabel: "Miss rate",
      });
    }
  }

  return insights;
}

function buildKpis(page: string, data: Record<string, any>): AiKpi[] {
  const kpis: AiKpi[] = [];

  if (page === "company-dashboard") {
    const leadsThisWeek = data.trends?.leadsThisWeek ?? 0;
    const leadsLastWeek = data.trends?.leadsLastWeek ?? 0;
    const trendPct = leadsLastWeek > 0 ? Math.round(((leadsThisWeek - leadsLastWeek) / leadsLastWeek) * 100) : 0;

    kpis.push(
      { key: "total_leads", label: "Total Leads", value: data.leads?.total ?? 0, format: "number" },
      { key: "open_leads", label: "Open Leads", value: data.leads?.open ?? 0, format: "number", subtitle: `${data.leads?.won ?? 0} won` },
      { key: "active_jobs", label: "Active Jobs", value: data.jobs?.active ?? 0, format: "number", subtitle: `${data.jobs?.completed ?? 0} completed` },
      { key: "calls_today", label: "Calls Today", value: data.calls?.today ?? 0, format: "number", subtitle: `${data.calls?.missed ?? 0} missed` },
      { key: "revenue", label: "Total Revenue", value: data.invoices?.revenue ?? 0, format: "currency" },
      { key: "overdue_invoices", label: "Overdue Invoices", value: data.invoices?.overdue ?? 0, format: "number" },
      { key: "lead_velocity", label: "Lead Velocity", value: leadsThisWeek, format: "number", previousValue: leadsLastWeek, trend: trendPct > 0 ? "up" : trendPct < 0 ? "down" : "flat", trendPercent: trendPct, subtitle: "This week vs last" },
      { key: "conversion_rate", label: "Conversion Rate", value: data.leads?.total > 0 ? Math.round((data.leads.won / data.leads.total) * 100) : 0, format: "percent" },
    );
  }

  if (page === "leads") {
    const total = Object.values(data.byStatus as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    const open = (data.byStatus?.open ?? 0) + (data.byStatus?.processing ?? 0);
    const convRate = total > 0 ? Math.round(((data.byStatus?.closed_won ?? 0) / total) * 100) : 0;
    const velTrend = data.velocityLastWeek > 0 ? Math.round(((data.velocityThisWeek - data.velocityLastWeek) / data.velocityLastWeek) * 100) : 0;

    kpis.push(
      { key: "total", label: "Total Leads", value: total, format: "number" },
      { key: "open", label: "Open / In Progress", value: open, format: "number" },
      { key: "conversion", label: "Conversion Rate", value: convRate, format: "percent" },
      { key: "stale", label: "Stale (>7 days)", value: data.staleLeads ?? 0, format: "number" },
      { key: "avg_age", label: "Avg Lead Age", value: data.avgAgeDays ?? 0, format: "number", subtitle: "days" },
      { key: "velocity", label: "New This Week", value: data.velocityThisWeek ?? 0, format: "number", trend: velTrend > 0 ? "up" : velTrend < 0 ? "down" : "flat", trendPercent: velTrend },
    );
  }

  if (page === "workshop") {
    const total = Object.values(data.byStatus as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    const active = (data.byStatus?.in_progress ?? 0) + (data.byStatus?.assigned ?? 0) + (data.byStatus?.pending ?? 0);
    const bayPct = data.bayUtilization?.total > 0 ? Math.round((data.bayUtilization.occupied / data.bayUtilization.total) * 100) : 0;

    kpis.push(
      { key: "total_jobs", label: "Total Jobs", value: total, format: "number" },
      { key: "active_jobs", label: "Active Jobs", value: active, format: "number" },
      { key: "cycle_time", label: "Avg Cycle Time", value: data.avgCycleTimeHours ?? 0, format: "number", subtitle: "hours" },
      { key: "bay_util", label: "Bay Utilization", value: bayPct, format: "percent" },
      { key: "parts_waiting", label: "Parts Waiting", value: data.partsWaiting ?? 0, format: "number" },
    );
  }

  if (page === "inventory") {
    kpis.push(
      { key: "total_items", label: "Total SKUs", value: data.totalItems ?? 0, format: "number" },
      { key: "total_value", label: "Inventory Value", value: data.totalValue ?? 0, format: "currency" },
      { key: "low_stock", label: "Low Stock Items", value: data.lowStock ?? 0, format: "number" },
      { key: "zero_stock", label: "Out of Stock", value: data.zeroStock ?? 0, format: "number" },
      { key: "pending_transfers", label: "Pending Transfers", value: data.pendingTransfers ?? 0, format: "number" },
    );
  }

  if (page === "accounting" || page === "revenue") {
    kpis.push(
      { key: "total_revenue", label: "Total Revenue", value: data.totalRevenue ?? data.ytdRevenue ?? 0, format: "currency" },
      { key: "mtd_revenue", label: "MTD Revenue", value: data.mtdRevenue ?? 0, format: "currency" },
      { key: "invoices_paid", label: "Invoices Paid", value: data.invoices?.paid ?? 0, format: "number" },
      { key: "invoices_overdue", label: "Overdue", value: data.invoices?.overdue ?? 0, format: "number" },
      { key: "avg_ticket", label: "Avg Ticket Size", value: data.avgTicketSize ?? 0, format: "currency" },
    );
  }

  if (page === "hr") {
    kpis.push(
      { key: "total_employees", label: "Total Employees", value: data.total ?? 0, format: "number" },
      { key: "technicians", label: "Technicians", value: data.technicians ?? 0, format: "number" },
      { key: "managers", label: "Managers", value: data.managers ?? 0, format: "number" },
    );
  }

  if (page === "call-center") {
    const missRate = data.today?.total > 0 ? Math.round((data.today.missed / data.today.total) * 100) : 0;
    kpis.push(
      { key: "calls_today", label: "Calls Today", value: data.today?.total ?? 0, format: "number" },
      { key: "answered", label: "Answered", value: data.today?.answered ?? 0, format: "number" },
      { key: "missed", label: "Missed", value: data.today?.missed ?? 0, format: "number" },
      { key: "miss_rate", label: "Miss Rate", value: missRate, format: "percent" },
      { key: "avg_duration", label: "Avg Duration", value: data.avgDurationSeconds ?? 0, format: "number", subtitle: "seconds" },
      { key: "week_total", label: "This Week", value: data.weekTotal ?? 0, format: "number", subtitle: `~${data.avgPerDay ?? 0}/day` },
    );
  }

  if (page === "marketing") {
    kpis.push(
      { key: "campaigns_total", label: "Total Campaigns", value: data.campaigns?.total ?? 0, format: "number" },
      { key: "campaigns_active", label: "Active", value: data.campaigns?.active ?? 0, format: "number" },
      { key: "campaigns_draft", label: "Drafts", value: data.campaigns?.draft ?? 0, format: "number" },
      { key: "templates", label: "Templates", value: data.templates ?? 0, format: "number" },
    );
  }

  return kpis;
}

// ────────────────────────────────────────────────────
// Main Public API
// ────────────────────────────────────────────────────

export async function generateInsights(
  ctx: InsightContext,
  options: { lang?: string } = {}
): Promise<AiInsightsResult> {
  const lang = options.lang ?? "en";
  const page = ctx.page;
  const companyId = "companyId" in ctx ? ctx.companyId : undefined;

  // 1. Collect data based on page context
  let data: Record<string, any> = {};
  try {
    switch (page) {
      case "company-dashboard":
        data = await collectCompanyDashboard(companyId!);
        break;
      case "leads":
        data = await collectLeadsData(companyId!);
        break;
      case "workshop":
        data = await collectWorkshopData(companyId!);
        break;
      case "inventory":
        data = await collectInventoryData(companyId!);
        break;
      case "accounting":
        data = await collectAccountingData(companyId!);
        break;
      case "hr":
        data = await collectHrData(companyId!);
        break;
      case "call-center":
        data = await collectCallCenterData(companyId!);
        break;
      case "marketing":
        data = await collectMarketingData(companyId!);
        break;
      case "branch-dashboard":
        data = await collectBranchDashboard(companyId!, (ctx as any).branchId);
        break;
      case "revenue":
        data = await collectRevenueData(companyId!);
        break;
      case "analytics":
        data = { ...(await collectCompanyDashboard(companyId!)), ...(await collectRevenueData(companyId!)) };
        break;
      default:
        data = {};
    }
  } catch (err) {
    console.error(`[AI Insights] Data collection failed for ${page}:`, err);
  }

  // 2. Generate rule-based insights (always works, no AI key needed)
  const ruleInsights = generateRuleBasedInsights(page, data);

  // 3. Generate KPIs
  const kpis = buildKpis(page, data);

  // 4. Try AI-enhanced analysis
  let aiInsights: AiInsight[] = [];
  let summary: string | null = null;
  let aiUsed = false;

  try {
    const allowed = await canUseAi("ai.assistant", { companyId }).catch(() => true);
    const { client } = await getOpenAIClientForCompany(companyId ?? null);

    if (allowed && client) {
      const prompt = buildPrompt(page, data, lang);
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.insights)) {
        aiInsights = parsed.insights;
      }
      summary = parsed.summary ?? null;
      aiUsed = true;
    }
  } catch (err) {
    console.error(`[AI Insights] AI analysis failed for ${page}:`, err);
  }

  // 5. Merge: AI insights first (if any), then rule-based (deduplicated)
  const seenCategories = new Set(aiInsights.map((i) => i.category));
  const mergedInsights = [
    ...aiInsights,
    ...ruleInsights.filter((r) => !seenCategories.has(r.category)),
  ].slice(0, 8);

  return {
    insights: mergedInsights,
    kpis,
    summary,
    generatedAt: new Date().toISOString(),
    aiUsed,
  };
}
