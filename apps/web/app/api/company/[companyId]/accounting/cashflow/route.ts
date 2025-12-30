import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("to") ?? dateFrom;
    const entityId = await Accounting.resolveEntityId("company", companyId);
    const rows = await Accounting.getEntityCashFlow({ entityId, dateFrom, dateTo });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/cashflow error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
