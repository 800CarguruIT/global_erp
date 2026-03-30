import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const result = await Pis.simulateDistribution(companyId, body.leadCount ?? 60);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("PIS simulation error:", error);
    return NextResponse.json({ error: "Failed to run simulation" }, { status: 500 });
  }
}