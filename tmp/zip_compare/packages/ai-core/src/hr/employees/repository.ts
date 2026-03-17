import { getSql } from "../../db";
import type {
  EmployeeAllowanceRow,
  EmployeeRow,
  EmployeeScope,
} from "./types";

const EMP_TABLE = "employees";
const ALLOW_TABLE = "employee_allowances";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getEmployeeById(id: string): Promise<EmployeeRow | null> {
  const sql: any = getSql();
  const result = await sql<EmployeeRow[]>`
    SELECT *
    FROM ${sql(EMP_TABLE)}
    WHERE id = ${id}
    LIMIT 1
  `;
  const rows = rowsFrom(result);
  return (rows[0] as EmployeeRow | undefined) ?? null;
}

export async function listEmployeesByScope(params: {
  scope: EmployeeScope;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
}): Promise<EmployeeRow[]> {
  const sql: any = getSql();
  const { scope, companyId, branchId, vendorId } = params;

  if (scope === "global") {
    const result = await sql<EmployeeRow[]>`
      SELECT *
      FROM ${sql(EMP_TABLE)}
      WHERE scope = 'global'
      ORDER BY created_at DESC
    `;
    return rowsFrom(result) as EmployeeRow[];
  }

  if (scope === "company") {
    const result = await sql<EmployeeRow[]>`
      SELECT *
      FROM ${sql(EMP_TABLE)}
      WHERE scope = 'company' AND company_id = ${companyId ?? null}
      ORDER BY created_at DESC
    `;
    return rowsFrom(result) as EmployeeRow[];
  }

  if (scope === "branch") {
    const result = await sql<EmployeeRow[]>`
      SELECT *
      FROM ${sql(EMP_TABLE)}
      WHERE scope = 'branch' AND branch_id = ${branchId ?? null}
      ORDER BY created_at DESC
    `;
    return rowsFrom(result);
  }

  const result = await sql<EmployeeRow[]>`
    SELECT *
    FROM ${sql(EMP_TABLE)}
    WHERE scope = 'vendor' AND vendor_id = ${vendorId ?? null}
    ORDER BY created_at DESC
  `;
  return rowsFrom(result) as EmployeeRow[];
}

export async function insertEmployee(
  data: Omit<EmployeeRow, "id" | "created_at" | "updated_at">
): Promise<EmployeeRow> {
  const sql: any = getSql();
  const result = await sql<EmployeeRow[]>`
    INSERT INTO ${sql(EMP_TABLE)} (
      auto_code,
      scope,
      company_id,
      branch_id,
      vendor_id,
      first_name,
      last_name,
      full_name,
      temp_address,
      perm_address,
      current_location,
      phone_personal,
      phone_company,
      email_personal,
      email_company,
      doc_id_number,
      doc_id_issue,
      doc_id_expiry,
      doc_passport_number,
      doc_passport_issue,
      doc_passport_expiry,
      doc_id_file_id,
      doc_passport_file_id,
      nationality,
      title,
      division,
      department,
      start_date,
      date_of_birth,
      basic_salary,
      pension_amount,
      gratuity_amount,
      allowance_total,
      gov_fee_total,
      salary_grand_total,
      visa_required,
      visa_fee,
      immigration_fee,
      work_permit_fee,
      admin_fee,
      insurance_fee,
      employee_type,
      accommodation_type,
      transport_type,
      working_days_per_week,
      working_hours_per_day,
      official_day_off,
      emergency_name,
      emergency_phone,
      emergency_email,
      emergency_relation,
      emergency_address,
      image_file_id
    )
    VALUES (
      ${data.auto_code},
      ${data.scope},
      ${data.company_id},
      ${data.branch_id},
      ${data.vendor_id},
      ${data.first_name},
      ${data.last_name},
      ${data.full_name},
      ${data.temp_address},
      ${data.perm_address},
      ${data.current_location},
      ${data.phone_personal},
      ${data.phone_company},
      ${data.email_personal},
      ${data.email_company},
      ${data.doc_id_number},
      ${data.doc_id_issue},
      ${data.doc_id_expiry},
      ${data.doc_passport_number},
      ${data.doc_passport_issue},
      ${data.doc_passport_expiry},
      ${data.doc_id_file_id},
      ${data.doc_passport_file_id},
      ${data.nationality},
      ${data.title},
      ${data.division},
      ${data.department},
      ${data.start_date},
      ${data.date_of_birth},
      ${data.basic_salary},
      ${data.pension_amount},
      ${data.gratuity_amount},
      ${data.allowance_total},
      ${data.gov_fee_total},
      ${data.salary_grand_total},
      ${data.visa_required},
      ${data.visa_fee},
      ${data.immigration_fee},
      ${data.work_permit_fee},
      ${data.admin_fee},
      ${data.insurance_fee},
      ${data.employee_type},
      ${data.accommodation_type},
      ${data.transport_type},
      ${data.working_days_per_week},
      ${data.working_hours_per_day},
      ${data.official_day_off},
      ${data.emergency_name},
      ${data.emergency_phone},
      ${data.emergency_email},
      ${data.emergency_relation},
      ${data.emergency_address},
      ${data.image_file_id}
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as EmployeeRow;
}

export async function updateEmployee(
  id: string,
  data: Partial<EmployeeRow>
): Promise<EmployeeRow> {
  const sql: any = getSql();
  const result = await sql<EmployeeRow[]>`
    UPDATE ${sql(EMP_TABLE)}
    SET
      auto_code = COALESCE(${data.auto_code}, auto_code),
      scope = COALESCE(${data.scope}, scope),
      company_id = COALESCE(${data.company_id}, company_id),
      branch_id = COALESCE(${data.branch_id}, branch_id),
      vendor_id = COALESCE(${data.vendor_id}, vendor_id),
      first_name = COALESCE(${data.first_name}, first_name),
      last_name = COALESCE(${data.last_name}, last_name),
      full_name = COALESCE(${data.full_name}, full_name),
      temp_address = ${data.temp_address ?? null},
      perm_address = ${data.perm_address ?? null},
      phone_personal = ${data.phone_personal ?? null},
      phone_company = ${data.phone_company ?? null},
      email_personal = ${data.email_personal ?? null},
      email_company = ${data.email_company ?? null},
      doc_id_number = ${data.doc_id_number ?? null},
      doc_id_issue = ${data.doc_id_issue ?? null},
      doc_id_expiry = ${data.doc_id_expiry ?? null},
      doc_passport_number = ${data.doc_passport_number ?? null},
      doc_passport_issue = ${data.doc_passport_issue ?? null},
      doc_passport_expiry = ${data.doc_passport_expiry ?? null},
      doc_id_file_id = ${data.doc_id_file_id ?? null},
      doc_passport_file_id = ${data.doc_passport_file_id ?? null},
      nationality = ${data.nationality ?? null},
      title = ${data.title ?? null},
      division = ${data.division ?? null},
      department = ${data.department ?? null},
      start_date = ${data.start_date ?? null},
      date_of_birth = ${data.date_of_birth ?? null},
      basic_salary = COALESCE(${data.basic_salary}, basic_salary),
      pension_amount = COALESCE(${data.pension_amount}, pension_amount),
      gratuity_amount = COALESCE(${data.gratuity_amount}, gratuity_amount),
      allowance_total = COALESCE(${data.allowance_total}, allowance_total),
      gov_fee_total = COALESCE(${data.gov_fee_total}, gov_fee_total),
      salary_grand_total = COALESCE(${data.salary_grand_total}, salary_grand_total),
      visa_required = COALESCE(${data.visa_required}, visa_required),
      visa_fee = COALESCE(${data.visa_fee}, visa_fee),
      immigration_fee = COALESCE(${data.immigration_fee}, immigration_fee),
      work_permit_fee = COALESCE(${data.work_permit_fee}, work_permit_fee),
      admin_fee = COALESCE(${data.admin_fee}, admin_fee),
      insurance_fee = COALESCE(${data.insurance_fee}, insurance_fee),
      employee_type = COALESCE(${data.employee_type}, employee_type),
      accommodation_type = COALESCE(${data.accommodation_type}, accommodation_type),
      transport_type = COALESCE(${data.transport_type}, transport_type),
      working_days_per_week = ${data.working_days_per_week ?? null},
      working_hours_per_day = ${data.working_hours_per_day ?? null},
      official_day_off = ${data.official_day_off ?? null},
      emergency_name = ${data.emergency_name ?? null},
      emergency_phone = ${data.emergency_phone ?? null},
      emergency_email = ${data.emergency_email ?? null},
      emergency_relation = ${data.emergency_relation ?? null},
      emergency_address = ${data.emergency_address ?? null},
      current_location = ${data.current_location ?? null},
      image_file_id = ${data.image_file_id ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(result)[0] as EmployeeRow | undefined;
  if (!row) throw new Error(`Employee not found for id=${id}`);
  return row;
}

export async function deleteEmployee(id: string): Promise<void> {
  const sql: any = getSql();
  await sql`
    DELETE FROM ${sql(EMP_TABLE)}
    WHERE id = ${id}
  `;
}

export async function getAllowancesForEmployee(
  employeeId: string
): Promise<EmployeeAllowanceRow[]> {
  const sql: any = getSql();
  const result = await sql<EmployeeAllowanceRow[]>`
    SELECT *
    FROM ${sql(ALLOW_TABLE)}
    WHERE employee_id = ${employeeId}
    ORDER BY sort_order
  `;
  return rowsFrom(result) as EmployeeAllowanceRow[];
}

export async function replaceEmployeeAllowances(
  employeeId: string,
  items: Array<{ kind: string; label?: string | null; amount: number; sort_order: number }>
): Promise<void> {
  const sql: any = getSql();
  await sql`
    DELETE FROM ${sql(ALLOW_TABLE)}
    WHERE employee_id = ${employeeId}
  `;

  for (const item of items) {
    await sql`
      INSERT INTO ${sql(ALLOW_TABLE)} (employee_id, kind, label, amount, sort_order)
      VALUES (${employeeId}, ${item.kind}, ${item.label ?? null}, ${item.amount}, ${item.sort_order})
    `;
  }
}
