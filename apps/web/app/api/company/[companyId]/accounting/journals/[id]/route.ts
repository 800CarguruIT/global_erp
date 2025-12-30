import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const journal = await Accounting.getJournalWithLines(id);
    return NextResponse.json({ data: journal });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/journals/[id] error", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
