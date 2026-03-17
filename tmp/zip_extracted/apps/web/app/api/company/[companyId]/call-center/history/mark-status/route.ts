import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  providerCallId: z.string().min(1),
  status: z.enum(["initiated", "ringing", "in_progress", "completed", "cancelled", "failed"]),
  endedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const providerCallId = String(parsed.data.providerCallId).trim();
  const status = parsed.data.status;
  const endedAt = parsed.data.endedAt ? new Date(parsed.data.endedAt) : new Date();
  const startedAt = new Date();
  const shouldSetStartedAt = status === "in_progress";
  const shouldSetEndedAt = ["completed", "cancelled", "failed"].includes(status);
  const sql = getSql();

  try {
    const runUpdate = async (whereSql: any) =>
      sql<{ id: string }[]>`
        UPDATE call_sessions
        SET
          status = ${status},
          started_at = CASE
            WHEN ${shouldSetStartedAt}::boolean THEN COALESCE(started_at, ${startedAt.toISOString()}::timestamptz)
            ELSE started_at
          END,
          ended_at = CASE
            WHEN ${shouldSetEndedAt}::boolean THEN COALESCE(ended_at, ${endedAt.toISOString()}::timestamptz)
            ELSE ended_at
          END,
          duration_seconds = CASE
            WHEN ${shouldSetEndedAt}::boolean
              AND duration_seconds IS NULL
              AND COALESCE(started_at, ${startedAt.toISOString()}::timestamptz) IS NOT NULL
              THEN GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    COALESCE(ended_at, ${endedAt.toISOString()}::timestamptz) - COALESCE(started_at, ${startedAt.toISOString()}::timestamptz)
                  )
                ),
                0
              )::int
            ELSE duration_seconds
          END,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'manualStatusPatch', ${status},
            'manualStatusPatchAt', NOW()::text,
            'manualStatusPatchSource', 'popup_hang'
          ),
          updated_at = NOW()
        WHERE company_id = ${companyId}
          AND (${whereSql})
        RETURNING id
      `;

    const byProvider = await runUpdate(sql`provider_call_id = ${providerCallId}`);
    const byProviderRows = (byProvider as any).rows ?? byProvider;
    if (Array.isArray(byProviderRows) && byProviderRows.length > 0) {
      return NextResponse.json({
        ok: true,
        updated: byProviderRows.length,
        matchedBy: "provider_call_id",
      });
    }

    const byId = await runUpdate(sql`id::text = ${providerCallId}`);
    const byIdRows = (byId as any).rows ?? byId;
    return NextResponse.json({
      ok: true,
      updated: Array.isArray(byIdRows) ? byIdRows.length : 0,
      matchedBy: "id",
    });
  } catch (error: any) {
    console.error("POST /api/company/[companyId]/call-center/history/mark-status error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update call status" },
      { status: 500 }
    );
  }
}
