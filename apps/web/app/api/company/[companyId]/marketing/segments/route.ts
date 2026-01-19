import { NextRequest, NextResponse } from "next/server";

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

async function getCompanyId(ctx: ParamsContext, url?: string) {
  const raw = await Promise.resolve(ctx.params);
  return normalizeId(raw?.companyId) ?? companyIdFromUrl(url);
}

// GET /api/company/[companyId]/marketing/segments
export async function GET(req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, req.url);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const { MarketingSegments } = await import("@repo/ai-core");
    const items = await MarketingSegments.listSegmentsForCompany(companyId);
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/marketing/segments error:", error);
    return NextResponse.json({ error: "Failed to list segments" }, { status: 500 });
  }
}
