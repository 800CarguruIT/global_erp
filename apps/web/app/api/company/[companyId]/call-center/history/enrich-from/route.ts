import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

const bodySchema = z.object({
  providerCallId: z.string().min(1),
  fromNumber: z.string().min(3),
});

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  return req.headers.get("x-user-id");
}

function normalizeMaybePhone(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  // Keep reading user-id for diagnostics, but do not block enrichment when
  // proxy headers are absent (frontend background sync path).
  const userId = await getCurrentUserId(req);

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const providerCallId = String(parsed.data.providerCallId).trim();
  const fromNumber = normalizeMaybePhone(parsed.data.fromNumber);
  if (!fromNumber) {
    return NextResponse.json({ error: "Invalid fromNumber" }, { status: 400 });
  }

  const sql = getSql();
  try {
    const runUpdate = async (whereSql: any) =>
      sql<{ id: string }[]>`
        UPDATE call_sessions
        SET
          from_number = ${fromNumber}::text,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'sdkEnrichedFrom', ${fromNumber}::text,
            'sdkEnrichedAt', NOW()::text,
            'sdkEnrichedByUserId', ${userId ?? null}::text
          ),
          updated_at = NOW()
        WHERE company_id = ${companyId}
          AND direction = 'inbound'
          AND ${whereSql}
          AND LOWER(BTRIM(COALESCE(from_number, ''))) IN ('', 'unknown')
        RETURNING id
      `;

    const byProvider = await runUpdate(sql`provider_call_id = ${providerCallId}`);
    const byProviderRows = (byProvider as any).rows ?? byProvider;
    if (Array.isArray(byProviderRows) && byProviderRows.length > 0) {
      return NextResponse.json({ ok: true, updated: byProviderRows.length, matchedBy: "provider_call_id" });
    }

    // Fallback: if frontend callId is actually call_sessions.id
    const byId = await runUpdate(sql`id::text = ${providerCallId}`);
    const byIdRows = (byId as any).rows ?? byId;
    return NextResponse.json({
      ok: true,
      updated: Array.isArray(byIdRows) ? byIdRows.length : 0,
      matchedBy: "id",
    });
  } catch (error: any) {
    console.error("POST /api/company/[companyId]/call-center/history/enrich-from error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to enrich from number" },
      { status: 500 }
    );
  }
}
