import { NextRequest, NextResponse } from "next/server";
import { EventAutomation } from "@repo/ai-core";
import { z } from "zod";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };

const processSchema = z.object({
  batchSize: z.number().int().min(1).max(500).optional(),
  baseBackoffMs: z.number().int().min(1000).max(60000).optional(),
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
    const parsed = processSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = await EventAutomation.processNotificationOutboxBatch({
      ...parsed.data,
      companyId,
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("POST /api/company/[companyId]/events/notifications/process error:", error);
    return NextResponse.json({ error: "Failed to process outbox" }, { status: 500 });
  }
}
