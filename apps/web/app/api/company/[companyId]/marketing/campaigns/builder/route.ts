import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ParamsContext = { params: { companyId: string } | Promise<{ companyId: string }> };

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

function companyIdFromUrl(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/company\/([^/]+)/i);
  return normalizeId(match?.[1]);
}

async function getCompanyId(ctx: ParamsContext, body?: any, url?: string) {
  const raw = await Promise.resolve(ctx.params);
  return normalizeId(raw?.companyId) ?? normalizeId(body?.companyId) ?? companyIdFromUrl(url);
}

const payloadSchema = z.object({
  graph: z.record(z.any()),
});

// GET /api/company/[companyId]/marketing/campaigns/builder
export async function GET(req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, req.url);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const { CampaignBuilder } = await import("@repo/ai-core");
    const graph = await CampaignBuilder.getCampaignBuilderGraph("company", companyId);
    return NextResponse.json({ graph: graph?.graph ?? null }, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/marketing/campaigns/builder error:", error);
    return NextResponse.json({ error: "Failed to load builder graph" }, { status: 500 });
  }
}

// PUT /api/company/[companyId]/marketing/campaigns/builder
export async function PUT(req: NextRequest, ctx: ParamsContext) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = await getCompanyId(ctx, body, req.url);
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { CampaignBuilder } = await import("@repo/ai-core");
    const saved = await CampaignBuilder.upsertCampaignBuilderGraph({
      scope: "company",
      companyId,
      graph: parsed.data.graph ?? {},
    });
    return NextResponse.json({ graph: saved.graph }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/company/[companyId]/marketing/campaigns/builder error:", error);
    return NextResponse.json({ error: "Failed to save builder graph" }, { status: 500 });
  }
}
