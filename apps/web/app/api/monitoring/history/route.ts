import { NextRequest, NextResponse } from "next/server";
import { Monitoring } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company" | "branch" | "vendor";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const entityType = url.searchParams.get("entityType") ?? undefined;
    const entityId = url.searchParams.get("entityId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

    const permResp = await requirePermission(
      req,
      "monitoring.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const history = await Monitoring.listChangeHistory({
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
      limit: limit ?? 100,
    });
    return NextResponse.json({ data: history });
  } catch (error) {
    console.error("GET /api/monitoring/history error:", error);
    return NextResponse.json({ error: "Failed to load change history" }, { status: 500 });
  }
}
