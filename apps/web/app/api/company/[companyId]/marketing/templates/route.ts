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
  return (
    normalizeId(raw?.companyId) ??
    normalizeId(body?.companyId) ??
    companyIdFromUrl(url)
  );
}

const createSchema = z.object({
  type: z.enum(["whatsapp", "email"]),
  providerKey: z.string().min(1),
  name: z.string().min(1),
  status: z.string().optional(),
  content: z.record(z.any()).optional(),
  providerStatus: z.string().optional(),
  providerTemplateId: z.string().optional(),
});

// GET /api/company/[companyId]/marketing/templates
export async function GET(req: NextRequest, ctx: ParamsContext) {
  const companyId = await getCompanyId(ctx, undefined, req.url);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? undefined;
  if (type && type !== "whatsapp" && type !== "email") {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }

  try {
    const { MarketingTemplates } = await import("@repo/ai-core");
    const items = await MarketingTemplates.listTemplatesForCompany(
      companyId,
      type as "whatsapp" | "email" | undefined
    );
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("GET /api/company/[companyId]/marketing/templates error:", error);
    return NextResponse.json(
      { error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

// POST /api/company/[companyId]/marketing/templates
export async function POST(req: NextRequest, ctx: ParamsContext) {
  try {
    const body = await req.json();
    const companyId = await getCompanyId(ctx, body, req.url);
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { MarketingTemplates } = await import("@repo/ai-core");
    const created = await MarketingTemplates.insertTemplate({
      companyId,
      type: parsed.data.type,
      providerKey: parsed.data.providerKey,
      name: parsed.data.name,
      status: parsed.data.status ?? "draft",
      content: parsed.data.content ?? {},
      providerStatus: parsed.data.providerStatus ?? null,
      providerTemplateId: parsed.data.providerTemplateId ?? null,
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/marketing/templates error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
