import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Channels, ChannelTypes } from "@repo/ai-core";

const updateSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  channelType: z
    .enum(["email", "sms", "whatsapp", "meta", "messaging", "ads", "analytics", "social"])
    .optional(),
  providerKey: z.string().min(1).optional(),
  authType: z.string().min(1).optional(),
  credentials: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional().nullable(),
  webhooks: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const integration = await Channels.getIntegrationByIdForScope(scope, id, companyId);
    if (!integration) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(integration);
  } catch (error: unknown) {
    console.error("GET /api/channels/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to load channel integration" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const scope = body.scope;

    if (scope === "company" && !body.companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    // Load existing to merge required fields
    const existing = await Channels.getIntegrationByIdForScope(scope, id, body.companyId ?? undefined);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload: Channels.SaveChannelIntegrationInput = {
      scope,
      companyId: scope === "company" ? body.companyId ?? existing.company_id : null,
      name: body.name ?? existing.name,
      channelType: (body.channelType ?? existing.channel_type) as ChannelTypes.ChannelType,
      providerKey: body.providerKey ?? existing.provider_key,
      authType: (body.authType ?? existing.auth_type) as ChannelTypes.AuthType,
      credentials: body.credentials ?? (existing.credentials as Record<string, unknown>),
      metadata: body.metadata ?? (existing.metadata as Record<string, unknown> | null),
      webhooks: body.webhooks ?? (existing.webhooks as Record<string, unknown> | null),
      isActive: body.isActive ?? existing.is_active,
    };

    const updated =
      scope === "global"
        ? await Channels.saveChannelIntegrationGlobal({ ...payload, id })
        : await Channels.saveChannelIntegrationForCompany({
            ...payload,
            id,
            companyId: payload.companyId,
          });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("PUT /api/channels/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update channel integration" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    // scope enforcement still applies by loading first
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const existing = await Channels.getIntegrationByIdForScope(scope, id, companyId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await Channels.softDeleteIntegration(id);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("DELETE /api/channels/integrations/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete channel integration" },
      { status: 500 }
    );
  }
}
