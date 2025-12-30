import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId }, scope)
    );
    if (permResp) return permResp;

    const entityId = await Accounting.resolveEntityId(scope, companyId ?? null);
    const rows = await Accounting.getEntityCashFlow({
      entityId,
      dateFrom,
      dateTo,
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/accounting/reports/cash-flow error:", error);
    return NextResponse.json({ error: "Failed to load Cash Flow" }, { status: 500 });
  }
}
