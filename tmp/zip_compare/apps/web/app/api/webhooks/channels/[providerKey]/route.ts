import { NextRequest, NextResponse } from "next/server";
import { Channels } from "@repo/ai-core";

export const dynamic = "force-dynamic";

type ParamsCtx =
  | { params: { providerKey: string } }
  | { params: Promise<{ providerKey: string }> };

async function handle(providerKey: string, req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    // Allow non-JSON payloads
  }
  await Channels.handleChannelWebhook(providerKey, payload, headers);
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { providerKey } = await ctx.params;
    await handle(providerKey, req);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Channel webhook error", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  return POST(req, ctx);
}
