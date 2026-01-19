import { getSql } from "../../db";
import type { EmployeeRow } from "../../hr/employees/types";

interface UserRow {
  id: string;
  email: string;
  employee_id: string | null;
  is_active: boolean;
  company_id?: string | null;
  branch_id?: string | null;
  vendor_id?: string | null;
}

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function linkUserToEmployee(userId: string, employeeId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE users
    SET employee_id = ${employeeId}
    WHERE id = ${userId}
  `;
}

export async function getUserWithEmployee(
  userId: string
): Promise<{ user: UserRow; employee?: EmployeeRow | null }> {
  const sql = getSql();
  const userRes = await sql<UserRow[]>`
    SELECT id, email, employee_id, is_active, company_id, branch_id, vendor_id
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const user = rowsFrom(userRes)[0];
  if (!user) throw new Error("User not found");
  if (!user.employee_id) {
    return { user, employee: null };
  }
  const empRes = await sql<EmployeeRow[]>`
    SELECT * FROM employees WHERE id = ${user.employee_id} LIMIT 1
  `;
  const employee = rowsFrom(empRes)[0] ?? null;
  return { user, employee };
}
