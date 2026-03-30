import { NextRequest, NextResponse } from "next/server";
import { Intelligence } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "../../../../../../lib/auth/current-user";

type ParamsCtx = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date();
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const branchId = url.searchParams.get("branchId") || null;
  try {
    const results = await Intelligence.runIntelligence({ companyId, branchId, engineKeys: ["e1", "e2", "e3", "e4", "e5", "e6", "e7"], from, to });
    return NextResponse.json({ engines: results });
  } catch (error: any) {
    console.error("PIS engines error:", error);
    return NextResponse.json({ error: "Failed to load engines" }, { status: 500 });
  }
}