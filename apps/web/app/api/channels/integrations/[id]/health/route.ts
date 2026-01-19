import { NextRequest, NextResponse } from "next/server";
import { Channels } from "@repo/ai-core";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "global") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const data = await Channels.checkChannelIntegrationHealth(id, scope, companyId);
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("POST /api/channels/integrations/[id]/health error:", error);
    return NextResponse.json(
      { error: "Failed to run health check" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const rows = await Channels.getChannelIntegrationsHealth([id]);
    const data = rows[0] ?? null;
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("GET /api/channels/integrations/[id]/health error:", error);
    return NextResponse.json(
      { error: "Failed to load health" },
      { status: 500 }
    );
  }
}
