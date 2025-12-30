import { NextRequest, NextResponse } from "next/server";
import type { ScopeContext } from "@repo/ai-core";
import { Rbac } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "./current-user";

export function buildScopeContextFromRoute(
  params: { companyId?: string; branchId?: string; vendorId?: string },
  levelOverride?: "global" | "company" | "branch" | "vendor"
): ScopeContext {
  if (levelOverride) {
    if (levelOverride === "global") return { scope: "global" };
    if (levelOverride === "company") return { scope: "company", companyId: params.companyId };
    if (levelOverride === "branch")
      return { scope: "branch", companyId: params.companyId, branchId: params.branchId };
    return { scope: "vendor", companyId: params.companyId, vendorId: params.vendorId };
  }
  if (params.branchId) {
    return { scope: "branch", companyId: params.companyId, branchId: params.branchId };
  }
  if (params.vendorId) {
    return { scope: "vendor", companyId: params.companyId, vendorId: params.vendorId };
  }
  if (params.companyId) {
    return { scope: "company", companyId: params.companyId };
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
