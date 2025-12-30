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
    const dateAsOf = url.searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
    const entityId = await Accounting.resolveEntityId("company", companyId);
    const rows = await Accounting.getEntityBalanceSheet({ entityId, dateAsOf });
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/balance-sheet error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
