import { NextRequest, NextResponse } from "next/server";
import { Pis } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const commissions = await Pis.getCommissions(companyId);
    return NextResponse.json({ commissions });
  } catch (error: any) {
    console.error("PIS commission error:", error);
    return NextResponse.json({ error: "Failed to load commissions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const commissions = await Pis.computeCommissions(companyId);
    return NextResponse.json({ commissions });
  } catch (error: any) {
    console.error("PIS compute commissions error:", error);
    return NextResponse.json({ error: "Failed to compute commissions" }, { status: 500 });
  }
}