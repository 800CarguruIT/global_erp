import { NextRequest, NextResponse } from "next/server";
import { Monitoring } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

type ParamsCtx =
  | { params: { userId: string } }
  | { params: Promise<{ userId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { userId } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company" | "branch" | "vendor";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const permResp = await requirePermission(
      req,
      "monitoring.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const sessions = await Monitoring.getUserMonitoringOverview(userId).then((d) => d.sessions);
    return NextResponse.json({ data: sessions });
  } catch (error) {
    console.error("GET /api/monitoring/users/[userId]/sessions error:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
