import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const config = await Pis.getConfig(companyId);
    return NextResponse.json(config.lead_distribution);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    await Pis.updateConfig(companyId, "lead_distribution", body, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}