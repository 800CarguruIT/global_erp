import { getSql } from "../../db";
import type { BayBranchSummary, BayStatus, BayType, WorkshopBay } from "./types";

function mapBay(row: any): WorkshopBay {
  return {
    id: row.id,
    companyId: row.company_id,
    branchId: row.branch_id,
    code: row.code,
    name: row.name,
    bayType: row.bay_type,
    capacityCars: Number(row.capacity_cars),
    status: row.status,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBaysByCompany(
  companyId: string,
  filters: { branchId?: string; status?: BayStatus | "any"; bayType?: BayType | "any"; activeOnly?: boolean } = {}
): Promise<WorkshopBay[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM workshop_bays
    WHERE company_id = ${companyId}
    ${filters.branchId ? sql`AND branch_id = ${filters.branchId}` : sql``}
    ${filters.status && filters.status !== "any" ? sql`AND status = ${filters.status}` : sql``}
    ${filters.bayType && filters.bayType !== "any" ? sql`AND bay_type = ${filters.bayType}` : sql``}
    ${filters.activeOnly === false ? sql`` : sql`AND is_active = true`}
    ORDER BY created_at DESC
  `;
  return rows.map(mapBay);
}

export async function getBay(companyId: string, id: string): Promise<WorkshopBay | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM workshop_bays
    WHERE company_id = ${companyId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ? mapBay(rows[0]) : null;
}

export async function createBay(
  companyId: string,
  input: Partial<WorkshopBay> & { branchId: string; code: string; name: string; bayType: BayType }
): Promise<WorkshopBay> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO workshop_bays (
      company_id,
      branch_id,
      code,
      name,
      bay_type,
      capacity_cars,
      status,
      is_active,
      notes
    )
    VALUES (
      ${companyId},
      ${input.branchId},
      ${input.code},
      ${input.name},
      ${input.bayType},
      ${input.capacityCars ?? 1},
      ${input.status ?? ("available" as BayStatus)},
      ${input.isActive ?? true},
      ${input.notes ?? null}
    )
    RETURNING *
  `;
  return mapBay(rows[0]);
}

export async function updateBay(companyId: string, id: string, patch: Partial<WorkshopBay>): Promise<WorkshopBay> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      branch_id: patch.branchId,
      code: patch.code,
      name: patch.name,
      bay_type: patch.bayType,
      capacity_cars: patch.capacityCars,
      status: patch.status,
      is_active: patch.isActive,
      notes: patch.notes,
    }).filter(([, v]) => v !== undefined)
  );

  const rows = await sql`
    UPDATE workshop_bays
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${id}
    RETURNING *
  `;
  if (!rows[0]) {
    throw new Error("Bay not found");
  }
  return mapBay(rows[0]);
}

export async function summarizeBaysByBranch(companyId: string): Promise<BayBranchSummary[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT branch_id, status, COUNT(*) as count
    FROM workshop_bays
    WHERE company_id = ${companyId}
    GROUP BY branch_id, status
  `;
  const summaryMap = new Map<string, BayBranchSummary>();
  for (const row of rows) {
    const branchId = row.branch_id as string;
    const status = row.status as BayStatus;
    const count = Number(row.count);
    if (!summaryMap.has(branchId)) {
      summaryMap.set(branchId, {
        branchId,
        total: 0,
        available: 0,
        occupied: 0,
        maintenance: 0,
        blocked: 0,
      });
    }
    const current = summaryMap.get(branchId)!;
    current.total += count;
    if (status === "available") current.available += count;
    else if (status === "occupied") current.occupied += count;
    else if (status === "maintenance") current.maintenance += count;
    else if (status === "blocked") current.blocked += count;
  }
  return Array.from(summaryMap.values());
}
