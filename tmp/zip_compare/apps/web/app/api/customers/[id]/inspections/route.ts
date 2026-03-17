import { NextRequest, NextResponse } from "next/server";
import { WorkshopInspections } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "inspections.view", scopeCtx);
    if (permResp) return permResp;

    const data = await WorkshopInspections.listInspectionsForCustomer(companyId, id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/customers/[id]/inspections error:", error);
    return NextResponse.json({ error: "Failed to load inspections" }, { status: 500 });
  }
}
