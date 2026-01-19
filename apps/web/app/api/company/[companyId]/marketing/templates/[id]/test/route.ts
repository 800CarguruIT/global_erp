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

async function getParams(ctx: ParamsContext) {
  const raw = await Promise.resolve(ctx.params);
  return {
    companyId: normalizeId((raw as any)?.companyId),
    id: normalizeId((raw as any)?.id),
  };
}

const testSchema = z.object({
  to: z.string().min(6),
});

type TemplateContent = {
  language?: string;
  headerType?: "none" | "text" | "media";
  headerText?: string;
  mediaUrl?: string;
  body?: string;
};

function buildBodyParams(body?: string) {
  if (!body) return [];
  const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g));
  const max = matches.reduce((acc, m) => Math.max(acc, Number(m[1] || 0)), 0);
  if (!max) return [];
  return Array.from({ length: max }, () => ({ type: "text", text: "Test" }));
}

// POST /api/company/[companyId]/marketing/templates/[id]/test
export async function POST(req: NextRequest, ctx: ParamsContext) {
  try {
    const { companyId, id } = await getParams(ctx);
    if (!companyId || !id) {
      return NextResponse.json({ error: "companyId and id are required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = testSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { MarketingTemplates, Channels } = await import("@repo/ai-core");
    const existing = await MarketingTemplates.getTemplateById(companyId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (existing.type !== "whatsapp") {
      return NextResponse.json({ error: "Test send only supported for WhatsApp" }, { status: 400 });
    }

    const integrations = await Channels.listIntegrationsForCompany(companyId);
    const integration = integrations.find(
      (row) =>
        row.is_active &&
        row.channel_type === "whatsapp" &&
        (row.provider_key === "whatsapp-cloud" || row.provider_key === "meta")
    );
    if (!integration) {
      return NextResponse.json(
        { error: "No active WhatsApp integration found for company" },
        { status: 400 }
      );
    }

    const accessToken = String((integration.credentials as any)?.accessToken ?? "");
    const phoneNumberId = String((integration.metadata as any)?.phoneNumberId ?? "");
    if (!accessToken || !phoneNumberId) {
      return NextResponse.json(
        { error: "Missing WhatsApp credentials (accessToken/phoneNumberId)" },
        { status: 400 }
      );
    }

    const content = existing.content as TemplateContent;
    const components: any[] = [];
    if (content.headerType === "media" && content.mediaUrl?.trim()) {
      components.push({
        type: "header",
        parameters: [
          {
            type: "image",
            image: { link: content.mediaUrl.trim() },
          },
        ],
      });
    }
    const bodyParams = buildBodyParams(content.body);
    if (bodyParams.length) {
      components.push({ type: "body", parameters: bodyParams });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: parsed.data.to,
      type: "template",
      template: {
        name: existing.name,
        language: { code: content.language || "en" },
        ...(components.length ? { components } : {}),
      },
    };

    const res = await fetch(`https://graph.facebook.com/v24.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: responseBody?.error?.message || "Failed to send test", details: responseBody },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: responseBody });
  } catch (error) {
    console.error("POST /api/company/[companyId]/marketing/templates/[id]/test error:", error);
    return NextResponse.json(
      { error: "Failed to send test message" },
      { status: 500 }
    );
  }
}
