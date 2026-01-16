import { NextRequest, NextResponse } from "next/server";
import { getSql, CampaignBuilder, CampaignSchedules, Channels, MarketingTemplates } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; campaignId: string }> };

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

function getIncomingNodeId(node: any): string | null {
  const inputs = node?.inputs ?? {};
  for (const input of Object.values(inputs)) {
    const connection = (input as any)?.connections?.[0];
    if (!connection?.node) continue;
    return String(connection.node);
  }
  return null;
}

function buildBodyParams(body?: string) {
  if (!body) return [];
  const matches = Array.from(body.matchAll(/{{\s*(\d+)\s*}}/g));
  const max = matches.reduce((acc, m) => Math.max(acc, Number(m[1] || 0)), 0);
  if (!max) return [];
  return Array.from({ length: max }, () => ({ type: "text", text: "Customer" }));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunked: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunked.push(items.slice(i, i + size));
  }
  return chunked;
}

async function sendWhatsappBulk(input: {
  companyId: string;
  campaignId: string;
  nodeId?: string | null;
  templateId: string;
}) {
  const sql = getSql();
  const integrations = await Channels.listIntegrationsForCompany(input.companyId);
  const whatsappIntegration = integrations.find(
    (row) =>
      row.is_active &&
      row.channel_type === "whatsapp" &&
      (row.provider_key === "whatsapp-cloud" || row.provider_key === "meta")
  );
  if (!whatsappIntegration) {
    return { sent: 0, failed: 0, error: "No active WhatsApp integration" };
  }
  const accessToken = String((whatsappIntegration.credentials as any)?.accessToken ?? "");
  const phoneNumberId = String((whatsappIntegration.metadata as any)?.phoneNumberId ?? "");
  if (!accessToken || !phoneNumberId) {
    return { sent: 0, failed: 0, error: "Missing WhatsApp credentials" };
  }

  const template = await MarketingTemplates.getTemplateById(
    input.companyId,
    input.templateId
  );
  if (!template || template.type !== "whatsapp") {
    return { sent: 0, failed: 0, error: "WhatsApp template not found" };
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

  const recipients = await sql<{ whatsapp_phone: string | null }[]>`
    SELECT DISTINCT whatsapp_phone
    FROM customers
    WHERE company_id = ${input.companyId}
      AND is_active = TRUE
      AND whatsapp_phone IS NOT NULL
      AND TRIM(whatsapp_phone) <> ''
  `;
  const phones = recipients
    .map((row) => String(row.whatsapp_phone ?? "").trim())
    .filter((phone) => phone.length > 0);

  let sent = 0;
  let failed = 0;
  const batches = chunkArray(phones, 20);

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (phone) => {
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
            failed += 1;
            await sql`
              INSERT INTO marketing_whatsapp_events (
                company_id,
                campaign_id,
                node_id,
                recipient,
                event_type,
                provider_message_id,
                metadata,
                occurred_at
              )
              VALUES (
                ${input.companyId},
                ${input.campaignId},
                ${input.nodeId ?? null},
                ${phone},
                'failed',
                ${null},
                ${responseBody ?? null},
                NOW()
              )
            `;
            return;
          }
          sent += 1;
          const messageId = (responseBody as any)?.messages?.[0]?.id ?? null;
          await sql`
            INSERT INTO marketing_whatsapp_events (
              company_id,
              campaign_id,
              node_id,
              recipient,
              event_type,
              provider_message_id,
              metadata,
              occurred_at
            )
            VALUES (
              ${input.companyId},
              ${input.campaignId},
              ${input.nodeId ?? null},
              ${phone},
              'sent',
              ${messageId},
              ${null},
              NOW()
            )
          `;
        } catch (error: any) {
          failed += 1;
          await sql`
            INSERT INTO marketing_whatsapp_events (
              company_id,
              campaign_id,
              node_id,
              recipient,
              event_type,
              provider_message_id,
              metadata,
              occurred_at
            )
            VALUES (
              ${input.companyId},
              ${input.campaignId},
              ${input.nodeId ?? null},
              ${phone},
              'failed',
              ${null},
              ${{
                error: error?.message ?? "Failed to send WhatsApp message",
              }},
              NOW()
            )
          `;
        }
      })
    );
  }

  return { sent, failed };
}

async function handleRun(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId, campaignId: rawCampaignId } = await params;
  const companyId = normalizeId(rawCompanyId);
  const campaignId = normalizeId(rawCampaignId);
  if (!companyId || !campaignId) {
    return NextResponse.json({ error: "companyId and campaignId are required" }, { status: 400 });
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const scheduleId = normalizeId(req.nextUrl.searchParams.get("scheduleId")) ?? normalizeId(body?.scheduleId);
  const nodeId = normalizeId(req.nextUrl.searchParams.get("nodeId")) ?? normalizeId(body?.nodeId);
  if (!scheduleId && !nodeId) {
    return NextResponse.json({ error: "scheduleId or nodeId is required" }, { status: 400 });
  }

  const schedule = scheduleId
    ? await CampaignSchedules.getCampaignScheduleById(scheduleId)
    : await CampaignSchedules.getLatestCampaignScheduleByNode(companyId, campaignId, nodeId as string);

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  await CampaignSchedules.updateCampaignScheduleJob(schedule.id, { status: "running" });

  if (schedule.nodeKey === "launch") {
    let sendSummary: Record<string, unknown> | null = null;
    try {
      const graphRow = await CampaignBuilder.getCampaignBuilderGraph(
        "company",
        companyId,
        campaignId
      );
      const nodes = getNodes((graphRow?.graph as DrawflowGraph) ?? null);
      const contentNodes = Object.entries(nodes).filter(
        ([, node]) => (node?.data?.key ?? node?.name) === "content"
      );

      const whatsappTargets = contentNodes
        .map(([nodeId, node]) => {
          const incomingId = getIncomingNodeId(node);
          const incoming = incomingId ? nodes[String(incomingId)] : null;
          const channel = String(incoming?.data?.settings?.channel ?? "");
          const templateId = String(
            node?.data?.settings?.templateId ??
              incoming?.data?.settings?.templateId ??
              ""
          );
          if (channel !== "whatsapp" || !templateId) return null;
          return { nodeId: String(nodeId), templateId };
        })
        .filter(Boolean) as Array<{ nodeId: string; templateId: string }>;

      if (whatsappTargets.length === 0) {
        sendSummary = { channel: "whatsapp", status: "skipped", reason: "No WhatsApp content nodes" };
      } else {
        const results = [];
        for (const target of whatsappTargets) {
          results.push(
            await sendWhatsappBulk({
              companyId,
              campaignId,
              nodeId: target.nodeId,
              templateId: target.templateId,
            })
          );
        }
        sendSummary = { channel: "whatsapp", status: "completed", results };
      }
    } catch (error: any) {
      sendSummary = {
        channel: "whatsapp",
        status: "failed",
        error: error?.message ?? "Failed to send WhatsApp bulk messages",
      };
    }

    const finalStatus = sendSummary?.status === "failed" ? "failed" : "completed";
    const updated = await CampaignSchedules.markCampaignScheduleRun(schedule.id, finalStatus);
    const sql = getSql();
    const current = await sql<{ status: string }[]>`
      SELECT status
      FROM campaigns
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      LIMIT 1
    `;
    const currentStatus = String(current?.[0]?.status ?? "");
    const liveStatus = currentStatus.startsWith("marketing.status.") ? "marketing.status.live" : "live";
    const rows = await sql<{ status: string }[]>`
      UPDATE campaigns
      SET status = ${liveStatus},
          updated_at = NOW()
      WHERE id = ${campaignId} AND scope = 'company' AND company_id = ${companyId}
      RETURNING status
    `;
    const row = rows[0];
    return NextResponse.json(
      { schedule: updated, campaignStatus: row?.status ?? null, sendSummary },
      { status: 200 }
    );
  }

  const updated = await CampaignSchedules.markCampaignScheduleRun(schedule.id, "completed");
  return NextResponse.json({ schedule: updated }, { status: 200 });
}

export async function GET(req: NextRequest, ctx: Params) {
  return handleRun(req, ctx);
}

export async function POST(req: NextRequest, ctx: Params) {
  return handleRun(req, ctx);
}
