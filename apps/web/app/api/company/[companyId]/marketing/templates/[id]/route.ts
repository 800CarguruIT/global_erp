import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type ParamsContext =
  | { params: { companyId: string; id: string } }
  | { params: Promise<{ companyId: string; id: string }> };

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
  return (
    normalizeId((raw as any)?.companyId) ??
    normalizeId(body?.companyId) ??
    companyIdFromUrl(url)
  );
}

const updateSchema = z.object({
  providerKey: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  status: z.string().optional(),
  content: z.record(z.any()).optional(),
});

// GET /api/company/[companyId]/marketing/templates/[id]
export async function GET(_req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, _req.url);
  const params = await Promise.resolve(ctx.params);
  const id = normalizeId((params as any)?.id);
  if (!companyId || !id) {
    return NextResponse.json({ error: "companyId and id are required" }, { status: 400 });
  }

  try {
    const { MarketingTemplates } = await import("@repo/ai-core");
    const item = await MarketingTemplates.getTemplateById(companyId, id);
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/marketing/templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load template" },
      { status: 500 }
    );
  }
}

// PUT /api/company/[companyId]/marketing/templates/[id]
export async function PUT(req: NextRequest, ctx: ParamsContext) {
  try {
    const body = await req.json();
    const companyId = await getCompanyId(ctx, body, req.url);
    const params = await Promise.resolve(ctx.params);
    const id = normalizeId((params as any)?.id);
    if (!companyId || !id) {
      return NextResponse.json({ error: "companyId and id are required" }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    if (
      !parsed.data.name &&
      !parsed.data.status &&
      !parsed.data.content &&
      !parsed.data.providerKey
    ) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { MarketingTemplates } = await import("@repo/ai-core");
    const updated = await MarketingTemplates.updateTemplate({
      companyId,
      id,
      name: parsed.data.name ?? null,
      status: parsed.data.status ?? null,
      content: parsed.data.content ?? null,
      providerKey: parsed.data.providerKey ?? null,
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/company/[companyId]/marketing/templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// DELETE /api/company/[companyId]/marketing/templates/[id]
export async function DELETE(_req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, _req.url);
  const params = await Promise.resolve(ctx.params);
  const id = normalizeId((params as any)?.id);
  if (!companyId || !id) {
    return NextResponse.json({ error: "companyId and id are required" }, { status: 400 });
  }

  try {
    const { MarketingTemplates } = await import("@repo/ai-core");
    const existing = await MarketingTemplates.getTemplateById(companyId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Best-effort provider delete hook. Replace with real provider calls when available.
    if (existing.provider_template_id) {
      await MarketingTemplates.updateTemplate({
        companyId,
        id,
        providerStatus: "deleted",
      });
    }

    const deleted = await MarketingTemplates.deleteTemplate(companyId, id);
    return NextResponse.json({ item: deleted }, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/company/[companyId]/marketing/templates/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
