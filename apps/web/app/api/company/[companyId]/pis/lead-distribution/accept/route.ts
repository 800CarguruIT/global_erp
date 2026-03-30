import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { queueId } = await req.json();
    if (!queueId) return NextResponse.json({ error: "queueId required" }, { status: 400 });
    const result = await Pis.acceptLead(companyId, queueId, userId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("PIS accept error:", error);
    return NextResponse.json({ error: "Failed to accept lead" }, { status: 500 });
  }
}