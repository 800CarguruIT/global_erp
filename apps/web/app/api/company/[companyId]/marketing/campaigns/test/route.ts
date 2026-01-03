import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ companyId: string }> };

const payloadSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  campaignId: z.string().optional(),
  graph: z.record(z.any()).optional(),
});

type DrawflowGraph = {
  drawflow?: {
    Home?: {
      data?: Record<string, any>;
    };
  };
};

type TemplateContent = {
  language?: string;
  headerType?: "none" | "text" | "media";
  headerText?: string;
  mediaUrl?: string;
  body?: string;
  subject?: string;
  from?: string;
};

function normalizeId(value?: string | null) {
  const id = value?.toString?.().trim?.();
  if (!id || id === "undefined" || id === "null") return null;
  return id;
}

function getNodes(graph: DrawflowGraph | null | undefined): Record<string, any> {
  const data = graph?.drawflow?.Home?.data;
  if (!data || typeof data !== "object") return {};
  return data;
}

function getIncomingNodeId(node: any): number | null {
  const inputs = node?.inputs ?? {};
  for (const input of Object.values(inputs)) {
    const connection = (input as any)?.connections?.[0];
    if (!connection?.node) continue;
    const id = Number(connection.node);
    if (Number.isFinite(id)) return id;
  }
  return null;
}

function buildBodyParams(body?: string) {
  if (!body) return [];
  const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g));
  const max = matches.reduce((acc, m) => Math.max(acc, Number(m[1] || 0)), 0);
  if (!max) return [];
  return Array.from({ length: max }, () => ({ type: "text", text: "Test" }));
}

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = normalizeId(rawCompanyId);
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const payload = await req.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const email = parsed.data.email?.trim() || "";
  const phone = parsed.data.phone?.trim() || "";
  if (!email && !phone) {
    return NextResponse.json({ error: "email or phone is required" }, { status: 400 });
  }

  let graph: DrawflowGraph | null = parsed.data.graph ?? null;
  if (!graph && parsed.data.campaignId) {
    try {
      const { CampaignBuilder } = await import("@repo/ai-core");
      const saved = await CampaignBuilder.getCampaignBuilderGraph(
        "company",
        companyId,
        normalizeId(parsed.data.campaignId)
      );
      graph = (saved?.graph as DrawflowGraph) ?? null;
    } catch (error) {
      console.error("Failed to load campaign builder graph for test.", error);
    }
  }

  if (!graph) {
    return NextResponse.json({ error: "Campaign graph not found" }, { status: 404 });
  }

  const nodes = getNodes(graph);
  const contentNodes = Object.values(nodes).filter(
    (node: any) => (node?.data?.key ?? node?.name) === "content"
  );
  if (contentNodes.length === 0) {
    return NextResponse.json({ error: "No content nodes found in campaign" }, { status: 400 });
  }

  const { MarketingTemplates, Channels } = await import("@repo/ai-core");
  const integrations = await Channels.listIntegrationsForCompany(companyId);
  const emailIntegration =
    integrations.find(
      (row) => row.is_active && row.channel_type === "email" && row.provider_key === "smtp"
    ) ??
    integrations.find((row) => row.is_active && row.channel_type === "email");
  const whatsappIntegration = integrations.find(
    (row) =>
      row.is_active &&
      row.channel_type === "whatsapp" &&
      (row.provider_key === "whatsapp-cloud" || row.provider_key === "meta")
  );

  const results: Array<{ channel: string; templateId?: string; success: boolean; error?: string }> =
    [];

  for (const node of contentNodes) {
    const incomingId = getIncomingNodeId(node);
    const incoming = incomingId ? nodes[String(incomingId)] : null;
    const channel = String(incoming?.data?.settings?.channel ?? "");
    const templateId = String(
      node?.data?.settings?.templateId ??
        incoming?.data?.settings?.templateId ??
        ""
    );

    if (!channel || !templateId) {
      results.push({
        channel: channel || "unknown",
        templateId: templateId || undefined,
        success: false,
        error: "Missing channel or template",
      });
      continue;
    }

    const template = await MarketingTemplates.getTemplateById(companyId, templateId);
    if (!template) {
      results.push({
        channel,
        templateId,
        success: false,
        error: "Template not found",
      });
      continue;
    }

    if (channel === "email") {
      if (!email) {
        results.push({
          channel,
          templateId,
          success: false,
          error: "Email required for email test",
        });
        continue;
      }
      if (template.type !== "email") {
        results.push({
          channel,
          templateId,
          success: false,
          error: "Template type mismatch",
        });
        continue;
      }
      if (!emailIntegration) {
        results.push({
          channel,
          templateId,
          success: false,
          error: "No active email integration",
        });
        continue;
      }
      const content = template.content as TemplateContent;
      const subject = String(content?.subject ?? template.name ?? "Campaign test");
      const body = String(content?.body ?? "");
      const from = content?.from ? String(content.from) : undefined;
      try {
        const res = await Channels.sendMessageWithIntegrationId({
          scope: "company",
          companyId,
          integrationId: emailIntegration.id,
          input: {
            to: email,
            from,
            subject,
            body: body || subject,
            htmlBody: body || null,
          },
        });
        results.push({
          channel,
          templateId,
          success: res.success !== false,
          error: res.success === false ? res.error : undefined,
        });
      } catch (error: any) {
        results.push({
          channel,
          templateId,
          success: false,
          error: error?.message ?? "Failed to send email",
        });
      }
      continue;
    }

    if (channel === "whatsapp") {
      if (!phone) {
        results.push({
          channel,
          templateId,
          success: false,
          error: "Mobile number required for WhatsApp test",
        });
        continue;
      }
      if (template.type !== "whatsapp") {
        results.push({
          channel,
          templateId,
          success: false,
          error: "Template type mismatch",
        });
        continue;
      }
      if (!whatsappIntegration) {
        results.push({
          channel,
          templateId,
          success: false,
          error: "No active WhatsApp integration",
        });
        continue;
      }
      const accessToken = String((whatsappIntegration.credentials as any)?.accessToken ?? "");
      const phoneNumberId = String((whatsappIntegration.metadata as any)?.phoneNumberId ?? "");
      if (!accessToken || !phoneNumberId) {
        results.push({
          channel,
          templateId,
          success: false,
          error: "Missing WhatsApp credentials",
        });
        continue;
      }
      const content = template.content as TemplateContent;
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
        to: phone,
        type: "template",
        template: {
          name: template.name,
          language: { code: content.language || "en" },
          ...(components.length ? { components } : {}),
        },
      };
      try {
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
          results.push({
            channel,
            templateId,
            success: false,
            error: responseBody?.error?.message || "Failed to send WhatsApp test",
          });
        } else {
          results.push({ channel, templateId, success: true });
        }
      } catch (error: any) {
        results.push({
          channel,
          templateId,
          success: false,
          error: error?.message ?? "Failed to send WhatsApp test",
        });
      }
      continue;
    }

    results.push({
      channel,
      templateId,
      success: false,
      error: "Unsupported channel for test",
    });
  }

  return NextResponse.json({ results }, { status: 200 });
}
