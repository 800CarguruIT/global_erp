import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Push } from "@repo/ai-core";
import { requireUserId } from "../../../../lib/auth/current-user";

const registerSchema = z.object({
  scope: z.enum(["global", "company"]).default("company"),
  companyId: z.string().optional().nullable(),
  deviceToken: z.string().min(10),
  platform: z.string().optional().nullable(),
  deviceId: z.string().optional().nullable(),
});

const deleteSchema = z.object({
  deviceToken: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const parsed = registerSchema.safeParse(await req.json());
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

    const saved = await Push.registerPushDeviceToken({
      scope: body.scope,
      companyId: body.scope === "company" ? body.companyId ?? null : null,
      userId,
      deviceToken: body.deviceToken,
      platform: body.platform ?? null,
      deviceId: body.deviceId ?? null,
      isActive: true,
    });

    return NextResponse.json({ success: true, token: saved });
  } catch (error: unknown) {
    console.error("POST /api/push/tokens error:", error);
    return NextResponse.json({ error: "Failed to register token" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await requireUserId(req);
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const removed = await Push.unregisterPushDeviceToken(parsed.data.deviceToken, userId);
    if (!removed) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/push/tokens error:", error);
    return NextResponse.json({ error: "Failed to unregister token" }, { status: 500 });
  }
}
