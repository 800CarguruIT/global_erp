import { NextRequest, NextResponse } from "next/server";
import { Dialer } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await ctx.params;
    const data = await Dialer.checkDialerIntegrationHealth(id);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("POST /api/dialer/integrations/[id]/health error:", error);
    return NextResponse.json(
      { error: "Failed to run health check" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { id } = await ctx.params;
    const rows = await Dialer.getDialerIntegrationsHealth([id]);
    const data = rows[0] ?? null;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("GET /api/dialer/integrations/[id]/health error:", error);
    return NextResponse.json(
      { error: "Failed to load health" },
      { status: 500 }
    );
  }
}
