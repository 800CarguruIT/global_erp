import { Rbac, UserRepository } from "@repo/ai-core";
import { getUserRoles } from "@repo/ai-core/auth/rbac/repository";
import type { ScopeContext } from "@repo/ai-core";
import { getUserContext } from "./user-context";

type MobileDashboardKey = "dashboard" | "wsDashboard" | "carInDashboard";

const MOBILE_DASHBOARD_PATHS: Record<MobileDashboardKey, string> = {
  dashboard: "/(main)/(home)/dashboard",
  wsDashboard: "/(main)/(home)/ws_dashboard",
  carInDashboard: "/(main)/(home)/car_in_dashoard",
};

function toScopeContext(params: {
  scope: "global" | "company" | "branch" | "vendor";
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
}): ScopeContext {
  if (params.scope === "global") return { scope: "global" };
  if (params.scope === "company") {
    return { scope: "company", companyId: params.companyId ?? undefined };
  }
  if (params.scope === "branch") {
    return {
      scope: "branch",
      companyId: params.companyId ?? undefined,
      branchId: params.branchId ?? undefined,
    };
  }
  return {
    scope: "vendor",
    companyId: params.companyId ?? undefined,
    vendorId: params.vendorId ?? undefined,
  };
}

function getDashboardKey(args: {
  scope: "global" | "company" | "branch" | "vendor";
  roleKeys: string[];
}): MobileDashboardKey {
  if (args.scope !== "branch") {
    return "dashboard";
  }

  const keys = args.roleKeys.map((item) => item.toLowerCase());
  const hasAgentRole = keys.some(
    (key) =>
      key.includes("agent") ||
      key.includes("call_center") ||
      key.includes("call-center")
  );

  if (hasAgentRole) {
    return "carInDashboard";
  }

  return "wsDashboard";
}

export async function buildMobileUserProfile(userId: string) {
  const [context, user, roles] = await Promise.all([
    getUserContext(userId),
    UserRepository.getUserById(userId),
    getUserRoles(userId),
  ]);

  if (!user) return null;

  const companyCtx = context.companies?.[0] ?? {
    companyId: null,
    branchId: null,
    vendorId: null,
  };

  const roleKeys = roles.map((role) => role.key).filter(Boolean);
  const dashboardKey = getDashboardKey({
    scope: context.scope,
    roleKeys,
  });

  const permissions = await Rbac.getUserPermissionsForScope(
    userId,
    toScopeContext({
      scope: context.scope,
      companyId: companyCtx.companyId,
      branchId: companyCtx.branchId,
      vendorId: companyCtx.vendorId,
    })
  );

  return {
    id: user.id,
    userId: user.id,
    fullName: user.full_name ?? null,
    name: user.full_name ?? user.email ?? null,
    email: user.email ?? null,
    isGlobal: context.isGlobal,
    scope: context.scope,

    // backward-compatible shape used by the app
    companies: companyCtx,
    companyId: companyCtx.companyId ?? null,
    branchId: companyCtx.branchId ?? null,
    vendorId: companyCtx.vendorId ?? null,

    // richer auth context for role-based routing
    companyScopes: context.companies ?? [],
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      scope: role.scope,
      companyId: role.company_id,
      branchId: role.branch_id,
      vendorId: role.vendor_id,
    })),
    roleKeys,
    permissions,
    dashboard: {
      key: dashboardKey,
      path: MOBILE_DASHBOARD_PATHS[dashboardKey],
    },
  };
}
