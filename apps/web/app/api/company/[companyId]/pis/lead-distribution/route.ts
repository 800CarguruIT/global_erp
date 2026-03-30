import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  try {
    await Pis.checkExpiredOffers(companyId);
    const [queue, history, config] = await Promise.all([
      Pis.getQueueItems(companyId, status), Pis.getQueueHistory(companyId), Pis.getConfig(companyId),
    ]);
    return NextResponse.json({ queue, history, config: config.lead_distribution });
  } catch (error: any) {
    console.error("PIS lead-distribution error:", error);
    return NextResponse.json({ error: "Failed to load lead distribution" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { leadId, pipelineValue } = await req.json();
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
    const result = await Pis.routeLead(companyId, leadId, pipelineValue ?? 0);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("PIS route lead error:", error);
    return NextResponse.json({ error: "Failed to route lead" }, { status: 500 });
  }
}