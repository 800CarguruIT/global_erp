import * as configRepo from "./configRepository";
import * as advisorRepo from "./advisorRepository";
import * as funnelRepo from "./funnelRepository";
import * as leadDistEngine from "./leadDistribution/engine";
import * as leadDistRepo from "./leadDistribution/repository";
import * as commissionEngine from "./leadDistribution/commissionEngine";
import { getSql } from "../db";
import type {
  PisFilter, PisMasterData, PisKpi, FocBanner, SlaItem,
  EstimatePipelineData, WipData, CollectionsData,
} from "./types";

// --- CONFIG ---
export const getConfig = configRepo.getConfig;
export const updateConfig = configRepo.updateConfig;
export const getAllConfigs = configRepo.getAllConfigs;

// --- ADVISORS ---
export const getAdvisorScores = advisorRepo.getAdvisorScores;
export const computeAndStoreScores = advisorRepo.computeAndStoreScores;

// --- FUNNEL ---
export const getFunnelData = funnelRepo.getFunnelData;

// --- LEAD DISTRIBUTION ---
export const routeLead = leadDistEngine.routeLead;
export const acceptLead = leadDistEngine.acceptLead;
export const cascadeLead = leadDistEngine.cascadeLead;
export const releaseLead = leadDistEngine.releaseLead;
export const checkExpiredOffers = leadDistEngine.checkExpiredOffers;
export const simulateDistribution = leadDistEngine.simulateDistribution;
export const getQueueItems = leadDistRepo.getQueueItems;
export const getQueueHistory = leadDistRepo.getQueueHistory;

// --- COMMISSION ---
export const computeCommissions = commissionEngine.computeCommissions;
export const getCommissions = commissionEngine.getCommissions;

// --- MASTER DASHBOARD ---
export async function getMasterData(filter: PisFilter): Promise<PisMasterData> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [advisors, funnel, config] = await Promise.all([
    advisorRepo.getAdvisorScores(companyId),
    funnelRepo.getFunnelData(filter),
    configRepo.getConfig(companyId),
  ]);

  // KPI queries — all company data (legacy leads have no agent_employee_id assigned)
  // Per-advisor breakdowns still filter by SC department where possible
  const [revRow, carInRow, wipRow, estRow, commRow, focRow, avgInvRow, wipCapRow, slaEstRow] = await Promise.all([
    sql<{total_revenue: number; total_cost: number}[]>`
      SELECT COALESCE(SUM(i.grand_total),0)::numeric as total_revenue,
             COALESCE(SUM(est.total_cost),0)::numeric as total_cost
      FROM invoices i
      LEFT JOIN estimates est ON est.id = i.estimate_id
      WHERE i.company_id=${companyId} AND i.created_at BETWEEN ${from} AND ${to}
    `,
    sql<{count: number}[]>`
      SELECT COUNT(*)::int as count FROM leads
      WHERE company_id=${companyId} AND checkin_at IS NOT NULL AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<{count: number}[]>`
      SELECT COUNT(*)::int as count FROM work_orders
      WHERE company_id=${companyId} AND status NOT IN ('completed','cancelled') AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<{total: number; unapproved: number; unapproved_value: number}[]>`
      SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE LOWER(status) NOT IN ('approved','invoiced'))::int as unapproved,
             COALESCE(SUM(grand_total) FILTER (WHERE LOWER(status) NOT IN ('approved','invoiced','rejected','cancelled')),0)::numeric as unapproved_value
      FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<{total: number}[]>`
      SELECT COALESCE(SUM(commission_amount),0)::numeric as total FROM pis_commission_records WHERE company_id=${companyId}
    `,
    sql<{foc_count: number; total_count: number}[]>`
      SELECT COUNT(*) FILTER (WHERE grand_total = 0)::int as foc_count, COUNT(*)::int as total_count
      FROM invoices WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<{avg_value: number}[]>`
      SELECT COALESCE(AVG(grand_total) FILTER (WHERE grand_total > 0),0)::numeric as avg_value
      FROM invoices WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<{count: number}[]>`
      SELECT COUNT(*)::int as count FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.company_id=${companyId} AND e.department='Service Center Sales Department' AND u.is_active=true
    `,
    sql<{est_approval_pct: number}[]>`
      SELECT CASE WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE LOWER(status) IN ('approved','invoiced'))::numeric / COUNT(*) * 100) ELSE 0 END as est_approval_pct
      FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
  ]);

  const totalRevenue = Number(revRow[0]?.total_revenue ?? 0);
  const totalCost = Number(revRow[0]?.total_cost ?? 0);
  const gpPct = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const focCount = focRow[0]?.foc_count ?? 0;
  const totalInvoices = focRow[0]?.total_count ?? 0;
  const focRate = totalInvoices > 0 ? (focCount / totalInvoices) * 100 : 0;
  const zeroRevAdvisors = advisors.filter(a => a.revenue === 0);
  const avgInvoiceValue = Number(avgInvRow[0]?.avg_value ?? 0);
  // wipCapacity available for future use: wipCapRow[0]?.count

  const kpis: PisKpi[] = [
    { key: "totalRevenue", label: "Total Revenue", value: `AED ${Math.round(totalRevenue / 1000)}K`, subtitle: `GP: AED ${Math.round((totalRevenue - totalCost) / 1000)}K`, trend: "up", color: "text-white" },
    { key: "teamGpPct", label: "Team GP%", value: `${gpPct.toFixed(1)}%`, subtitle: gpPct >= config.revenue_targets.gp_target_pct ? "Above target" : "Below target", trend: gpPct >= config.revenue_targets.gp_target_pct ? "up" : "down", color: "text-yellow-400" },
    { key: "teamFocRate", label: "Team FOC Rate", value: `${focRate.toFixed(1)}%`, subtitle: `${focCount} FOC / ${totalInvoices} cars`, trend: focRate > config.revenue_targets.foc_max_pct ? "down" : "up", color: "text-red-400" },
    { key: "carsInMtd", label: "Cars In MTD", value: carInRow[0]?.count ?? 0, subtitle: `${advisors.length} active advisors`, trend: "flat", color: "text-emerald-400" },
    { key: "activeWip", label: "Active WIP", value: wipRow[0]?.count ?? 0, subtitle: `AED ${Math.round(totalRevenue / Math.max(wipRow[0]?.count ?? 1, 1))} avg/unit`, trend: "flat", color: "text-cyan-400" },
    { key: "unapprovedEst", label: "Unapproved Est.", value: `AED ${Math.round(Number(estRow[0]?.unapproved_value ?? 0) / 1000)}K`, subtitle: `${((estRow[0]?.unapproved ?? 0) / Math.max(estRow[0]?.total ?? 1, 1) * 100).toFixed(0)}% pipeline`, trend: "down", color: "text-orange-400" },
    { key: "commissionPool", label: "Commission Pool", value: `AED ${Math.round(Number(commRow[0]?.total ?? 0) / 1000)}K`, subtitle: `Avg ${advisors.length > 0 ? ((Number(commRow[0]?.total ?? 0) / advisors.length / Math.max(totalRevenue, 1) * 100)).toFixed(1) : "0"}% eff. rate`, trend: "flat", color: "text-purple-400" },
    { key: "zeroRevenue", label: "Zero Revenue", value: zeroRevAdvisors.length, subtitle: zeroRevAdvisors.map(a => a.advisorName?.split(" ")[0]).join(", ") || "None", trend: zeroRevAdvisors.length > 0 ? "down" : "up", color: "text-red-500" },
  ];

  // FOC loss from avg invoice value (real data)
  const focLossPerUnit = avgInvoiceValue > 0 ? avgInvoiceValue : (config.revenue_targets as any).foc_loss_per_unit ?? 1300;
  const focBanner: FocBanner | null = focRate > 30 ? { focRate, focCount, totalCars: totalInvoices, estimatedLoss: Math.round(focCount * focLossPerUnit) } : null;

  // SLA items — use available data, compute simple metrics
  const estApprovalPct = Number(slaEstRow[0]?.est_approval_pct ?? 0);
  const fmtPct = (v: number) => v > 0 ? `${Math.round(v)}%` : "N/A";
  const bookingCarInPct = funnel[3]?.count > 0 && funnel[4]?.count > 0
    ? Math.round((funnel[4].count / funnel[3].count) * 100) : 0;
  const wipOnTimePct = wipRow[0]?.count > 0 ? 100 : 0; // simplified

  const slaItems: SlaItem[] = [
    { key: "lead_arrival_assignment", label: "Lead arrival → assignment", target: "< 2 min", actual: "N/A", status: "WARNING", sourceEngine: "Funnel Intelligence" },
    { key: "assignment_accept", label: "Assignment → accept/decline", target: "< 15 min", actual: "N/A", status: "WARNING", sourceEngine: "Funnel Intelligence" },
    { key: "accept_first_contact", label: "Accept → first contact", target: "< 5 min", actual: "N/A", status: "WARNING", sourceEngine: "Funnel Intelligence" },
    { key: "first_contact_booking", label: "First contact → booking", target: "< 24h", actual: "N/A", status: "WARNING", sourceEngine: "Funnel Intelligence" },
    { key: "booking_car_in_pct", label: "Booking → car-in on-time %", target: ">= 80%", actual: fmtPct(bookingCarInPct), status: bookingCarInPct >= 80 ? "ON_TRACK" : bookingCarInPct >= 60 ? "WARNING" : "BREACH", sourceEngine: "Funnel Intelligence" },
    { key: "car_in_estimate", label: "Car-in → estimate created", target: "< 30 min", actual: "N/A", status: "WARNING", sourceEngine: "Funnel Intelligence" },
    { key: "estimate_approval_rate", label: "Estimate approval rate", target: ">= 75%", actual: fmtPct(estApprovalPct), status: estApprovalPct >= 75 ? "ON_TRACK" : estApprovalPct >= 60 ? "WARNING" : "BREACH", sourceEngine: "Agent Performance" },
    { key: "wip_on_time", label: "WIP job on-time completion", target: ">= 85%", actual: fmtPct(wipOnTimePct), status: wipOnTimePct >= 85 ? "ON_TRACK" : wipOnTimePct >= 70 ? "WARNING" : "BREACH", sourceEngine: "Anomaly Detection" },
    { key: "customer_update_wip", label: "Customer update if WIP delayed", target: "100% notified", actual: "N/A", status: "WARNING", sourceEngine: "Anomaly Detection" },
    { key: "job_complete_invoice", label: "Job complete → invoice", target: "< 30 min", actual: "N/A", status: "WARNING", sourceEngine: "Agent Performance" },
    { key: "invoice_pickup", label: "Invoice paid → vehicle pickup", target: "< 4 hours", actual: "N/A", status: "WARNING", sourceEngine: "Anomaly Detection" },
    { key: "invoice_followup", label: "Invoice paid → post-sale follow-up", target: "< 48 hr", actual: "N/A", status: "WARNING", sourceEngine: "Agent Performance" },
  ];

  return { kpis, focBanner, funnel, leaderboard: advisors, slaItems };
}

// --- ESTIMATES ---
export async function getEstimatePipeline(filter: PisFilter): Promise<EstimatePipelineData> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [totals, perAdvisor] = await Promise.all([
    sql<any[]>`
      SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE LOWER(status) IN ('approved','invoiced'))::int as approved,
             COUNT(*) FILTER (WHERE LOWER(status) = 'rejected')::int as rejected,
             COALESCE(SUM(grand_total) FILTER (WHERE LOWER(status) = 'rejected'),0)::numeric as rejected_value,
             COALESCE(SUM(grand_total) FILTER (WHERE LOWER(status) NOT IN ('approved','invoiced','rejected','cancelled')),0)::numeric as unapproved_pipeline,
             COUNT(*) FILTER (WHERE LOWER(status) = 'pending' AND created_at < now() - interval '30 minutes')::int as pending_over_sla
      FROM estimates WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<any[]>`
      SELECT emp.full_name as advisor_name, COUNT(*)::int as total, COUNT(*) FILTER (WHERE LOWER(est.status) IN ('approved','invoiced'))::int as approved,
             COUNT(*) FILTER (WHERE LOWER(est.status) = 'rejected')::int as rejected, COUNT(*) FILTER (WHERE LOWER(est.status) NOT IN ('approved','invoiced','rejected','cancelled'))::int as pending
      FROM estimates est
      JOIN leads l ON l.id = est.lead_id
      JOIN employees emp ON emp.id = l.agent_employee_id
      WHERE est.company_id=${companyId} AND est.created_at BETWEEN ${from} AND ${to}
      GROUP BY emp.id, emp.full_name ORDER BY total DESC
    `,
  ]);

  const t = totals[0] ?? {};
  return {
    approvalRate: t.total > 0 ? Math.round((t.approved / t.total) * 100 * 10) / 10 : 0,
    totalEstimates: t.total ?? 0, approvedCount: t.approved ?? 0, rejectedCount: t.rejected ?? 0,
    rejectedValueAed: Number(t.rejected_value ?? 0), unapprovedPipeline: Number(t.unapproved_pipeline ?? 0),
    pendingOverSla: t.pending_over_sla ?? 0,
    perAdvisor: perAdvisor.map(r => ({
      advisorName: r.advisor_name, total: r.total, approved: r.approved, rejected: r.rejected, pending: r.pending,
      approvalRate: r.total > 0 ? Math.round((r.approved / r.total) * 100 * 10) / 10 : 0,
    })),
  };
}

// --- WIP ---
export async function getWipData(filter: PisFilter): Promise<WipData> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [wipTotals, zeroRevWip, perAdvisor, advisorCount] = await Promise.all([
    sql<any[]>`
      SELECT COUNT(*)::int as active, COUNT(*) FILTER (WHERE status='completed')::int as completed,
             COUNT(*) FILTER (WHERE status='completed' AND work_completed_at IS NOT NULL)::int as on_time
      FROM work_orders WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}
    `,
    sql<any[]>`
      SELECT DISTINCT emp.full_name
      FROM work_orders wo
      JOIN leads l ON l.id = wo.lead_id
      JOIN employees emp ON emp.id = l.agent_employee_id
      WHERE wo.company_id=${companyId} AND wo.status='completed' AND wo.created_at BETWEEN ${from} AND ${to}
        AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.work_order_id = wo.id)
    `,
    sql<any[]>`
      SELECT emp.full_name as advisor_name,
             COUNT(*) FILTER (WHERE wo.status NOT IN ('completed','cancelled'))::int as active_jobs,
             COUNT(*) FILTER (WHERE wo.status='completed')::int as completed_jobs,
             COUNT(*) FILTER (WHERE wo.status='completed' AND wo.work_completed_at IS NOT NULL)::int as on_time
      FROM work_orders wo
      JOIN leads l ON l.id = wo.lead_id
      JOIN employees emp ON emp.id = l.agent_employee_id
      WHERE wo.company_id=${companyId} AND wo.created_at BETWEEN ${from} AND ${to}
      GROUP BY emp.id, emp.full_name
    `,
    sql<{count: number}[]>`
      SELECT COUNT(*)::int as count FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE e.company_id=${companyId} AND e.department='Service Center Sales Department' AND u.is_active=true
    `,
  ]);

  const t = wipTotals[0] ?? {};
  return {
    activeWip: t.active ?? 0, totalCapacity: advisorCount[0]?.count ?? 20,
    onTimePct: t.completed > 0 ? Math.round((t.on_time / t.completed) * 100 * 10) / 10 : 0,
    pickupRate: 0, zeroRevenueWip: zeroRevWip.length, zeroRevenueAdvisors: zeroRevWip.map((r: any) => r.full_name),
    perAdvisor: perAdvisor.map((r: any) => ({
      advisorName: r.advisor_name, activeJobs: r.active_jobs,
      onTimePct: r.completed_jobs > 0 ? Math.round((r.on_time / r.completed_jobs) * 100) : 0, pickupRate: 0, zeroRevenue: 0,
    })),
  };
}

// --- COLLECTIONS ---
export async function getCollectionsData(filter: PisFilter): Promise<CollectionsData> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  const [totals, perAdvisor] = await Promise.all([
    sql<any[]>`
      SELECT COALESCE(SUM(i.grand_total),0)::numeric as revenue, COALESCE(SUM(est.total_cost),0)::numeric as cost,
             COALESCE(SUM(CASE WHEN i.paid_at IS NOT NULL THEN i.grand_total ELSE 0 END),0)::numeric as collected,
             COUNT(*)::int as total_count,
             COUNT(*) FILTER (WHERE i.paid_at IS NOT NULL)::int as fully_paid,
             COALESCE(SUM(CASE WHEN i.paid_at IS NULL THEN i.grand_total ELSE 0 END),0)::numeric as outstanding
      FROM invoices i LEFT JOIN estimates est ON est.id = i.estimate_id
      WHERE i.company_id=${companyId} AND i.created_at BETWEEN ${from} AND ${to}
    `,
    sql<any[]>`
      SELECT emp.full_name as advisor_name,
             COALESCE(SUM(i.grand_total),0)::numeric as revenue,
             COALESCE(SUM(est.total_cost),0)::numeric as cost,
             COALESCE(SUM(CASE WHEN i.paid_at IS NOT NULL THEN i.grand_total ELSE 0 END),0)::numeric as collected,
             COALESCE(SUM(CASE WHEN i.paid_at IS NULL THEN i.grand_total ELSE 0 END),0)::numeric as outstanding
      FROM invoices i
      LEFT JOIN estimates est ON est.id = i.estimate_id
      JOIN leads l ON l.id = i.lead_id
      JOIN employees emp ON emp.id = l.agent_employee_id
      WHERE i.company_id=${companyId} AND i.created_at BETWEEN ${from} AND ${to}
      GROUP BY emp.id, emp.full_name ORDER BY revenue DESC
    `,
  ]);

  const t = totals[0] ?? {};
  const revenue = Number(t.revenue ?? 0);
  const cost = Number(t.cost ?? 0);
  const gp = revenue - cost;
  const collected = Number(t.collected ?? 0);

  return {
    totalRevenue: revenue, totalCost: cost, grossProfit: gp,
    gpPct: revenue > 0 ? Math.round((gp / revenue) * 100 * 10) / 10 : 0,
    collectionRate: revenue > 0 ? Math.round((collected / revenue) * 100 * 10) / 10 : 0,
    dso: 0, overdueAmount: Number(t.outstanding ?? 0), overdueCount: (t.total_count ?? 0) - (t.fully_paid ?? 0),
    perAdvisor: perAdvisor.map((r: any) => {
      const rev = Number(r.revenue); const c = Number(r.cost);
      return { advisorName: r.advisor_name, revenue: rev, cost: c, gp: rev - c,
        gpPct: rev > 0 ? Math.round(((rev - c) / rev) * 100 * 10) / 10 : 0,
        collected: Number(r.collected), outstanding: Number(r.outstanding) };
    }),
  };
}
