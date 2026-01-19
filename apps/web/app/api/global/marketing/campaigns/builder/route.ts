import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  graph: z.record(z.any()),
});

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

function campaignIdFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return normalizeId(parsed.searchParams.get("campaignId"));
  } catch {
    return null;
  }
}

// GET /api/global/marketing/campaigns/builder
export async function GET(req: NextRequest) {
  const campaignId = campaignIdFromUrl(req.url);
  try {
    const { CampaignBuilder } = await import("@repo/ai-core");
    const graph = await CampaignBuilder.getCampaignBuilderGraph("global", null, campaignId);
    return NextResponse.json({ graph: graph?.graph ?? null }, { status: 200 });
  } catch (error) {
    console.error("GET /api/global/marketing/campaigns/builder error:", error);
    return NextResponse.json({ error: "Failed to load builder graph" }, { status: 500 });
  }
}

// PUT /api/global/marketing/campaigns/builder
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const campaignId = campaignIdFromUrl(req.url);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { CampaignBuilder } = await import("@repo/ai-core");
    const saved = await CampaignBuilder.upsertCampaignBuilderGraph({
      scope: "global",
      campaignId,
      graph: parsed.data.graph ?? {},
    });
    return NextResponse.json({ graph: saved.graph }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/global/marketing/campaigns/builder error:", error);
    return NextResponse.json({ error: "Failed to save builder graph" }, { status: 500 });
  }
}
