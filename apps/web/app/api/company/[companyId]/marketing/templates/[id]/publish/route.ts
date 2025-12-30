import { NextRequest, NextResponse } from "next/server";
import { SESv2Client, CreateEmailTemplateCommand, UpdateEmailTemplateCommand } from "@aws-sdk/client-sesv2";
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

const publishSchema = z.object({
  providerStatus: z.string().optional(),
  providerTemplateId: z.string().optional(),
});

type TemplateContent = {
  language?: string;
  category?: string;
  headerType?: "none" | "text" | "media";
  headerText?: string;
  mediaUrl?: string;
  body?: string;
  footer?: string;
  actions?: Array<{ type?: string; label?: string; value?: string }>;
  subject?: string;
  from?: string;
  design?: Record<string, unknown>;
};

function buildMetaTemplatePayload(
  name: string,
  content: TemplateContent,
  mediaHandle?: string
) {
  const components: any[] = [];
  if (content.headerType === "text" && content.headerText?.trim()) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: content.headerText.trim(),
    });
  }
  if (content.headerType === "media") {
    if (!mediaHandle) {
      throw new Error("Missing media handle for image header template");
    }
    components.push({
      type: "HEADER",
      format: "IMAGE",
      example: { header_handle: [mediaHandle] },
    });
  }
  components.push({
    type: "BODY",
    text: content.body?.trim() || "",
  });
  if (content.footer?.trim()) {
    components.push({
      type: "FOOTER",
      text: content.footer.trim(),
    });
  }
  const actions = (content.actions ?? []).filter((a) => a?.type && a?.label);
  if (actions.length) {
    components.push({
      type: "BUTTONS",
      buttons: actions.map((a) => {
        if (a.type === "url") {
          return { type: "URL", text: a.label, url: a.value ?? "" };
        }
        if (a.type === "phone") {
          return { type: "PHONE_NUMBER", text: a.label, phone_number: a.value ?? "" };
        }
        return { type: "QUICK_REPLY", text: a.label };
      }),
    });
  }

  return {
    name,
    language: content.language || "en",
    category: (content.category || "marketing").toUpperCase(),
    components,
  };
}

function sanitizeTemplateName(name: string) {
  const safe = name.trim().replace(/[^A-Za-z0-9_-]/g, "_");
  return safe.length ? safe.slice(0, 64) : `template_${Date.now()}`;
}

function getAwsRegion(integration: any) {
  return (
    (integration?.credentials as any)?.region ||
    (integration?.metadata as any)?.region ||
    "us-east-1"
  );
}

function getSesClient(integration: any) {
  const creds = integration?.credentials as any;
  const accessKeyId = creds?.accessKeyId || creds?.access_key_id;
  const secretAccessKey = creds?.secretAccessKey || creds?.secret_access_key;
  const sessionToken = creds?.sessionToken || creds?.session_token;
  const region = getAwsRegion(integration);

  const clientConfig: any = { region };
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: String(accessKeyId),
      secretAccessKey: String(secretAccessKey),
      ...(sessionToken ? { sessionToken: String(sessionToken) } : {}),
    };
  }

  return new SESv2Client(clientConfig);
}

// POST /api/company/[companyId]/marketing/templates/[id]/publish
export async function POST(req: NextRequest, ctx: ParamsContext) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = await getCompanyId(ctx, body, req.url);
    const params = await Promise.resolve(ctx.params);
    const id = normalizeId((params as any)?.id);

    if (!companyId || !id) {
      return NextResponse.json(
        { error: "companyId and id are required" },
        { status: 400 }
      );
    }

    const parsed = publishSchema.safeParse(body);
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

    let providerTemplateId = parsed.data.providerTemplateId ?? null;
    let providerStatus =
      parsed.data.providerStatus ??
      (existing.type === "whatsapp" ? "submitted" : "published");

    if (existing.type === "whatsapp") {
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
      const businessAccountId = String((integration.metadata as any)?.businessAccountId ?? "");
      const phoneNumberId = String((integration.metadata as any)?.phoneNumberId ?? "");

      if (!accessToken || !businessAccountId) {
        return NextResponse.json(
          { error: "Missing WhatsApp credentials (accessToken/businessAccountId)" },
          { status: 400 }
        );
      }

      let mediaHandle: string | undefined;
      const content = existing.content as TemplateContent;
      if (content.headerType === "media") {
        if (!content.mediaUrl?.trim()) {
          return NextResponse.json(
            { error: "Media URL is required for image header templates" },
            { status: 400 }
          );
        }
        if (!phoneNumberId) {
          return NextResponse.json(
            { error: "Missing WhatsApp metadata (phoneNumberId)" },
            { status: 400 }
          );
        }
        const mediaFetch = await fetch(content.mediaUrl.trim());
        if (!mediaFetch.ok) {
          return NextResponse.json(
            { error: "Failed to fetch media URL for upload" },
            { status: 400 }
          );
        }
        const contentType = mediaFetch.headers.get("content-type") || "image/jpeg";
        const blob = await mediaFetch.blob();
        const form = new FormData();
        form.append("messaging_product", "whatsapp");
        form.append("type", "image");
        form.append("file", blob, "header-media");

        const uploadRes = await fetch(
          `https://graph.facebook.com/v24.0/${businessAccountId}/media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            body: form as any,
          }
        );
        const uploadBody = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadBody?.id) {
          return NextResponse.json(
            {
              error: uploadBody?.error?.message || "Failed to upload header media",
              details: uploadBody,
            },
            { status: 502 }
          );
        }
        mediaHandle = uploadBody.id as string;
      }

      let payload: ReturnType<typeof buildMetaTemplatePayload>;
      try {
        payload = buildMetaTemplatePayload(existing.name, content, mediaHandle);
      } catch (err: unknown) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid template payload" },
          { status: 400 }
        );
      }

      const res = await fetch(
        `https://graph.facebook.com/v24.0/${businessAccountId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return NextResponse.json(
          { error: body?.error?.message || "Failed to submit template to Meta", details: body },
          { status: 502 }
        );
      }

      providerTemplateId = body.id ?? providerTemplateId;
      providerStatus = body.status ?? providerStatus;
    }

    if (existing.type === "email") {
      const integrations = await Channels.listIntegrationsForCompany(companyId);
      const integration = integrations.find(
        (row) => row.is_active && row.channel_type === "email" && row.provider_key === "aws"
      );

      if (!integration) {
        return NextResponse.json(
          { error: "No active AWS SES integration found for company" },
          { status: 400 }
        );
      }

      const content = existing.content as TemplateContent;
      const subject = content.subject?.trim() || existing.name;
      const htmlBody = content.body?.trim() || "";
      if (!subject || !htmlBody) {
        return NextResponse.json(
          { error: "Email subject and HTML body are required to publish" },
          { status: 400 }
        );
      }

      const templateName = sanitizeTemplateName(existing.name);
      const client = getSesClient(integration);

      try {
        await client.send(
          new CreateEmailTemplateCommand({
            TemplateName: templateName,
            TemplateContent: {
              Subject: subject,
              Html: htmlBody,
            },
          })
        );
      } catch (err: any) {
        if (err?.name === "AlreadyExistsException") {
          await client.send(
            new UpdateEmailTemplateCommand({
              TemplateName: templateName,
              TemplateContent: {
                Subject: subject,
                Html: htmlBody,
              },
            })
          );
        } else {
          console.error("AWS SES template save error:", err);
          return NextResponse.json(
            { error: err?.message || "Failed to save SES template" },
            { status: 502 }
          );
        }
      }

      providerTemplateId = templateName;
      providerStatus = "published";
    }

    const updated = await MarketingTemplates.updateTemplate({
      companyId,
      id,
      status: existing.type === "whatsapp" ? "submitted" : "ready",
      providerStatus,
      providerTemplateId,
      publishedAt: new Date(),
    });

    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/marketing/templates/[id]/publish error:", error);
    return NextResponse.json(
      { error: "Failed to publish template" },
      { status: 500 }
    );
  }
}
