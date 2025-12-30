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
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: "dateFrom and dateTo are required" }, { status: 400 });
    }

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const entityId = await Accounting.resolveEntityId(scope, companyId ?? null);
    const rows = await Accounting.getEntityProfitAndLoss({
      entityId,
      dateFrom,
      dateTo,
      branchId: branchId ?? null,
      vendorId: vendorId ?? null,
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/accounting/reports/profit-loss error:", error);
    return NextResponse.json({ error: "Failed to load P&L" }, { status: 500 });
  }
}
