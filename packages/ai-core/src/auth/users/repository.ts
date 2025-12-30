import bcrypt from "bcryptjs";
import { getSql } from "../../db";
import type { RoleRow } from "../rbac/types";

export type UserListRow = {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  employee_id?: string | null;
  created_at?: string;
  updated_at?: string;
  roles?: { id: string; name: string }[];
  last_login_at?: string | null;
  company_id?: string | null;
};

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function listUsers(params: {
  q?: string;
  limit?: number;
  offset?: number;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
  activeOnly?: boolean;
  globalOnly?: boolean;
}): Promise<UserListRow[]> {
  const sql = getSql();
  const { q, limit = 50, offset = 0, companyId, branchId, vendorId, activeOnly = true, globalOnly = false } = params;
  const search =
    q && q.trim().length
      ? sql`AND (LOWER(u.email) LIKE ${"%" + q.toLowerCase() + "%"} OR LOWER(COALESCE(u.full_name, '')) LIKE ${
          "%" + q.toLowerCase() + "%"
        })`
      : sql``;

  const companyFilter = companyId
    ? sql`AND (u.company_id = ${companyId} OR e.company_id = ${companyId})`
    : sql``;
  const globalFilter = globalOnly ? sql`AND u.company_id IS NULL` : sql``;
  const branchFilter = branchId
    ? sql`AND EXISTS (
        SELECT 1
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.scope = 'branch' AND r.branch_id = ${branchId}
      )`
    : sql``;
  const vendorFilter = vendorId
    ? sql`AND EXISTS (
        SELECT 1
        FROM user_roles ur
        INNER JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id AND r.scope = 'vendor' AND r.vendor_id = ${vendorId}
      )`
    : sql``;
  const activeFilter = activeOnly ? sql`AND u.is_active = TRUE` : sql``;

  const rows = await sql<UserListRow[]>`
    SELECT u.id, u.email, u.full_name, u.is_active, u.employee_id, u.created_at, u.updated_at, u.company_id,
           (SELECT MAX(last_seen_at) FROM user_sessions us WHERE us.user_id = u.id) as last_login_at
    FROM users u
    LEFT JOIN employees e ON e.id = u.employee_id
    WHERE 1=1
      ${search}
      ${companyFilter}
      ${globalFilter}
      ${branchFilter}
      ${vendorFilter}
      ${activeFilter}
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const users = rowsFrom(rows);
  // Load roles per user
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const roleRows = await sql<any[]>`
      SELECT ur.user_id, r.id, r.name
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ANY(${ids}::uuid[])
    `;
    const grouped = new Map<string, { id: string; name: string }[]>();
    for (const rr of rowsFrom(roleRows)) {
      const arr = grouped.get(rr.user_id) ?? [];
      arr.push({ id: rr.id, name: rr.name });
      grouped.set(rr.user_id, arr);
    }
    users.forEach((u) => {
      u.roles = grouped.get(u.id) ?? [];
    });
  }
  return users;
}

export async function getUserById(id: string): Promise<UserListRow | null> {
  const sql = getSql();
  const res = await sql<UserListRow[]>`
    SELECT u.id, u.email, u.full_name, u.is_active, u.employee_id, u.created_at, u.updated_at, u.company_id
    FROM users u
    WHERE u.id = ${id}
    LIMIT 1
  `;
  const user = rowsFrom(res)[0];
  if (!user) return null;
  const roles = await sql<RoleRow[]>`
    SELECT r.id, r.name
    FROM roles r
    INNER JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${id}
  `;
  user.roles = rowsFrom(roles).map((r) => ({ id: r.id, name: r.name }));
  return user;
}

export async function createUser(input: {
  email: string;
  fullName?: string | null;
  password: string;
  employeeId?: string | null;
  roleIds?: string[];
  companyId?: string | null;
}): Promise<UserListRow> {
  const sql = getSql();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const roleIds = input.roleIds ?? [];
  const res = await sql<UserListRow[]>`
    INSERT INTO users (email, full_name, password_hash, employee_id, is_active, company_id)
    VALUES (${input.email.toLowerCase()}, ${input.fullName ?? null}, ${passwordHash}, ${
    input.employeeId ?? null
  }, true, ${input.companyId ?? null})
    RETURNING id, email, full_name, is_active, employee_id, created_at, updated_at, company_id
  `;
  const user = rowsFrom(res)[0];
  if (!user) {
    throw new Error("Failed to create user");
  }
  if (roleIds.length) {
    await sql`
      INSERT INTO user_roles (user_id, role_id)
      SELECT ${user.id}, rid FROM UNNEST(${roleIds}::uuid[]) AS rid
      ON CONFLICT DO NOTHING
    `;
  }
  user.roles = roleIds.map((id) => ({ id, name: "" }));
  return user;
}

export async function updateUser(
  id: string,
  patch: {
    email?: string;
    fullName?: string | null;
    password?: string;
    employeeId?: string | null;
    isActive?: boolean;
    roleIds?: string[];
  }
): Promise<UserListRow> {
  const sql = getSql();
  const passwordHash = patch.password ? await bcrypt.hash(patch.password, 10) : undefined;
  const updated: Record<string, any> = {};
  if (patch.email !== undefined) updated.email = patch.email?.toLowerCase() ?? null;
  if (patch.fullName !== undefined) updated.full_name = patch.fullName ?? null;
  if (patch.employeeId !== undefined) updated.employee_id = patch.employeeId ?? null;
  if (patch.isActive !== undefined) updated.is_active = patch.isActive;
  if (patch.password !== undefined) updated.password_hash = passwordHash ?? null;
  const res = await sql<UserListRow[]>`
    UPDATE users
    SET ${sql(updated)}
    WHERE id = ${id}
    RETURNING id, email, full_name, is_active, employee_id, created_at, updated_at, company_id
  `;
  const user = rowsFrom(res)[0];
  if (!user) throw new Error("User not found");

  if (patch.roleIds !== undefined) {
    const roleIds = patch.roleIds ?? [];
    await sql.begin(async (trx) => {
      await trx`DELETE FROM user_roles WHERE user_id = ${id}`;
      if (roleIds.length) {
        await trx`
          INSERT INTO user_roles (user_id, role_id)
          SELECT ${id}, rid FROM UNNEST(${roleIds}::uuid[]) AS rid
        `;
      }
    });
  }
  return { ...user, roles: patch.roleIds?.map((rid) => ({ id: rid, name: "" })) ?? user.roles ?? [] };
}

export async function softDeleteUser(id: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE users SET is_active = false WHERE id = ${id}`;
}
