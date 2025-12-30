import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Channels } from "@repo/ai-core";

const sendSchema = z.object({
  channelType: z.enum(["email", "sms", "whatsapp", "meta", "messaging"]).optional(),
  to: z.union([z.string(), z.array(z.string())]),
  from: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1),
  htmlBody: z.string().optional().nullable(),
  mediaUrl: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  customPayload: z.unknown().optional(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "company") as "global" | "company";
    const companyId = url.searchParams.get("companyId") ?? undefined;

    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    if (scope === "company" && !companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const result = await Channels.sendMessageWithIntegrationId({
      scope,
      companyId,
      integrationId: id,
      input: parsed.data,
    });

    return NextResponse.json({
      success: result.success,
      data: result,
      integrationId: id,
    });
  } catch (error: unknown) {
    console.error("POST /api/channels/integrations/[id]/send error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
