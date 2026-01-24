import { NextRequest, NextResponse } from "next/server";
import { WorkshopEstimates } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "estimates.view", scopeCtx);
    if (permResp) return permResp;

    const data = await WorkshopEstimates.listEstimatesForCustomer(companyId, id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/customers/[id]/estimates error:", error);
    return NextResponse.json({ error: "Failed to load estimates" }, { status: 500 });
  }
}
