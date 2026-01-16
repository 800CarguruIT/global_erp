import { NextRequest, NextResponse } from "next/server";
import type { ScopeContext } from "@repo/ai-core";
import { Rbac } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "./current-user";

function normalizeScopeId(value?: string) {
  if (!value) return undefined;
  if (value === "undefined" || value === "null") return undefined;
  return value;
}

export function buildScopeContextFromRoute(
  params: { companyId?: string; branchId?: string; vendorId?: string },
  levelOverride?: "global" | "company" | "branch" | "vendor"
): ScopeContext {
  const normalized = {
    companyId: normalizeScopeId(params.companyId),
    branchId: normalizeScopeId(params.branchId),
    vendorId: normalizeScopeId(params.vendorId),
  };
  if (levelOverride) {
    if (levelOverride === "global") return { scope: "global" };
    if (levelOverride === "company") return { scope: "company", companyId: normalized.companyId };
    if (levelOverride === "branch")
      return { scope: "branch", companyId: normalized.companyId, branchId: normalized.branchId };
    return { scope: "vendor", companyId: normalized.companyId, vendorId: normalized.vendorId };
  }
  if (normalized.branchId) {
    return { scope: "branch", companyId: normalized.companyId, branchId: normalized.branchId };
  }
  if (normalized.vendorId) {
    return { scope: "vendor", companyId: normalized.companyId, vendorId: normalized.vendorId };
  }
  if (normalized.companyId) {
    return { scope: "company", companyId: normalized.companyId };
  }
  return { scope: "global" };
}

export async function requirePermission(
  req: NextRequest,
  permissionKey: string,
  context: ScopeContext
) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await Rbac.checkPermission(userId, permissionKey, context);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
