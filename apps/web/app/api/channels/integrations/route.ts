import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Channels, ChannelTypes } from "@repo/ai-core";

const saveSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  name: z.string().min(1),
  channelType: z.enum(["email", "sms", "whatsapp", "meta", "messaging", "ads", "analytics", "social"]),
  providerKey: z.string().min(1),
  authType: z.string().min(1),
  credentials: z.record(z.any()).default({}),
  metadata: z.record(z.any()).optional().nullable(),
  webhooks: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().optional(),
  id: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    if (scope === "company" && !companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const items =
      scope === "global"
        ? await Channels.listIntegrationsForGlobal()
        : await Channels.listIntegrationsForCompany(companyId!);

    return NextResponse.json({ scope, companyId: scope === "company" ? companyId : null, items });
  } catch (error: unknown) {
    console.error("GET /api/channels/integrations error:", error);
    // Gracefully degrade to an empty list so UI can render without hard failure
    return NextResponse.json({ scope: "global", companyId: null, items: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = saveSchema.safeParse(json);
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

    const payload: Channels.SaveChannelIntegrationInput = {
      scope,
      companyId: scope === "company" ? body.companyId ?? null : null,
      name: body.name,
      channelType: body.channelType as ChannelTypes.ChannelType,
      providerKey: body.providerKey,
      authType: body.authType,
      credentials: body.credentials ?? {},
      metadata: body.metadata ?? {},
      webhooks: body.webhooks ?? {},
      isActive: body.isActive ?? true,
    };

    const saved =
      scope === "global"
        ? await Channels.saveChannelIntegrationGlobal({ ...payload, id: body.id })
        : await Channels.saveChannelIntegrationForCompany({ ...payload, id: body.id, companyId: body.companyId ?? null });

    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/channels/integrations error:", error);
    return NextResponse.json(
      { error: "Failed to save channel integration" },
      { status: 500 }
    );
  }
}
