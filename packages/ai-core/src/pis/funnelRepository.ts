import { getSql } from "../db";
import type { PisFilter, FunnelStage } from "./types";

export async function getFunnelData(filter: PisFilter): Promise<FunnelStage[]> {
  const sql = getSql();
  const { companyId, from, to } = filter;

  // All company leads (legacy data has no agent_employee_id)
  const [leadsRes, assignedRes, contactedRes, bookedRes, carInRes, estimateRes, wipRes, invoicedRes, pickedUpRes] = await Promise.all([
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM leads WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM leads WHERE company_id=${companyId} AND agent_employee_id IS NOT NULL AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM leads l WHERE l.company_id=${companyId} AND l.created_at BETWEEN ${from} AND ${to} AND EXISTS(SELECT 1 FROM call_sessions cs WHERE cs.company_id=${companyId} AND cs.to_entity_id=l.customer_id AND cs.status='completed')`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM leads WHERE company_id=${companyId} AND lead_status IN ('accepted','car_in','closed_won') AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM leads WHERE company_id=${companyId} AND checkin_at IS NOT NULL AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM estimates WHERE company_id=${companyId} AND LOWER(status) IN ('approved','invoiced') AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM work_orders WHERE company_id=${companyId} AND status='completed' AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM invoices WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
    sql<{count: number}[]>`SELECT COUNT(*)::int as count FROM gatepasses WHERE company_id=${companyId} AND created_at BETWEEN ${from} AND ${to}`,
  ]);

  const counts = [
    leadsRes[0]?.count ?? 0, assignedRes[0]?.count ?? 0, contactedRes[0]?.count ?? 0,
    bookedRes[0]?.count ?? 0, carInRes[0]?.count ?? 0, estimateRes[0]?.count ?? 0,
    wipRes[0]?.count ?? 0, invoicedRes[0]?.count ?? 0, pickedUpRes[0]?.count ?? 0,
  ];

  const labels = [
    "Lead Arrives", "Assigned & Accepted", "First Contact", "Booking Confirmed",
    "Car-In", "Estimate Approved", "WIP Complete", "Invoice & Payment", "Vehicle Pickup"
  ];
  const slaTargets = [
    "< 2 min · System", "< 15 min · Advisor", "< 5 min post-accept · Advisor",
    "< 24h · Advisor", "< 30 min of appt · Branch/Ops", "< 30 min post check-in · Service Advisor",
    "Within job estimate · Workshop/Advisor", "< 30 min post-job · Advisor/Finance", "Same day · Branch/Portfolio"
  ];

  const totalLeads = counts[0] || 1;
  return labels.map((label, i) => {
    // Conversion = % of total leads that reached this stage
    const convPct = i === 0 ? 100 : Math.min(Math.round((counts[i] / totalLeads) * 100 * 10) / 10, 100);
    return {
      stage: i + 1,
      label,
      count: counts[i],
      conversionPct: convPct,
      avgLag: "-",
      slaTarget: slaTargets[i],
      slaStatus: convPct >= 60 ? "ON_TRACK" as const : convPct >= 30 ? "WARNING" as const : "BREACH" as const,
    };
  });
}