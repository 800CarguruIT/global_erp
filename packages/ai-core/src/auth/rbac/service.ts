import {
  assignRolesToUser as repoAssignRoles,
  getAllPermissions as repoGetAllPermissions,
  getPermissionsByKeys,
  getRoleById,
  getRolePermissions,
  getRolesByScope,
  getUserPermissionsForExactScope,
  getUserEffectivePermissions,
  getUserRoles,
  insertRole,
  replaceRolePermissions,
  updateRoleRow,
} from "./repository";
import type {
  CreateRoleInput,
  PermissionRow,
  RoleRow,
  RoleScope,
  ScopeContext,
  UpdateRoleInput,
} from "./types";

function validateScope(input: CreateRoleInput) {
  if (input.scope === "global") return;
  if (input.scope === "company" && !input.companyId) {
    throw new Error("companyId is required for company scope");
  }
  if (input.scope === "branch" && (!input.companyId || !input.branchId)) {
    throw new Error("companyId and branchId are required for branch scope");
  }
  if (input.scope === "vendor" && (!input.companyId || !input.vendorId)) {
    throw new Error("companyId and vendorId are required for vendor scope");
  }
}

export async function createRole(
  input: CreateRoleInput
): Promise<RoleRow & { permissions: PermissionRow[] }> {
  validateScope(input);
  const perms = await getPermissionsByKeys(input.permissionKeys ?? []);
  const row = await insertRole({
    name: input.name,
    key: input.key,
    scope: input.scope,
    company_id: input.companyId ?? null,
    branch_id: input.branchId ?? null,
    vendor_id: input.vendorId ?? null,
    description: input.description ?? null,
  });
  await replaceRolePermissions(row.id, perms.map((p) => p.id));
  return { ...row, permissions: perms };
}

export async function updateRole(
  id: string,
  input: UpdateRoleInput
): Promise<RoleRow & { permissions: PermissionRow[] }> {
  const existing = await getRoleById(id);
  if (!existing) throw new Error("Role not found");
  const updated = await updateRoleRow(id, {
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
  });
  if (input.permissionKeys) {
    const perms = await getPermissionsByKeys(input.permissionKeys);
    await replaceRolePermissions(id, perms.map((p) => p.id));
  }
  const perms = await getRolePermissions(id);
  return { ...updated, permissions: perms };
}

export async function listRolesForScope(params: {
  scope: RoleScope;
  companyId?: string;
  branchId?: string;
  vendorId?: string;
}): Promise<Array<RoleRow & { permissions: PermissionRow[] }>> {
  const rows = await getRolesByScope(params);
  const withPerms: Array<RoleRow & { permissions: PermissionRow[] }> = [];
  for (const r of rows) {
    const perms = await getRolePermissions(r.id);
    withPerms.push({ ...r, permissions: perms });
  }
  return withPerms;
}

export async function getRoleDetails(
  id: string
): Promise<RoleRow & { permissions: PermissionRow[] }> {
  const row = await getRoleById(id);
  if (!row) throw new Error("Role not found");
  const perms = await getRolePermissions(id);
  return { ...row, permissions: perms };
}

export async function listAllPermissions(): Promise<PermissionRow[]> {
  return repoGetAllPermissions();
}

export const getAllPermissions = listAllPermissions;

export async function assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
  await repoAssignRoles(userId, roleIds);
}

export async function getUserPermissions(
  userId: string,
  scopeContext: ScopeContext
): Promise<string[]> {
  const perms = await getUserEffectivePermissions(userId, scopeContext);
  return perms.map((p) => p.key);
}

export async function getUserPermissionsForScope(
  userId: string,
  scopeContext: ScopeContext
): Promise<string[]> {
  const perms = await getUserPermissionsForExactScope(userId, scopeContext);
  return perms.map((p) => p.key);
}

export async function checkPermission(
  userId: string,
  permissionKey: string,
  scopeContext: ScopeContext
): Promise<boolean> {
  const perms = await getUserPermissions(userId, scopeContext);
  if (perms.includes(permissionKey) || perms.includes("global.admin")) return true;

  if (scopeContext.scope !== "global") {
    if (perms.includes("company.admin")) return true;
    const roles = await getUserRoles(userId);
    const companyId = scopeContext.companyId ?? null;
    const isCompanyAdmin = roles.some(
      (r) =>
        r.scope === "company" &&
        (r.key === "company_admin" || r.key.startsWith("company_admin_")) &&
        (!companyId || r.company_id === null || r.company_id === companyId)
    );
    if (isCompanyAdmin) return true;
  }

  if (scopeContext.scope === "branch" && perms.includes("branch.admin")) return true;

  return false;
}

export async function userHasAnyPermission(
  userId: string,
  permissionKeys: string[],
  scopeContext: ScopeContext
): Promise<boolean> {
  const perms = await getUserPermissions(userId, scopeContext);
  return permissionKeys.some((k) => perms.includes(k));
}

export async function getUserRolesWithPermissions(userId: string): Promise<
  Array<
    RoleRow & {
      permissions: PermissionRow[];
    }
  >
> {
  const roles = await getUserRoles(userId);
  const result: Array<RoleRow & { permissions: PermissionRow[] }> = [];
  for (const r of roles) {
    const perms = await getRolePermissions(r.id);
    result.push({ ...r, permissions: perms });
  }
  return result;
}
