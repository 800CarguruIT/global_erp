import { Rbac } from "@repo/ai-core";
import type { RoleScope, ScopeContext } from "@repo/ai-core";

/** Priority-ordered fallback routes per scope, used when no role has home_page set.
 *  First entry whose permissionKeys the user holds becomes the landing page. */
const COMPANY_PRIORITY: { perms: string[]; path: string }[] = [
  { perms: ["callcenter.dashboard.view"], path: "/company/[companyId]/call-center/dashboard" },
  { perms: ["callcenter.outbound.view"], path: "/company/[companyId]/call-center/outbound" },
  { perms: ["callcenter.view"], path: "/company/[companyId]/call-center" },
  { perms: ["leads.view"], path: "/company/[companyId]/leads" },
  { perms: ["sales.view"], path: "/company/[companyId]/sales/my-leads" },
  { perms: ["jobs.workshop.view"], path: "/company/[companyId]/jobs/workshop" },
  { perms: ["jobs.view"], path: "/company/[companyId]/jobs" },
  { perms: ["workshop.earnings.view"], path: "/company/[companyId]/workshop/earnings" },
  { perms: ["accounting.view"], path: "/company/[companyId]/accounting" },
  { perms: ["crm.customers.view"], path: "/company/[companyId]/customers" },
  { perms: ["company.dashboard.view"], path: "/company/[companyId]" },
];

const BRANCH_PRIORITY: { perms: string[]; path: string }[] = [
  { perms: ["jobs.workshop.view"], path: "/company/[companyId]/branches/[branchId]/jobs/workshop" },
  { perms: ["jobs.view"], path: "/company/[companyId]/branches/[branchId]/jobs" },
  { perms: ["inventory.view"], path: "/company/[companyId]/branches/[branchId]/inventory" },
  { perms: ["fleet.cars.view"], path: "/company/[companyId]/branches/[branchId]/fleet" },
  { perms: ["accounting.view"], path: "/company/[companyId]/branches/[branchId]/accounting" },
];

function resolveTemplate(
  template: string,
  ids: { companyId?: string | null; branchId?: string | null; vendorId?: string | null }
): string {
  return template
    .replace("[companyId]", ids.companyId ?? "")
    .replace("[branchId]", ids.branchId ?? "")
    .replace("[vendorId]", ids.vendorId ?? "");
}

/**
 * Resolve the best landing page for a user after login.
 *
 * Priority:
 * 1. First role assigned to the user (matching the current scope) that has home_page set
 * 2. First page from the permission-based priority list that the user can access
 * 3. The provided fallback
 */
export async function resolveLoginRedirect(params: {
  userId: string;
  scope: RoleScope;
  companyId: string | null;
  branchId: string | null;
  vendorId: string | null;
  fallback: string;
}): Promise<string> {
  const { userId, scope, companyId, branchId, vendorId, fallback } = params;
  const ids = { companyId, branchId, vendorId };

  try {
    // 1. Check if any assigned role has a home_page configured
    const roles = await Rbac.getUserRolesList(userId);
    const scopedRoles = roles.filter((r) => {
      if (r.scope !== scope) return false;
      if (scope === "company") return !companyId || r.company_id === companyId;
      if (scope === "branch")
        return (!companyId || r.company_id === companyId) && (!branchId || r.branch_id === branchId);
      if (scope === "vendor")
        return (!companyId || r.company_id === companyId) && (!vendorId || r.vendor_id === vendorId);
      return true; // global
    });

    const roleWithHomePage = scopedRoles.find((r) => r.home_page);
    if (roleWithHomePage?.home_page) {
      return resolveTemplate(roleWithHomePage.home_page, ids);
    }

    // 2. Fall back to permission-based priority list
    const scopeContext: ScopeContext = { scope, companyId, branchId, vendorId };
    const userPerms = await Rbac.getUserPermissions(userId, scopeContext);
    const permSet = new Set(userPerms);

    const priorityList = scope === "company" ? COMPANY_PRIORITY : scope === "branch" ? BRANCH_PRIORITY : null;
    if (priorityList) {
      for (const entry of priorityList) {
        if (entry.perms.some((p) => permSet.has(p))) {
          return resolveTemplate(entry.path, ids);
        }
      }
    }
  } catch {
    // On any error, fall through to the fallback
  }

  return fallback;
}
