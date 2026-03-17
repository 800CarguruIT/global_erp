import { getSql } from "../../db";
import {
  deleteEmployee as repoDelete,
  getAllowancesForEmployee,
  getEmployeeById,
  insertEmployee,
  listEmployeesByScope,
  replaceEmployeeAllowances,
  updateEmployee,
} from "./repository";
import type {
  EmployeeAllowanceInput,
  EmployeeAllowanceRow,
  EmployeeInput,
  EmployeeRow,
  EmployeeScope,
  EmployeeTotals,
} from "./types";

function ensureScope(params: {
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}) {
  const { scope, companyId, branchId, vendorId } = params;
  if (scope === "global") {
    return;
  }
  if (scope === "company" && !companyId) {
    throw new Error("companyId is required for company scope");
  }
  if (scope === "branch" && !branchId) {
    throw new Error("branchId is required for branch scope");
  }
  if (scope === "vendor" && !vendorId) {
    throw new Error("vendorId is required for vendor scope");
  }
}

export async function generateEmployeeAutoCode(): Promise<string> {
  const sql = getSql();
  const result = await sql<{ max_num: number | null }[]>`
    SELECT MAX(CAST(REGEXP_REPLACE(auto_code, '\\D', '', 'g') AS int)) AS max_num
    FROM employees
    WHERE auto_code LIKE 'EMP-%'
  `;
  const row = (result as any).rows ? (result as any).rows[0] : result[0];
  const maxNum = row?.max_num ?? 0;
  const next = (maxNum ?? 0) + 1;
  return `EMP-${String(next).padStart(4, "0")}`;
}

export function computeEmployeeTotals(input: {
  basicSalary: number;
  allowances?: { amount: number }[];
  visaRequired: boolean;
  visaFee: number;
  immigrationFee: number;
  workPermitFee: number;
  adminFee: number;
  insuranceFee: number;
}): EmployeeTotals {
  const allowances = input.allowances ?? [];
  const allowancesTotal = allowances
    .slice(0, 5)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const govFeeTotal = input.visaRequired
    ? [input.visaFee, input.immigrationFee, input.workPermitFee, input.adminFee, input.insuranceFee]
        .map((n) => Number(n) || 0)
        .reduce((a, b) => a + b, 0)
    : 0;

  const basic = Number(input.basicSalary) || 0;
  const grandTotal = basic + allowancesTotal + govFeeTotal;

  return {
    basicSalary: basic,
    allowancesTotal,
    govFeeTotal,
    grandTotal,
  };
}

function normalizeAllowances(
  allowances: EmployeeAllowanceInput[] | undefined
): EmployeeAllowanceInput[] {
  if (!allowances?.length) return [];
  return allowances.slice(0, 5).map((a) => ({
    kind: a.kind,
    label: a.label ?? null,
    amount: Number(a.amount) || 0,
  }));
}

function mapInputToRow(
  autoCode: string,
  scope: EmployeeScope,
  input: EmployeeInput,
  totals: EmployeeTotals
): Omit<EmployeeRow, "id" | "created_at" | "updated_at"> {
  const fullName = input.fullName?.trim() || `${input.firstName} ${input.lastName}`.trim();
  return {
    auto_code: autoCode,
    scope,
    company_id: scope === "company" || scope === "branch" ? input.companyId ?? null : null,
    branch_id: scope === "branch" ? input.branchId ?? null : null,
    vendor_id: scope === "vendor" ? input.vendorId ?? null : null,
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: fullName,
    temp_address: input.tempAddress ?? null,
    perm_address: input.permAddress ?? null,
    current_location: input.currentLocation ?? null,
    phone_personal: input.phonePersonal ?? null,
    phone_company: input.phoneCompany ?? null,
    email_personal: input.emailPersonal ?? null,
    email_company: input.emailCompany ?? null,
    doc_id_number: input.docIdNumber ?? null,
    doc_id_issue: input.docIdIssue ?? null,
    doc_id_expiry: input.docIdExpiry ?? null,
    doc_passport_number: input.docPassportNumber ?? null,
    doc_passport_issue: input.docPassportIssue ?? null,
    doc_passport_expiry: input.docPassportExpiry ?? null,
    doc_id_file_id: input.docIdFileId ?? null,
    doc_passport_file_id: input.docPassportFileId ?? null,
    nationality: input.nationality ?? null,
    title: input.title ?? null,
    division: input.division ?? null,
    department: input.department ?? null,
    start_date: input.startDate ?? null,
    date_of_birth: input.dateOfBirth ?? null,
    basic_salary: Number(input.basicSalary) || 0,
    pension_amount: Number(input.pensionAmount ?? 0) || 0,
    gratuity_amount: Number(input.gratuityAmount ?? 0) || 0,
    allowance_total: totals.allowancesTotal,
    gov_fee_total: totals.govFeeTotal,
    salary_grand_total: totals.grandTotal,
    visa_required: input.visaRequired ?? false,
    visa_fee: Number(input.visaFee ?? 0) || 0,
    immigration_fee: Number(input.immigrationFee ?? 0) || 0,
    work_permit_fee: Number(input.workPermitFee ?? 0) || 0,
    admin_fee: Number(input.adminFee ?? 0) || 0,
    insurance_fee: Number(input.insuranceFee ?? 0) || 0,
    employee_type: input.employeeType ?? "full_time",
    accommodation_type: input.accommodationType ?? "self",
    transport_type: input.transportType ?? "self",
    working_days_per_week: input.workingDaysPerWeek ?? null,
    working_hours_per_day: input.workingHoursPerDay ?? null,
    official_day_off: input.officialDayOff ?? null,
    emergency_name: input.emergencyName ?? null,
    emergency_phone: input.emergencyPhone ?? null,
    emergency_email: input.emergencyEmail ?? null,
    emergency_relation: input.emergencyRelation ?? null,
    emergency_address: input.emergencyAddress ?? null,
    image_file_id: input.imageFileId ?? null,
  };
}

export async function createEmployee(params: {
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
  input: EmployeeInput;
}): Promise<EmployeeRow & { allowances: EmployeeAllowanceRow[]; totals: EmployeeTotals }> {
  ensureScope(params);
  const allowances = normalizeAllowances(params.input.allowances);
  const totals = computeEmployeeTotals({
    basicSalary: params.input.basicSalary,
    allowances,
    visaRequired: params.input.visaRequired ?? false,
    visaFee: params.input.visaFee ?? 0,
    immigrationFee: params.input.immigrationFee ?? 0,
    workPermitFee: params.input.workPermitFee ?? 0,
    adminFee: params.input.adminFee ?? 0,
    insuranceFee: params.input.insuranceFee ?? 0,
  });

  const autoCode = await generateEmployeeAutoCode();
  const row = await insertEmployee(
    mapInputToRow(autoCode, params.scope, { ...params.input, ...params }, totals)
  );

  await replaceEmployeeAllowances(
    row.id,
    allowances.map((a, idx) => ({
      ...a,
      sort_order: idx,
    }))
  );
  const allowanceRows = await getAllowancesForEmployee(row.id);

  return { ...row, allowances: allowanceRows, totals };
}

export async function updateEmployeeRecord(params: {
  id: string;
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
  input: EmployeeInput;
}): Promise<EmployeeRow & { allowances: EmployeeAllowanceRow[]; totals: EmployeeTotals }> {
  ensureScope(params);
  const existing = await getEmployeeById(params.id);
  if (!existing) throw new Error("Employee not found");
  if (existing.scope !== params.scope) {
    throw new Error("Scope mismatch for employee update");
  }
  if (params.scope === "company" && existing.company_id !== (params.companyId ?? null)) {
    throw new Error("Employee does not belong to this company");
  }
  if (params.scope === "branch" && existing.branch_id !== (params.branchId ?? null)) {
    throw new Error("Employee does not belong to this branch");
  }
  if (params.scope === "vendor" && existing.vendor_id !== (params.vendorId ?? null)) {
    throw new Error("Employee does not belong to this vendor");
  }

  const allowances =
    params.input.allowances !== undefined
      ? normalizeAllowances(params.input.allowances)
      : await getAllowancesForEmployee(params.id).then((rows) =>
          rows.map((r) => ({ kind: r.kind, label: r.label, amount: Number(r.amount) }))
        );

  const totals = computeEmployeeTotals({
    basicSalary: params.input.basicSalary,
    allowances,
    visaRequired: params.input.visaRequired ?? existing.visa_required,
    visaFee: params.input.visaFee ?? existing.visa_fee,
    immigrationFee: params.input.immigrationFee ?? existing.immigration_fee,
    workPermitFee: params.input.workPermitFee ?? existing.work_permit_fee,
    adminFee: params.input.adminFee ?? existing.admin_fee,
    insuranceFee: params.input.insuranceFee ?? existing.insurance_fee,
  });

  const updated = await updateEmployee(
    params.id,
    mapInputToRow(existing.auto_code, params.scope, { ...params.input, ...params }, totals)
  );

  if (params.input.allowances !== undefined) {
    await replaceEmployeeAllowances(
      params.id,
      allowances.map((a, idx) => ({ ...a, sort_order: idx }))
    );
  }
  const allowanceRows = await getAllowancesForEmployee(params.id);

  return { ...updated, allowances: allowanceRows, totals };
}

export async function getEmployeeDetails(params: {
  id: string;
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<EmployeeRow & { allowances: EmployeeAllowanceRow[]; totals: EmployeeTotals }> {
  const existing = await getEmployeeById(params.id);
  if (!existing) throw new Error("Employee not found");
  if (existing.scope !== params.scope) throw new Error("Scope mismatch");
  if (params.scope === "company" && existing.company_id !== (params.companyId ?? null)) {
    throw new Error("Employee does not belong to this company");
  }
  if (params.scope === "branch" && existing.branch_id !== (params.branchId ?? null)) {
    throw new Error("Employee does not belong to this branch");
  }
  if (params.scope === "vendor" && existing.vendor_id !== (params.vendorId ?? null)) {
    throw new Error("Employee does not belong to this vendor");
  }

  const allowances = await getAllowancesForEmployee(params.id);
  const totals: EmployeeTotals = {
    basicSalary: existing.basic_salary,
    allowancesTotal: existing.allowance_total,
    govFeeTotal: existing.gov_fee_total,
    grandTotal: existing.salary_grand_total,
  };

  return { ...existing, allowances, totals };
}

export async function listEmployeesForScope(params: {
  scope: EmployeeScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<Array<EmployeeRow & { totals: EmployeeTotals }>> {
  ensureScope(params);
  const rows = await listEmployeesByScope({
    scope: params.scope,
    companyId: params.companyId ?? undefined,
    branchId: params.branchId ?? undefined,
    vendorId: params.vendorId ?? undefined,
  });
  return rows.map((row) => ({
    ...row,
    totals: {
      basicSalary: row.basic_salary,
      allowancesTotal: row.allowance_total,
      govFeeTotal: row.gov_fee_total,
      grandTotal: row.salary_grand_total,
    },
  }));
}

export async function deleteEmployee(id: string): Promise<void> {
  await repoDelete(id);
}
