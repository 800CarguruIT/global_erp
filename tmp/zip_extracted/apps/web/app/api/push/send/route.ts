import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Push } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../lib/auth/permissions";

const sendSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional().nullable(),
  integrationId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = sendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    if (body.scope === "company" && !body.companyId) {
      return NextResponse.json(
        { error: "companyId is required for company scope" },
        { status: 400 }
      );
    }

    const context = buildScopeContextFromRoute(
      { companyId: body.companyId ?? undefined },
      body.scope === "global" ? "global" : "company"
    );
    const authError = await requirePermission(req, "integrations.channel.use", context);
    if (authError) return authError;

    const result = await Push.sendPushNotification({
      scope: body.scope,
      companyId: body.scope === "company" ? body.companyId ?? null : null,
      userId: body.userId ?? null,
      title: body.title,
      body: body.body,
      data: body.data ?? undefined,
      integrationId: body.integrationId ?? null,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/push/send error:", error);
    return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
  }
}
