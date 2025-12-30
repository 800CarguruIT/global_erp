import { NextRequest, NextResponse } from "next/server";
import { Monitoring } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

type ParamsCtx =
  | { params: { userId: string } }
  | { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { userId } = await routeCtx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company" | "branch" | "vendor";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const actionKey = url.searchParams.get("actionKey") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

    const permResp = await requirePermission(
      req,
      "monitoring.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const ctx = buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope);
    const logs = await Monitoring.listActivityLogs({
      userId,
      actionKey: actionKey ?? undefined,
      scopeContext: ctx,
      limit: limit ?? 100,
    });
    return NextResponse.json({ data: logs });
  } catch (error) {
    console.error("GET /api/monitoring/users/[userId]/logs error:", error);
    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }
}
