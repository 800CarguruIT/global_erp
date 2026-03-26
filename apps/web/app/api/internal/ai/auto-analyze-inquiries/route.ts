import { NextRequest, NextResponse } from "next/server";
import { getSql, CallAiWorkflow } from "@repo/ai-core";
import { runInquiryAnalysis } from "@/app/api/company/[companyId]/ai/inquiries/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const internalSecret = process.env.INTERNAL_SECRET ?? "";
  if (!internalSecret || req.headers.get("x-internal-secret") !== internalSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitParam = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "5"), 1), 10);
  const providerCallId = url.searchParams.get("providerCallId") ?? null;
  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  const sql = getSql();

  // Backfill: create inquiries for outbound calls that have a recording but no inquiry row yet.
  // These were missed because inquiry creation was previously inbound-only.
  const backfillRows = await sql<{
    provider_key: string;
    provider_call_id: string;
    company_id: string;
    from_number: string;
    to_number: string;
  }[]>`
    SELECT cs.provider_key, cs.provider_call_id, cs.company_id,
           cs.from_number, cs.to_number
    FROM call_sessions cs
    JOIN LATERAL (
      SELECT 1
      FROM call_recordings
      WHERE call_session_id = cs.id
        AND url IS NOT NULL
        AND url NOT IN ('unknown', 'null', 'undefined', '')
      LIMIT 1
    ) cr ON true
    LEFT JOIN call_ai_inquiries cai
      ON cai.provider_call_id = cs.provider_call_id
     AND (cai.company_id = cs.company_id OR cs.company_id IS NULL)
    WHERE cs.direction = 'outbound'
      AND cs.company_id IS NOT NULL
      AND cai.id IS NULL
      ${providerCallId ? sql`AND cs.provider_call_id = ${providerCallId}` : sql``}
    ORDER BY cs.created_at DESC
    LIMIT 10
  `;

  const backfillList = (backfillRows as any).rows ?? backfillRows;
  for (const row of backfillList) {
    // Yeastar sends two provider_call_ids per outbound call (agent leg + trunk leg),
    // both within ~5 seconds. Skip if the trunk-leg inquiry already exists.
    const existing = await sql<{ id: string }[]>`
      SELECT id FROM call_ai_inquiries
      WHERE company_id = ${row.company_id}
        AND from_number = ${row.to_number ?? null}
      LIMIT 1
    `;
    const existingRows = (existing as any).rows ?? existing;
    if (existingRows.length > 0) continue;

    await CallAiWorkflow.runCallAiWorkflow({
      companyId: row.company_id,
      providerKey: row.provider_key,
      providerCallId: row.provider_call_id,
      fromNumber: row.to_number ?? null,
      toNumber: row.from_number ?? null,
      simulationMode: false,
      inquiryOnly: true,
    }).catch((err: unknown) => {
      console.error(`[auto-analyze] backfill outbound inquiry ${row.provider_call_id} failed:`, err);
    });
  }

  // Find inquiries that have a recording but haven't been analyzed yet
  const pending = await sql<{ id: string; company_id: string }[]>`
    SELECT cai.id, cai.company_id
    FROM call_ai_inquiries cai
    JOIN call_sessions cs
      ON cs.provider_call_id = cai.provider_call_id
     AND (cs.company_id = cai.company_id OR cs.company_id IS NULL)
    JOIN LATERAL (
      SELECT url
      FROM call_recordings
      WHERE call_session_id = cs.id
        AND url IS NOT NULL
        AND url NOT IN ('unknown', 'null', 'undefined', '')
      ORDER BY created_at DESC
      LIMIT 1
    ) cr ON true
    WHERE (
      (cai.ai_payload IS NULL)
      OR (jsonb_typeof(cai.ai_payload) = 'object'
          AND (cai.ai_payload->'aiRecordingAnalysis'->>'analyzedAt') IS NULL)
      OR (jsonb_typeof(cai.ai_payload) = 'array'
          AND (cai.ai_payload->-1->'aiRecordingAnalysis'->>'analyzedAt') IS NULL)
    )
      ${providerCallId ? sql`AND cai.provider_call_id = ${providerCallId}` : sql``}
    ORDER BY cai.created_at ASC
    LIMIT ${limitParam}
  `;

  const rows = (pending as any).rows ?? pending;
  if (!rows.length) {
    return NextResponse.json({ processed: 0, results: [], backfilled: backfillList.length });
  }

  const results: { id: string; ok: boolean; skipped?: boolean; error?: string }[] = [];
  for (const row of rows) {
    const result = await runInquiryAnalysis({
      inquiryId: row.id,
      companyId: row.company_id,
      baseUrl,
    });
    results.push({ id: row.id, ok: result.ok, skipped: result.skipped, error: result.error });
    if (!result.ok && !result.skipped) {
      // Log failures but continue processing remaining inquiries
      console.error(`[auto-analyze] inquiry ${row.id} failed: ${result.error}`);
    }
  }

  return NextResponse.json({ processed: results.length, results, backfilled: backfillList.length });
}
