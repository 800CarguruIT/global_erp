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

  const data = await Rcc.getMarketingSpend({ companyId, from, to });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { companyId } = await ctx.params;
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { source, periodStart, periodEnd, spendAmount, currency = "AED", notes = null } = body;

  if (!source || !periodStart || !periodEnd || spendAmount == null) {
    return NextResponse.json({ error: "Missing required fields: source, periodStart, periodEnd, spendAmount" }, { status: 400 });
  }

  await Rcc.upsertMarketingSpend(companyId, source, periodStart, periodEnd, spendAmount, currency, notes, userId);
  return NextResponse.json({ ok: true });
}
