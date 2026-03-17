import { getSql } from "../db";

export interface CompanyReportsOverview {
  totalLeads: number;
  openLeads: number;
  wonLeads: number;
  totalWorkshopJobs: number;
  activeWorkshopJobs: number;
  completedWorkshopJobs: number;
  todayCalls: number;
  missedCallsToday: number;
  invoicesCount?: number;
  revenueTotal?: number;
}

type CountRow = { status?: string | null; count: string | number };

function coerceNumber(value: any): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export async function getCompanyReportsOverview(companyId: string): Promise<CompanyReportsOverview> {
  const sql = getSql();

  // Leads
  const leadRows = await sql<CountRow[]>`
    SELECT lead_status as status, COUNT(*)::int as count
    FROM leads
    WHERE company_id = ${companyId}
    GROUP BY lead_status
  `;
  const leadMap = new Map<string, number>();
  for (const row of leadRows as any) {
    leadMap.set(row.status ?? "", coerceNumber(row.count));
  }
  const totalLeads = Array.from(leadMap.values()).reduce((a, b) => a + b, 0);
  const openLeads = (leadMap.get("open") ?? 0) + (leadMap.get("processing") ?? 0);
  const wonLeads = leadMap.get("closed_won") ?? 0;

  // Work orders (workshop jobs)
  const woRows = await sql<CountRow[]>`
    SELECT status, COUNT(*)::int as count
    FROM work_orders
    WHERE company_id = ${companyId}
    GROUP BY status
  `;
  const woMap = new Map<string, number>();
  for (const row of woRows as any) {
    woMap.set(row.status ?? "", coerceNumber(row.count));
  }
  const totalWorkshopJobs = Array.from(woMap.values()).reduce((a, b) => a + b, 0);
  const completedWorkshopJobs = (woMap.get("completed") ?? 0) + (woMap.get("closed") ?? 0);
  const activeWorkshopJobs =
    totalWorkshopJobs -
    completedWorkshopJobs -
    (woMap.get("draft") ?? 0) -
    (woMap.get("quoting") ?? 0);

  // Calls today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const callRows = await sql<CountRow[]>`
    SELECT status, COUNT(*)::int as count
    FROM call_sessions
    WHERE company_id = ${companyId}
      AND created_at >= ${today.toISOString()}
    GROUP BY status
  `;
  const callMap = new Map<string, number>();
  for (const row of callRows as any) {
    callMap.set(row.status ?? "", coerceNumber(row.count));
  }
  const todayCalls = Array.from(callMap.values()).reduce((a, b) => a + b, 0);
  const missedCallsToday = callMap.get("failed") ?? 0;

  // Invoices (optional)
  let invoicesCount = 0;
  let revenueTotal: number | undefined = undefined;
  try {
    const invoiceRows = await sql<{ count: number; total: string | number }[]>`
      SELECT COUNT(*)::int as count, COALESCE(SUM(grand_total), 0) as total
      FROM invoices
      WHERE company_id = ${companyId}
    `;
    invoicesCount = coerceNumber(invoiceRows[0]?.count ?? 0);
    revenueTotal = coerceNumber(invoiceRows[0]?.total ?? 0);
  } catch {
    // invoices table may not exist or be empty; keep defaults
  }

  return {
    totalLeads,
    openLeads,
    wonLeads,
    totalWorkshopJobs,
    activeWorkshopJobs: Math.max(activeWorkshopJobs, 0),
    completedWorkshopJobs,
    todayCalls,
    missedCallsToday,
    invoicesCount,
    revenueTotal,
  };
}
