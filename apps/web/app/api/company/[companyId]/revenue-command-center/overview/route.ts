import { NextRequest, NextResponse } from "next/server";
import { Rcc } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type Ctx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = new Date(url.searchParams.get("from") || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
  const to = new Date(url.searchParams.get("to") || new Date().toISOString());

  const data = await Rcc.getOverviewTab({ companyId, from, to });
  return NextResponse.json(data);
}
