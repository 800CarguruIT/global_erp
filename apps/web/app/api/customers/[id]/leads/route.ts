import { NextRequest, NextResponse } from "next/server";
import { Leads } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.leads", scopeCtx);
    if (permResp) return permResp;

    const data = await Leads.listLeadsForCustomer(companyId, id);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/customers/[id]/leads error:", error);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}
