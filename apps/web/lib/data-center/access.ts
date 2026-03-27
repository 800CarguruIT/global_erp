import { Rbac, Users } from "@repo/ai-core/server";

export type DataCenterAccess =
  | { scope: "all" }
  | { scope: "supervisor"; supervisorUserId: string }
  | { scope: "agent"; agentUserId: string };

function roleKeyIncludes(roleKey: string, token: string): boolean {
  const key = roleKey.toLowerCase();
  return key === token || key.includes(token);
}

export async function resolveDataCenterAccess(
  userId: string,
  companyId: string
): Promise<DataCenterAccess> {
  const { employee } = await Users.getUserWithEmployee(userId);
  if (employee && employee.company_id !== companyId) {
    throw new Error("FORBIDDEN");
  }

  const roles = await Rbac.getUserRolesWithPermissions(userId);
  const scopedRoles = roles.filter((r) => {
    if (r.scope === "global") return true;
    if (r.scope !== "company") return false;
    if (!r.company_id) return true;
    return r.company_id === companyId;
  });

  const roleKeys = new Set(scopedRoles.map((r) => (r.key ?? "").toLowerCase()));
  const permissionKeys = new Set(
    scopedRoles.flatMap((r) => (r.permissions ?? []).map((p) => (p.key ?? "").toLowerCase()))
  );

  const isAdmin =
    Array.from(roleKeys).some((k) => roleKeyIncludes(k, "global_admin")) ||
    Array.from(roleKeys).some((k) => roleKeyIncludes(k, "company_admin")) ||
    permissionKeys.has("global.admin") ||
    permissionKeys.has("company.admin");
  if (isAdmin) return { scope: "all" };

  const isSupervisor =
    Array.from(roleKeys).some((k) => roleKeyIncludes(k, "supervisor")) ||
    permissionKeys.has("call.center.supervisor") ||
    permissionKeys.has("sales.supervisor");
  if (isSupervisor) return { scope: "supervisor", supervisorUserId: userId };

  return { scope: "agent", agentUserId: userId };
}
