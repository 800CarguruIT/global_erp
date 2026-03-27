import {
  getAgentsPerformanceReport,
  getDataCenterKpis,
  listAssignments,
  upsertCustomerAssignment,
} from "./repository";
import type {
  AgentPerformanceReport,
  AssignmentListResult,
  DataCenterKpiFilter,
  DataCenterKpis,
  ListAssignmentsFilter,
  UpsertCustomerAssignmentInput,
} from "./types";

export async function assignCustomer(input: UpsertCustomerAssignmentInput) {
  if (!input.companyId) throw new Error("companyId is required");
  if (!input.customerId) throw new Error("customerId is required");
  return upsertCustomerAssignment({
    ...input,
    action: input.action ?? "assign",
    status: input.status ?? "active",
  });
}

export async function bulkAssignCustomers(
  rows: UpsertCustomerAssignmentInput[]
): Promise<{ updated: number }> {
  let updated = 0;
  for (const row of rows) {
    await upsertCustomerAssignment({
      ...row,
      action: row.action ?? "bulk_assign",
      status: row.status ?? "active",
    });
    updated += 1;
  }
  return { updated };
}

export async function listCustomerAssignments(
  filter: ListAssignmentsFilter
): Promise<AssignmentListResult> {
  if (!filter.companyId) throw new Error("companyId is required");
  return listAssignments(filter);
}

export async function getKpis(filter: DataCenterKpiFilter): Promise<DataCenterKpis> {
  if (filter.from > filter.to) throw new Error("from must be before to");
  return getDataCenterKpis(filter);
}

export async function getAgentsReport(
  filter: DataCenterKpiFilter
): Promise<AgentPerformanceReport> {
  if (filter.from > filter.to) throw new Error("from must be before to");
  return getAgentsPerformanceReport(filter);
}
