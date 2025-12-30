import { NextRequest, NextResponse } from "next/server";
import { Accounting } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const permResp = await requirePermission(
      req,
      "accounting.view",
      buildScopeContextFromRoute({ companyId }, scope)
    );
    if (permResp) return permResp;

    const journal = await Accounting.getJournalWithLines(id);
    return NextResponse.json(journal);
  } catch (error) {
    console.error("GET /api/accounting/journals/[id] error:", error);
    return NextResponse.json({ error: "Failed to load journal" }, { status: 500 });
  }
}
