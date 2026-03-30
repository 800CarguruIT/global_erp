import { NextRequest, NextResponse } from "next/server";
import { Pis, Users } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { employee } = await Users.getUserWithEmployee(userId);
    if (employee && employee.company_id !== companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {}

  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Auto-compute fresh advisor scores on each master load
    const config = await Pis.getConfig(companyId);
    await Pis.computeAndStoreScores(companyId, config);

    const data = await Pis.getMasterData({ companyId, from, to });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PIS master error:", error);
    return NextResponse.json({ error: "Failed to load PIS master" }, { status: 500 });
  }
}