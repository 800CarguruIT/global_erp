import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const entityId = await Accounting.resolveEntityId("company", companyId);
    const rows = await Accounting.getEntityTrialBalance({
      entityId,
      dateTo: new Date().toISOString().slice(0, 10),
    });
    const data = rows.map((r) => ({
      accountId: (r as any).accountId ?? (r as any).accountid,
      accountCode: (r as any).accountCode ?? (r as any).accountcode,
      accountName: (r as any).accountName ?? (r as any).accountname,
      accountType: (r as any).accountType ?? (r as any).accounttype ?? "",
      debit: Number((r as any).debit ?? 0),
      credit: Number((r as any).credit ?? 0),
    }));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/trial-balance error", error);
    return NextResponse.json({ error: "Failed to load trial balance" }, { status: 500 });
  }
}
