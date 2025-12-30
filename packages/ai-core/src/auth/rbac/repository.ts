import { getSql } from "../../db";
import type { PermissionRow, RoleRow, RoleScope, ScopeContext } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getRoleById(id: string): Promise<RoleRow | null> {
  const sql: any = getSql();
  const result = await sql<RoleRow[]>`
    SELECT *
    FROM roles
    WHERE id = ${id}
    LIMIT 1
  `;
  return (rowsFrom(result)[0] as RoleRow | undefined) ?? null;
}

export async function getRolesByScope(params: {
  scope: RoleScope;
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<RoleRow[]> {
  const sql: any = getSql();
  const { scope, companyId, branchId, vendorId } = params;
  const result =
    scope === "global"
      ? await sql<RoleRow[]>`
          SELECT * FROM roles WHERE scope = 'global' ORDER BY created_at DESC
        `
      : scope === "company"
      ? await sql<RoleRow[]>`
          SELECT * FROM roles
          WHERE scope = 'company'
            AND company_id = ${companyId ?? null}
          ORDER BY created_at DESC
        `
      : scope === "branch"
      ? await sql<RoleRow[]>`
          SELECT * FROM roles
          WHERE scope = 'branch'
            AND company_id = ${companyId ?? null}
            AND branch_id = ${branchId ?? null}
          ORDER BY created_at DESC
        `
      : await sql<RoleRow[]>`
          SELECT * FROM roles
          WHERE scope = 'vendor'
            AND company_id = ${companyId ?? null}
            AND vendor_id = ${vendorId ?? null}
          ORDER BY created_at DESC
        `;
  return rowsFrom(result) as RoleRow[];
}

export async function getRolePermissions(roleId: string): Promise<PermissionRow[]> {
  const sql: any = getSql();
  const result = await sql<PermissionRow[]>`
    SELECT p.id, p.key, p.description
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id = ${roleId}
    ORDER BY p.key
  `;
  return rowsFrom(result) as PermissionRow[];
}

export async function getAllPermissions(): Promise<PermissionRow[]> {
  const sql: any = getSql();
  const result = await sql<PermissionRow[]>`
    SELECT id, key, description FROM permissions ORDER BY key
  `;
  return rowsFrom(result) as PermissionRow[];
}

export async function getPermissionsByKeys(keys: string[]): Promise<PermissionRow[]> {
  if (!keys.length) return [];
  const sql: any = getSql();
  const result = await sql<PermissionRow[]>`
    SELECT id, key, description
    FROM permissions
    WHERE key = ANY(${keys})
  `;
  return rowsFrom(result) as PermissionRow[];
}

export async function insertRole(
  data: Omit<RoleRow, "id" | "created_at" | "updated_at" | "is_system"> & { is_system?: boolean }
): Promise<RoleRow> {
  const sql: any = getSql();
  const result = await sql<RoleRow[]>`
    INSERT INTO roles (
      name, key, scope, company_id, branch_id, vendor_id, description, is_system
    ) VALUES (
      ${data.name},
      ${data.key},
      ${data.scope},
      ${data.company_id ?? null},
      ${data.branch_id ?? null},
      ${data.vendor_id ?? null},
      ${data.description ?? null},
      ${data.is_system ?? false}
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as RoleRow;
}

export async function updateRoleRow(
  id: string,
  patch: Partial<Omit<RoleRow, "id">>
): Promise<RoleRow> {
  const sql: any = getSql();
  const result = await sql<RoleRow[]>`
    UPDATE roles
    SET
      name = COALESCE(${patch.name}, name),
      description = ${patch.description ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(result)[0] as RoleRow | undefined;
  if (!row) throw new Error(`Role not found for id=${id}`);
  return row;
}

export async function replaceRolePermissions(roleId: string, permissionIds: string[]) {
  const sql: any = getSql();
  await sql`DELETE FROM role_permissions WHERE role_id = ${roleId}`;
  for (const pid of permissionIds) {
    await sql`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES (${roleId}, ${pid})
      ON CONFLICT DO NOTHING
    `;
  }
}

export async function getUserRoles(userId: string): Promise<RoleRow[]> {
  const sql: any = getSql();
  const result = await sql<RoleRow[]>`
    SELECT r.*
    FROM roles r
    INNER JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${userId}
    ORDER BY r.created_at DESC
  `;
  return rowsFrom(result) as RoleRow[];
}

function scopeMatch(scope: RoleScope, ctx: { companyId?: string; branchId?: string; vendorId?: string }) {
  if (scope === "global") return "";
  if (scope === "company") return "AND r.company_id = ${ctx.companyId ?? null}";
  if (scope === "branch")
    return "AND r.company_id = ${ctx.companyId ?? null} AND r.branch_id = ${ctx.branchId ?? null}";
  return "AND r.company_id = ${ctx.companyId ?? null} AND r.vendor_id = ${ctx.vendorId ?? null}";
}

export async function getUserEffectivePermissions(
  userId: string,
  context: ScopeContext
): Promise<PermissionRow[]> {
  const sql: any = getSql();

  // global override: any global_admin role grants all permissions
  const globalAdminRes = await sql<{ has: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM roles r
      INNER JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ${userId}
        AND r.scope = 'global'
        AND r.key = 'global_admin'
    ) as has
  `;
  const isGlobalAdmin =
    ((globalAdminRes as any).rows ?? globalAdminRes)[0]?.has === true;

  const base = await sql<PermissionRow[]>`
    SELECT DISTINCT p.id, p.key, p.description
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.id
    INNER JOIN roles r ON r.id = rp.role_id
    INNER JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${userId}
      AND (
        ${isGlobalAdmin} = TRUE
        OR (
          -- scope-aware matching
          (
            ${context.scope} = 'global'
            AND r.scope = 'global'
          ) OR (
            ${context.scope} = 'company'
            AND (
              (r.scope = 'global')
              OR (r.scope = 'company' AND (r.company_id = ${context.companyId ?? null} OR r.company_id IS NULL))
            )
          ) OR (
            ${context.scope} = 'branch'
            AND (
              (r.scope = 'global')
              OR (r.scope = 'company' AND (r.company_id = ${context.companyId ?? null} OR r.company_id IS NULL))
              OR (r.scope = 'branch' AND r.company_id = ${context.companyId ?? null} AND r.branch_id = ${context.branchId ?? null})
            )
          ) OR (
            ${context.scope} = 'vendor'
            AND (
              (r.scope = 'global')
              OR (r.scope = 'company' AND (r.company_id = ${context.companyId ?? null} OR r.company_id IS NULL))
              OR (r.scope = 'vendor' AND r.company_id = ${context.companyId ?? null} AND r.vendor_id = ${context.vendorId ?? null})
            )
          )
        )
      )
  `;

  return rowsFrom(base) as PermissionRow[];
}

export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM user_roles WHERE user_id = ${userId}`;
  for (const rid of roleIds) {
    await sql`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (${userId}, ${rid})
      ON CONFLICT DO NOTHING
    `;
  }
}
