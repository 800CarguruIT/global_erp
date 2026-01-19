import { getSql } from "../db";

export interface CompanyHrOverview {
  totalEmployees: number;
  technicians: number;
  managers: number;
  callAgents: number;
  employeesByBranch: Array<{
    branchId: string;
    branchName: string;
    count: number;
  }>;
}

function coerceNumber(value: any): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

export async function getCompanyHrOverview(companyId: string): Promise<CompanyHrOverview> {
  const sql = getSql();

  const [totals] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM employees
    WHERE company_id = ${companyId} AND scope IN ('company','branch')
  `;

  // Infer roles via title field if available
  const roleCounts =
    await sql/* sql */ `
      SELECT LOWER(COALESCE(title, '')) AS title_label, COUNT(*)::int AS count
      FROM employees
      WHERE company_id = ${companyId} AND scope IN ('company','branch')
      GROUP BY LOWER(COALESCE(title, ''))
    `;

  let technicians = 0;
  let managers = 0;
  let callAgents = 0;
  for (const row of roleCounts as any[]) {
    const t = row.title_label as string;
    const count = coerceNumber(row.count);
    if (t.includes("tech")) technicians += count;
    else if (t.includes("manager")) managers += count;
    else if (t.includes("agent") || t.includes("call")) callAgents += count;
  }

  const branchRows =
    await sql/* sql */ `
      SELECT b.id AS branch_id, b.name AS branch_name, COUNT(e.id)::int AS count
      FROM branches b
      LEFT JOIN employees e ON e.branch_id = b.id
        AND e.company_id = ${companyId}
        AND e.scope IN ('company','branch')
      WHERE b.company_id = ${companyId}
      GROUP BY b.id, b.name
    `;

  const employeesByBranch = branchRows.map((row: any) => ({
    branchId: row.branch_id,
    branchName: row.branch_name,
    count: coerceNumber(row.count),
  }));

  return {
    totalEmployees: coerceNumber(totals?.total ?? 0),
    technicians,
    managers,
    callAgents,
    employeesByBranch,
  };
}
