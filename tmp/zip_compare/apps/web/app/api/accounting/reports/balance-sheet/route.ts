import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const dateAsOf = url.searchParams.get("dateAsOf") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;

    if (!dateAsOf) {
      return NextResponse.json({ error: "dateAsOf is required" }, { status: 400 });
    }

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId, branchId }, scope)
    );
    if (permResp) return permResp;

    const entityId = await Accounting.resolveEntityId(scope, companyId ?? null);
    const rows = await Accounting.getEntityBalanceSheet({
      entityId,
      dateAsOf,
      branchId: branchId ?? null,
    });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/accounting/reports/balance-sheet error:", error);
    return NextResponse.json({ error: "Failed to load Balance Sheet" }, { status: 500 });
  }
}
