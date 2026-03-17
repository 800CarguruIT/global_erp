import { NextRequest, NextResponse } from "next/server";
import { EventAutomation } from "@repo/ai-core";
import { z } from "zod";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

const publishSchema = z.object({
  eventKey: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  dedupeKey: z.string().optional().nullable(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(
    req,
    "marketing.campaigns.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  try {
    const parsed = publishSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const item = await EventAutomation.publishNotificationEvent({
      companyId,
      ...parsed.data,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/events/notifications/publish error:", error);
    return NextResponse.json({ error: "Failed to publish event" }, { status: 500 });
  }
}
