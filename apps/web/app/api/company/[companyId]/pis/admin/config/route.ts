import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const config = await Pis.getAllConfigs(companyId);
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });
    await Pis.updateConfig(companyId, key, value, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}