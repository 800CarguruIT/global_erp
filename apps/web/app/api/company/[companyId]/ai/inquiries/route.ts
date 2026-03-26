import { NextRequest, NextResponse } from "next/server";
import { getSql, CallAiWorkflow, Leads, Crm, getOpenAIClientForCompany } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConversationTurn = { speaker: "agent" | "customer"; text: string };

type AnalysisPayload = {
  caller_name?: string | null;
  mobile_number?: string | null;
  plate_number?: string | null;
  request_type?: string | null;
  location?: string | null;
  lead_type?: "rsa" | "recovery" | "workshop" | null;
  confidence?: number | null;
  summary?: string | null;
};

const RSA_DIVISIONS = [
  "tyre",
  "battery",
  "jump_start",
  "fuel_delivery",
  "ac_gas",
  "inspection",
  "warranty_claimed",
] as const;

const RECOVERY_DIVISIONS = [
  "insurance_recovery",
  "customer_to_customer",
  "internal_workshop_to_workshop",
] as const;

const AI_PAYLOAD_OBJECT_SQL = `
  CASE
    WHEN jsonb_typeof(ai_payload) = 'object' THEN ai_payload
    WHEN jsonb_typeof(ai_payload) = 'array' AND jsonb_array_length(ai_payload) > 0 THEN
      CASE
        WHEN jsonb_typeof(ai_payload->-1) = 'object' THEN ai_payload->-1
        ELSE '{}'::jsonb
      END
    ELSE '{}'::jsonb
  END
`;

function normalizePhoneDigits(value?: string | null): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+/, "");
}

function buildPhoneCandidates(rawPhone?: string | null): string[] {
  const digits = normalizePhoneDigits(rawPhone);
  if (!digits) return [];

  const set = new Set<string>();
  const add = (candidate: string) => {
    const normalized = stripLeadingZeros(normalizePhoneDigits(candidate));
    if (normalized) set.add(normalized);
  };

  add(digits);
  if (digits.startsWith("0") && digits.length >= 9) {
    add(digits.slice(1));
    add(`971${digits.slice(1)}`);
  }
  if (digits.startsWith("971") && digits.length >= 11) {
    const localNoZero = digits.slice(3);
    add(localNoZero);
    add(`0${localNoZero}`);
  }
  if (!digits.startsWith("0") && !digits.startsWith("971") && digits.length >= 8) {
    add(`0${digits}`);
    add(`971${digits}`);
  }

  return Array.from(set);
}

function buildPhoneSuffixCandidates(rawPhone?: string | null): string[] {
  const candidates = buildPhoneCandidates(rawPhone);
  const suffixes = new Set<string>();
  for (const candidate of candidates) {
    const digits = normalizePhoneDigits(candidate);
    if (digits.length >= 9) suffixes.add(digits.slice(-9));
  }
  return Array.from(suffixes);
}

function isUsableRecordingUrl(url: string | null | undefined): boolean {
  const normalized = String(url ?? "").trim().toLowerCase();
  return normalized.length > 0 && normalized !== "unknown" && normalized !== "null" && normalized !== "undefined";
}

function isLeadFinalized(statusRaw: unknown, stageRaw: unknown): boolean {
  const status = String(statusRaw ?? "").trim().toLowerCase();
  const stage = String(stageRaw ?? "").trim().toLowerCase();
  if (["closed", "closed_won", "lost", "done", "completed"].includes(status)) return true;
  if (stage === "closed") return true;
  return false;
}

function toLeadType(value: unknown): "rsa" | "recovery" | "workshop" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "recovery") return "recovery";
  if (normalized === "workshop" || normalized === "walkin" || normalized === "walk-in") return "workshop";
  return "rsa";
}

function cleanText(value: unknown): string | null {
  const str = String(value ?? "").trim();
  return str.length ? str : null;
}

async function fetchRecordingBufferViaProxy(args: {
  req?: NextRequest;
  baseUrl?: string;
  companyId: string;
  recordingUrl: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const path = `/api/company/${args.companyId}/call-center/history/recording-proxy`;
  let candidates: URL[];
  if (args.req) {
    const hostHeader = String(args.req.headers.get("host") ?? "").trim();
    const port =
      hostHeader.includes(":") && hostHeader.split(":")[1]
        ? hostHeader.split(":")[1]
        : "3000";
    candidates = [
      new URL(path, args.req.nextUrl.origin),
      new URL(path, `http://127.0.0.1:${port}`),
      new URL(path, `http://localhost:${port}`),
    ];
  } else {
    const base = (args.baseUrl ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    candidates = [new URL(path, base), new URL(path, "http://localhost:3000"), new URL(path, "http://127.0.0.1:3000")];
  }

  const extraHeaders: Record<string, string> = args.req
    ? {
        cookie: args.req.headers.get("cookie") ?? "",
        authorization: args.req.headers.get("authorization") ?? "",
      }
    : {};

  let lastError: string | null = null;
  for (const proxyUrl of candidates) {
    proxyUrl.searchParams.set("recordingUrl", args.recordingUrl);
    try {
      const res = await fetch(proxyUrl.toString(), {
        headers: extraHeaders,
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        lastError = `Failed to fetch recording: ${res.status} ${txt || res.statusText}`;
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length) {
        lastError = "Recording is empty";
        continue;
      }
      const fromQuery = String(args.recordingUrl ?? "").trim().split(/[?#]/)[0];
      const fileName = fromQuery.split("/").filter(Boolean).pop() || "recording.wav";
      return { buffer: bytes, fileName };
    } catch (err: any) {
      lastError = err?.message ?? "fetch failed";
      continue;
    }
  }

  throw new Error(lastError ?? "fetch failed");
}

async function analyzeTranscriptWithAi(args: {
  companyId: string;
  transcript: string;
  fromNumber: string | null;
  toNumber: string | null;
}): Promise<AnalysisPayload> {
  const { client } = await getOpenAIClientForCompany(args.companyId);
  if (!client) throw new Error("AI provider is not configured");
  const model = process.env.CALL_AI_ANALYSIS_MODEL || "gpt-4o-mini";
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract structured call fields as JSON only. Keys: caller_name, mobile_number, plate_number, request_type, location, lead_type, confidence, summary. lead_type must be one of rsa|recovery|workshop. confidence is 0..1.",
      },
      {
        role: "user",
        content: JSON.stringify({
          from_number: args.fromNumber,
          to_number: args.toNumber,
          transcript: args.transcript,
        }),
      },
    ],
  });
  const raw = completion.choices?.[0]?.message?.content ?? "{}";
  let parsed: AnalysisPayload = {};
  try {
    parsed = JSON.parse(raw) as AnalysisPayload;
  } catch {
    parsed = {};
  }
  return {
    caller_name: parsed.caller_name ?? null,
    mobile_number: parsed.mobile_number ?? null,
    plate_number: parsed.plate_number ?? null,
    request_type: parsed.request_type ?? null,
    location: parsed.location ?? null,
    lead_type: toLeadType(parsed.lead_type),
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
    summary: parsed.summary ?? null,
  };
}

async function diarizeTranscript(
  transcript: string,
  client: import("openai").default,
  model: string
): Promise<ConversationTurn[] | null> {
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a call transcript diarizer. Split the given call transcript into speaker turns. Return JSON: { "turns": [ { "speaker": "agent"|"customer", "text": "..." }, ... ] }. Rules: "agent" is the company representative answering the call. "customer" is the external caller. Each turn is one continuous block of speech by a single speaker. Do not summarize — preserve original wording.',
        },
        { role: "user", content: transcript },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed: { turns?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    // Accept both top-level "turns" and bare arrays
    const rawTurns: unknown = Array.isArray(parsed) ? parsed : parsed.turns;
    if (!Array.isArray(rawTurns) || rawTurns.length === 0) return null;
    const turns: ConversationTurn[] = [];
    for (const t of rawTurns) {
      if (!t || typeof t !== "object") continue;
      const speakerRaw = String((t as any).speaker ?? "").toLowerCase().trim();
      const text = String((t as any).text ?? "").trim();
      if (!text) continue;
      // Accept "agent", "representative", "staff", "operator" → agent
      // Accept "customer", "caller", "client" → customer
      let speaker: "agent" | "customer" | null = null;
      if (speakerRaw === "agent" || speakerRaw.includes("agent") || speakerRaw.includes("rep") || speakerRaw.includes("staff") || speakerRaw.includes("operator")) {
        speaker = "agent";
      } else if (speakerRaw === "customer" || speakerRaw.includes("customer") || speakerRaw.includes("caller") || speakerRaw.includes("client")) {
        speaker = "customer";
      }
      if (speaker) turns.push({ speaker, text });
    }
    return turns.length > 0 ? turns : null;
  } catch (err) {
    console.error("[diarizeTranscript] failed:", err);
    return null;
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const url = new URL(req.url);
  const page    = Math.max(1, Number(url.searchParams.get("page")   ?? "1"));
  const limit   = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "25"), 1), 100);
  const offset  = (page - 1) * limit;
  const dateFrom        = url.searchParams.get("dateFrom")?.trim()        || null;
  const dateTo          = url.searchParams.get("dateTo")?.trim()          || null;
  const toNumber        = url.searchParams.get("toNumber")?.trim()        || null;
  const search          = url.searchParams.get("search")?.trim()          || null;
  const conversionStatus = url.searchParams.get("conversionStatus")?.trim() || null;
  const fromNumber       = url.searchParams.get("fromNumber")?.trim()        || null;
  const grouped          = url.searchParams.get("grouped") === "true";

  const sql = getSql();

  // Fire-and-forget: fix inquiries for outbound calls.
  // Yeastar sends TWO provider_call_ids per outbound call (agent leg + trunk leg).
  // The trunk leg fires as "inbound" and creates an inquiry with no/wrong agent (to_number = trunk prefix).
  // Strategy: for each outbound session without a direct inquiry, UPDATE the trunk-leg inquiry
  // (same customer, same time window, trunk-like to_number) to add the correct agent extension.
  // Only INSERT a new inquiry when no existing one is found.
  void (async () => {
    try {
      const outboundMissed = await sql<{
        provider_key: string; provider_call_id: string;
        from_number: string; to_number: string; session_created_at: string;
      }[]>`
        SELECT cs.provider_key, cs.provider_call_id, cs.from_number, cs.to_number,
               cs.created_at::text AS session_created_at
        FROM call_sessions cs
        JOIN LATERAL (
          SELECT 1 FROM call_recordings
          WHERE call_session_id = cs.id
            AND url IS NOT NULL AND url NOT IN ('unknown','null','undefined','')
          LIMIT 1
        ) cr ON true
        LEFT JOIN call_ai_inquiries cai
          ON cai.provider_call_id = cs.provider_call_id
         AND cai.company_id = cs.company_id
        WHERE cs.direction = 'outbound'
          AND cs.company_id = ${companyId}
          AND cai.id IS NULL
        ORDER BY cs.created_at DESC
        LIMIT 20
      `;
      const missed = (outboundMissed as any).rows ?? outboundMissed;
      for (const r of missed) {
        // Yeastar sends two provider_call_ids per outbound call (agent leg + trunk leg).
        // The trunk leg fires as "inbound" and may have already created an inquiry, BUT its
        // provider_call_id has no recording — the recording is stored under the agent-leg ID.
        // Strategy:
        //   - If a trunk-leg inquiry exists nearby: UPDATE its provider_call_id to the
        //     agent-leg one so the recording LATERAL JOIN can find the recording.
        //   - If no inquiry exists: CREATE one under the agent-leg provider_call_id.
        const existing = await sql<{ id: string }[]>`
          SELECT id FROM call_ai_inquiries
          WHERE company_id = ${companyId}
            AND from_number = ${r.to_number ?? null}
            AND created_at BETWEEN ${r.session_created_at}::timestamptz - interval '30 seconds'
                                AND ${r.session_created_at}::timestamptz + interval '5 minutes'
          LIMIT 1
        `;
        const existingRows = (existing as any).rows ?? existing;
        if (existingRows.length > 0) {
          // Point the existing inquiry at the agent-leg session so the recording shows up
          await sql`
            UPDATE call_ai_inquiries
            SET provider_call_id = ${r.provider_call_id},
                provider_key      = ${r.provider_key},
                updated_at        = now()
            WHERE id = ${existingRows[0].id}
              AND provider_call_id != ${r.provider_call_id}
          `.catch(() => {});
          continue;
        }

        // No inquiry exists for this customer at this call time — create one
        await CallAiWorkflow.runCallAiWorkflow({
          companyId,
          providerKey: r.provider_key,
          providerCallId: r.provider_call_id,
          fromNumber: r.to_number ?? null,   // customer is the called party
          toNumber: r.from_number ?? null,   // agent is the calling party
          simulationMode: false,
          inquiryOnly: true,
        }).catch(() => {});
      }
    } catch { /* non-critical */ }
  })();

  // Composable filter fragments applied to both the data query and aggregates
  const dateFromCond      = dateFrom        ? sql`AND created_at >= ${dateFrom}::timestamptz`                                                            : sql``;
  const dateToCond        = dateTo          ? sql`AND created_at <= ${dateTo}::timestamptz`                                                              : sql``;
  const toNumberCond      = toNumber        ? sql`AND to_number = ${toNumber}`                                                                           : sql``;
  const searchCond        = search          ? sql`AND (from_number ILIKE ${"%" + search + "%"} OR provider_call_id ILIKE ${"%" + search + "%"})` : sql``;
  const conversionCond    = conversionStatus ? sql`AND conversion_status = ${conversionStatus}`                                                          : sql``;
  const fromNumberCond    = fromNumber       ? sql`AND from_number = ${fromNumber}`                                                                      : sql``;

  try {
    // Fast KPI aggregates — single query, no JOINs, respects all filters
    const [kpiRow] = await sql<{
      total: number; today: number; converted: number; pending: number;
      appointment: number; walkin: number; lost: number;
    }[]>`
      SELECT
        COUNT(*)::int                                                                          AS total,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int                               AS today,
        COUNT(*) FILTER (WHERE conversion_status = 'converted')::int                          AS converted,
        COUNT(*) FILTER (WHERE conversion_status != 'converted')::int                         AS pending,
        COUNT(*) FILTER (WHERE lead_outcome = 'appointment')::int                             AS appointment,
        COUNT(*) FILTER (WHERE lead_outcome = 'walkin_service_request')::int                  AS walkin,
        COUNT(*) FILTER (WHERE lead_outcome = 'lost_lead')::int                               AS lost
      FROM call_ai_inquiries
      WHERE company_id = ${companyId}
        ${dateFromCond} ${dateToCond} ${toNumberCond} ${searchCond} ${conversionCond} ${fromNumberCond}
    `;

    const totalCount = kpiRow?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // Grouped view — one row per caller mobile
    if (grouped) {
      // Rebuild filter conditions with explicit table prefix to avoid ambiguity with the JOIN
      const gDateFrom    = dateFrom        ? sql`AND i.created_at >= ${dateFrom}::timestamptz`                                                              : sql``;
      const gDateTo      = dateTo          ? sql`AND i.created_at <= ${dateTo}::timestamptz`                                                                : sql``;
      const gToNumber    = toNumber        ? sql`AND i.to_number = ${toNumber}`                                                                             : sql``;
      const gSearch      = search          ? sql`AND (i.from_number ILIKE ${"%" + search + "%"} OR i.provider_call_id ILIKE ${"%" + search + "%"})` : sql``;
      const gConversion  = conversionStatus ? sql`AND i.conversion_status = ${conversionStatus}`                                                            : sql``;
      const gFromNumber  = fromNumber       ? sql`AND i.from_number = ${fromNumber}`                                                                        : sql``;

      const groupedRows = await sql<{
        from_number: string | null;
        call_count: number;
        today_count: number;
        last_call_at: string;
        converted_count: number;
        pending_count: number;
        agent_names: string | null;
        customer_name: string | null;
        customer_id: string | null;
        total_groups: number;
      }[]>`
        SELECT
          i.from_number,
          COUNT(*)::int                                                               AS call_count,
          COUNT(*) FILTER (WHERE i.created_at >= CURRENT_DATE)::int                 AS today_count,
          MAX(i.created_at)                                                           AS last_call_at,
          COUNT(*) FILTER (WHERE i.conversion_status = 'converted')::int             AS converted_count,
          COUNT(*) FILTER (WHERE i.conversion_status != 'converted')::int            AS pending_count,
          string_agg(DISTINCT u.full_name, ', ')                                     AS agent_names,
          (
            SELECT c.name::text FROM customers c
            WHERE c.company_id = ${companyId}
              AND (
                ltrim(regexp_replace(COALESCE(c.phone,           ''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR ltrim(regexp_replace(COALESCE(c.phone_alt,    ''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR ltrim(regexp_replace(COALESCE(c.whatsapp_phone,''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR right(ltrim(regexp_replace(COALESCE(c.phone,  ''), '\D', '', 'g'), '0'), 9)
                  = right(ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0'), 9)
              )
            ORDER BY c.updated_at DESC LIMIT 1
          ) AS customer_name,
          (
            SELECT c.id::text FROM customers c
            WHERE c.company_id = ${companyId}
              AND (
                ltrim(regexp_replace(COALESCE(c.phone,           ''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR ltrim(regexp_replace(COALESCE(c.phone_alt,    ''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR ltrim(regexp_replace(COALESCE(c.whatsapp_phone,''), '\D', '', 'g'), '0')
                  = ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0')
                OR right(ltrim(regexp_replace(COALESCE(c.phone,  ''), '\D', '', 'g'), '0'), 9)
                  = right(ltrim(regexp_replace(COALESCE(i.from_number, ''), '\D', '', 'g'), '0'), 9)
              )
            ORDER BY c.updated_at DESC LIMIT 1
          ) AS customer_id,
          COUNT(*) OVER ()::int                                                       AS total_groups
        FROM call_ai_inquiries i
        LEFT JOIN users u ON u.company_id = i.company_id AND u.mobile = i.to_number AND u.is_active = true
        WHERE i.company_id = ${companyId}
          ${gDateFrom} ${gDateTo} ${gToNumber} ${gSearch} ${gConversion} ${gFromNumber}
        GROUP BY i.from_number
        ORDER BY MAX(i.created_at) DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const totalGroups = groupedRows[0]?.total_groups ?? 0;
      const groupedPages = Math.max(1, Math.ceil(totalGroups / limit));
      return NextResponse.json({
        companyId,
        inquiries: groupedRows,
        totalCount: totalGroups,
        page,
        limit,
        totalPages: groupedPages,
        kpis: kpiRow,
      });
    }

    const rows = await sql<{
      id: string;
      provider_key: string;
      provider_call_id: string;
      from_number: string | null;
      to_number: string | null;
      inquiry_status: string;
      inquiry_summary: string | null;
      conversion_status: string;
      converted_to_lead_id: string | null;
      converted_lead_type: "rsa" | "recovery" | "workshop" | null;
      converted_division: string | null;
      converted_lead_status: string | null;
      converted_lead_stage: string | null;
      lead_outcome: string | null;
      outcome_reason: string | null;
      agent_name: string | null;
      verified_mobile: boolean;
      verified_location: boolean;
      verification_notes: string | null;
      customer_exists: boolean;
      matched_customer_id: string | null;
      matched_customer_name: string | null;
      matched_customer_phone: string | null;
      matched_customer_location: string | null;
      recording_url: string | null;
      recording_duration_seconds: number | null;
      verification_location_text: string | null;
      analysis_analyzed_at: string | null;
      analysis_auto_convert_eligible: boolean;
      analysis_confidence: number | null;
      analysis_lead_type: string | null;
      analysis_request_type: string | null;
      analysis_plate_number: string | null;
      analysis_location: string | null;
      analysis_caller_name: string | null;
      analysis_mobile_number: string | null;
      analysis_summary: string | null;
      analysis_transcript: string | null;
      analysis_conversation_turns: ConversationTurn[] | null;
      analysis_error: string | null;
      analysis_attempted_at: string | null;
      call_direction: "inbound" | "outbound" | null;
      created_at: string;
      updated_at: string;
    }[]>`
      WITH inquiry_rows AS (
        SELECT
          call_ai_inquiries.*,
          ${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)} AS ai_payload_object
        FROM call_ai_inquiries
        WHERE call_ai_inquiries.company_id = ${companyId}
          ${dateFromCond} ${dateToCond} ${toNumberCond} ${searchCond} ${conversionCond} ${fromNumberCond}
      )
      SELECT
        i.id,
        i.provider_key,
        i.provider_call_id,
        i.from_number,
        i.to_number,
        i.inquiry_status,
        i.inquiry_summary,
        i.conversion_status,
        i.converted_to_lead_id,
        l.lead_type AS converted_lead_type,
        l.lead_status AS converted_lead_status,
        l.lead_stage AS converted_lead_stage,
        COALESCE(
          (i.ai_payload_object->'manualLeadType'->>'division')::text,
          l.service_type
        ) AS converted_division,
        i.lead_outcome,
        i.outcome_reason,
        u.full_name AS agent_name,
        COALESCE((i.ai_payload_object->'manualVerification'->>'mobile')::boolean, false) AS verified_mobile,
        COALESCE((i.ai_payload_object->'manualVerification'->>'location')::boolean, false) AS verified_location,
        (i.ai_payload_object->'manualVerification'->>'notes')::text AS verification_notes,
        COALESCE((i.ai_payload_object->'customerMatch'->>'exists')::boolean, false) AS customer_exists,
        (i.ai_payload_object->'customerMatch'->>'customerId')::text AS matched_customer_id,
        (i.ai_payload_object->'customerMatch'->>'customerName')::text AS matched_customer_name,
        (i.ai_payload_object->'customerMatch'->>'customerPhone')::text AS matched_customer_phone,
        NULLIF(
          COALESCE(
            NULLIF((to_jsonb(mc)->>'google_location')::text, ''),
            NULLIF((to_jsonb(mc)->>'address')::text, ''),
            NULLIF((to_jsonb(mc)->>'area')::text, ''),
            NULLIF((to_jsonb(mc)->>'city')::text, '')
          ),
          ''
        )::text AS matched_customer_location,
        rec.url AS recording_url,
        rec.duration_seconds AS recording_duration_seconds,
        COALESCE(
          (i.ai_payload_object->'manualVerification'->>'locationText')::text,
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'location')::text,
          (i.ai_payload_object->>'analysis_location')::text,
          NULLIF(
            COALESCE(
              NULLIF((to_jsonb(mc)->>'google_location')::text, ''),
              NULLIF((to_jsonb(mc)->>'address')::text, ''),
              NULLIF((to_jsonb(mc)->>'area')::text, ''),
              NULLIF((to_jsonb(mc)->>'city')::text, '')
            ),
            ''
          )::text
        ) AS verification_location_text,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'analyzedAt')::text,
          (i.ai_payload_object->>'analysis_analyzed_at')::text
        ) AS analysis_analyzed_at,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'autoConvertEligible')::boolean,
          (i.ai_payload_object->>'analysis_auto_convert_eligible')::boolean,
          false
        ) AS analysis_auto_convert_eligible,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'confidence')::double precision,
          (i.ai_payload_object->>'analysis_confidence')::double precision
        ) AS analysis_confidence,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'lead_type')::text,
          (i.ai_payload_object->>'analysis_lead_type')::text
        ) AS analysis_lead_type,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'request_type')::text,
          (i.ai_payload_object->>'analysis_request_type')::text
        ) AS analysis_request_type,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'plate_number')::text,
          (i.ai_payload_object->>'analysis_plate_number')::text
        ) AS analysis_plate_number,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'location')::text,
          (i.ai_payload_object->>'analysis_location')::text
        ) AS analysis_location,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'caller_name')::text,
          (i.ai_payload_object->>'analysis_caller_name')::text
        ) AS analysis_caller_name,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'mobile_number')::text,
          (i.ai_payload_object->>'analysis_mobile_number')::text
        ) AS analysis_mobile_number,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->'extracted'->>'summary')::text,
          (i.ai_payload_object->>'analysis_summary')::text
        ) AS analysis_summary,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'transcript')::text,
          (i.ai_payload_object->>'analysis_transcript')::text
        ) AS analysis_transcript,
        (i.ai_payload_object->'aiRecordingAnalysis'->'conversationTurns') AS analysis_conversation_turns,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'error')::text,
          (i.ai_payload_object->>'analysis_error')::text
        ) AS analysis_error,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'attemptedAt')::text,
          (i.ai_payload_object->>'analysis_attempted_at')::text
        ) AS analysis_attempted_at,
        sess.direction AS call_direction,
        i.created_at,
        i.updated_at
      FROM inquiry_rows i
      LEFT JOIN users u ON u.company_id = i.company_id AND u.mobile = i.to_number AND u.is_active = true
      LEFT JOIN leads l ON l.company_id = i.company_id AND l.id = i.converted_to_lead_id
      LEFT JOIN customers mc
        ON mc.company_id = i.company_id
       AND mc.id::text = (i.ai_payload_object->'customerMatch'->>'customerId')::text
      LEFT JOIN LATERAL (
        SELECT cr.url, cr.duration_seconds
        FROM call_sessions cs
        JOIN call_recordings cr ON cr.call_session_id = cs.id
        WHERE cs.company_id = i.company_id
          AND cs.provider_call_id = i.provider_call_id
        ORDER BY cr.created_at DESC
        LIMIT 1
      ) rec ON true
      LEFT JOIN LATERAL (
        SELECT direction
        FROM call_sessions
        WHERE company_id = i.company_id
          AND provider_call_id = i.provider_call_id
        ORDER BY created_at DESC
        LIMIT 1
      ) sess ON true
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // postgres.js returns JSONB operator (->) results as raw JSON strings — parse them.
    const parsedRows = rows.map((r) => {
      const raw = (r as any).analysis_conversation_turns;
      let turns: ConversationTurn[] | null = null;
      if (Array.isArray(raw)) {
        turns = raw;
      } else if (typeof raw === "string" && raw.trim().startsWith("[")) {
        try { turns = JSON.parse(raw); } catch { /* ignore */ }
      }
      return { ...r, analysis_conversation_turns: turns };
    });
    const unresolvedRows = parsedRows.filter((r) => !r.customer_exists && r.from_number);
    const meta = { totalCount, page, limit, totalPages, kpis: kpiRow };
    if (!unresolvedRows.length) {
      return NextResponse.json({ companyId, inquiries: parsedRows, ...meta });
    }

    const allCandidates = Array.from(
      new Set(
        unresolvedRows.flatMap((r) => buildPhoneCandidates(r.from_number))
      )
    );
    const allSuffixCandidates = Array.from(
      new Set(
        unresolvedRows.flatMap((r) => buildPhoneSuffixCandidates(r.from_number))
      )
    );
    if (!allCandidates.length) {
      return NextResponse.json({ companyId, inquiries: parsedRows, ...meta });
    }

    const customerRows = await sql<{
      id: string;
      name: string | null;
      phone: string | null;
      phone_alt: string | null;
      whatsapp_phone: string | null;
      address: string | null;
      area: string | null;
      city: string | null;
      google_location: string | null;
    }[]>`
      SELECT
        id,
        name,
        phone,
        phone_alt,
        whatsapp_phone,
        (to_jsonb(customers)->>'address')::text AS address,
        (to_jsonb(customers)->>'area')::text AS area,
        (to_jsonb(customers)->>'city')::text AS city,
        (to_jsonb(customers)->>'google_location')::text AS google_location
      FROM customers
      WHERE company_id = ${companyId}
        AND (
          ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0') = ANY(${allCandidates}::text[])
          OR ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0') = ANY(${allCandidates}::text[])
          OR ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0') = ANY(${allCandidates}::text[])
          OR right(ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${allSuffixCandidates}::text[])
          OR right(ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0'), 9) = ANY(${allSuffixCandidates}::text[])
          OR right(ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${allSuffixCandidates}::text[])
        )
      ORDER BY updated_at DESC
      LIMIT 500
    `;

    const customerByNormalized = new Map<
      string,
      { id: string; name: string | null; phone: string | null; location: string | null }
    >();
    for (const c of customerRows) {
      const normalized = [
        stripLeadingZeros(normalizePhoneDigits(c.phone)),
        stripLeadingZeros(normalizePhoneDigits(c.phone_alt)),
        stripLeadingZeros(normalizePhoneDigits(c.whatsapp_phone)),
      ].filter(Boolean);
      for (const key of normalized) {
        if (!customerByNormalized.has(key)) {
          customerByNormalized.set(key, {
            id: String(c.id),
            name: c.name ? String(c.name) : null,
            phone: c.phone ? String(c.phone) : null,
            location:
              String(c.google_location ?? "").trim() ||
              String(c.address ?? "").trim() ||
              String(c.area ?? "").trim() ||
              String(c.city ?? "").trim() ||
              null,
          });
        }
      }
    }

    const enriched = parsedRows.map((row) => {
      if (row.customer_exists || !row.from_number) return row;
      const directCandidates = buildPhoneCandidates(row.from_number);
      const suffixCandidates = buildPhoneSuffixCandidates(row.from_number);
      const match =
        directCandidates.map((candidate) => customerByNormalized.get(candidate)).find(Boolean) ??
        suffixCandidates
          .map((suffix) => Array.from(customerByNormalized.entries()).find(([key]) => key.endsWith(suffix))?.[1])
          .find(Boolean);
      if (!match) return row;
      return {
        ...row,
        customer_exists: true,
        matched_customer_id: match.id,
        matched_customer_name: match.name,
        matched_customer_phone: match.phone ?? row.from_number,
        matched_customer_location: match.location ?? null,
      };
    });

    return NextResponse.json({ companyId, inquiries: enriched, ...meta });
  } catch (err: any) {
    if (String(err?.code ?? "") === "42P01") {
      return NextResponse.json({
        companyId,
        inquiries: [],
        warning: "call_ai_inquiries table not found. Run migrations.",
      });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load AI inquiries" },
      { status: 500 }
    );
  }
}

export async function runInquiryAnalysis(args: {
  inquiryId: string;
  companyId: string;
  baseUrl: string;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  inquiryId?: string;
  analysisSavedAt?: string;
  transcriptLength?: number;
  extracted?: AnalysisPayload;
  verification?: { mobile: boolean; location: boolean; customerExists: boolean };
  autoConverted?: boolean;
  leadId?: string | null;
}> {
  const { inquiryId, companyId, baseUrl } = args;
  const sql = getSql();

  const rows = await sql<{
    id: string;
    company_id: string;
    provider_call_id: string;
    from_number: string | null;
    to_number: string | null;
    converted_to_lead_id: string | null;
    recording_url: string | null;
  }[]>`
    SELECT
      i.id,
      i.company_id,
      i.provider_call_id,
      i.from_number,
      i.to_number,
      i.converted_to_lead_id,
      rec.url AS recording_url
    FROM call_ai_inquiries i
    LEFT JOIN LATERAL (
      SELECT cr.url
      FROM call_sessions cs
      JOIN call_recordings cr ON cr.call_session_id = cs.id
      WHERE cs.company_id = i.company_id
        AND cs.provider_call_id = i.provider_call_id
      ORDER BY cr.created_at DESC
      LIMIT 1
    ) rec ON true
    WHERE i.company_id = ${companyId} AND i.id = ${inquiryId}
    LIMIT 1
  `;
  const row = rows?.[0];
  if (!row) return { ok: false, error: "Inquiry not found" };

  const saveAnalysisError = async (errorMessage: string) => {
    const failedPatch = {
      aiRecordingAnalysis: { attemptedAt: new Date().toISOString(), error: errorMessage },
      analysis_attempted_at: new Date().toISOString(),
      analysis_error: errorMessage,
    };
    await sql`
      UPDATE call_ai_inquiries
      SET
        ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || ${JSON.stringify(failedPatch)}::jsonb,
        updated_at = now()
      WHERE company_id = ${companyId} AND id = ${inquiryId}
    `;
  };

  if (!isUsableRecordingUrl(row.recording_url)) {
    return { ok: false, skipped: true, error: "Recording not available for this inquiry yet" };
  }

  const { client } = await getOpenAIClientForCompany(companyId);
  if (!client) {
    await saveAnalysisError("AI provider is not configured for this company");
    return { ok: false, error: "AI provider is not configured for this company" };
  }

  try {
    const { buffer, fileName } = await fetchRecordingBufferViaProxy({
      baseUrl,
      companyId,
      recordingUrl: String(row.recording_url),
    });
    const file = new File([buffer], fileName, { type: "audio/wav" });
    const tx = await client.audio.transcriptions.create({
      model: process.env.CALL_AI_TRANSCRIBE_MODEL || "whisper-1",
      file,
    });
    const transcript = String((tx as any)?.text ?? "").trim();
    if (!transcript) {
      await saveAnalysisError("Transcription is empty");
      return { ok: false, error: "Transcription is empty" };
    }

    const extracted = await analyzeTranscriptWithAi({
      companyId,
      transcript,
      fromNumber: row.from_number,
      toNumber: row.to_number,
    });

    const model = process.env.CALL_AI_ANALYSIS_MODEL || "gpt-4o-mini";
    const conversationTurns = await diarizeTranscript(transcript, client, model);
    console.log(`[runInquiryAnalysis] diarization turns: ${conversationTurns ? conversationTurns.length : "null"} for inquiry ${inquiryId}`);

    const mobileCandidates = buildPhoneCandidates(extracted.mobile_number ?? row.from_number ?? null);
    const mobileSuffixCandidates = buildPhoneSuffixCandidates(extracted.mobile_number ?? row.from_number ?? null);
    const matchedCustomers = mobileCandidates.length
      ? await sql<{
          id: string;
          name: string | null;
          phone: string | null;
          phone_alt: string | null;
          whatsapp_phone: string | null;
          google_location: string | null;
          address: string | null;
        }[]>`
          SELECT
            id, name, phone, phone_alt, whatsapp_phone,
            (to_jsonb(customers)->>'google_location')::text AS google_location,
            (to_jsonb(customers)->>'address')::text AS address
          FROM customers
          WHERE company_id = ${companyId}
            AND (
              ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0') = ANY(${mobileCandidates}::text[])
              OR ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0') = ANY(${mobileCandidates}::text[])
              OR ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0') = ANY(${mobileCandidates}::text[])
              OR right(ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${mobileSuffixCandidates}::text[])
              OR right(ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0'), 9) = ANY(${mobileSuffixCandidates}::text[])
              OR right(ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${mobileSuffixCandidates}::text[])
            )
          ORDER BY updated_at DESC
          LIMIT 1
        `
      : [];

    const analysisName = cleanText(extracted.caller_name);
    const analysisLocation = cleanText(extracted.location);
    const preferredMobile = cleanText(extracted.mobile_number) ?? cleanText(row.from_number);
    let matchedCustomer = matchedCustomers?.[0] ?? null;

    if (!matchedCustomer && preferredMobile) {
      const createdCustomer = await Crm.createCustomer({
        companyId,
        customerType: "individual",
        name: analysisName ?? "Customer",
        phone: preferredMobile,
        whatsappPhone: preferredMobile,
        address: analysisLocation,
        notes: `Auto-created from AI inquiry analysis (${inquiryId})`,
      });
      matchedCustomer = {
        id: String(createdCustomer.id),
        name: createdCustomer.name ?? analysisName ?? "Customer",
        phone: createdCustomer.phone ?? preferredMobile,
        phone_alt: createdCustomer.phone_alt ?? null,
        whatsapp_phone: createdCustomer.whatsapp_phone ?? null,
        google_location: (createdCustomer as any).google_location ?? null,
        address: createdCustomer.address ?? analysisLocation,
      };
    }

    if (matchedCustomer) {
      const nameMissing =
        !cleanText(matchedCustomer.name) ||
        String(matchedCustomer.name).trim().toLowerCase() === "customer";
      const phoneMissing =
        !cleanText(matchedCustomer.phone) &&
        !cleanText(matchedCustomer.phone_alt) &&
        !cleanText(matchedCustomer.whatsapp_phone);
      const locationMissing =
        !cleanText(matchedCustomer.google_location) && !cleanText(matchedCustomer.address);
      const patch: Record<string, string> = {};
      if (nameMissing && analysisName) patch.name = analysisName;
      if (phoneMissing && preferredMobile) { patch.phone = preferredMobile; patch.whatsappPhone = preferredMobile; }
      if (locationMissing && analysisLocation) patch.address = analysisLocation;
      if (Object.keys(patch).length > 0) {
        await Crm.updateCustomerRecord(String(matchedCustomer.id), patch as any);
        matchedCustomer = {
          ...matchedCustomer,
          name: patch.name ?? matchedCustomer.name,
          phone: patch.phone ?? matchedCustomer.phone,
          whatsapp_phone: patch.whatsappPhone ?? matchedCustomer.whatsapp_phone,
          address: patch.address ?? matchedCustomer.address,
        };
      }
    }

    const matchedCustomerId = matchedCustomer ? String(matchedCustomer.id) : null;
    const matchedCustomerName = matchedCustomer?.name ? String(matchedCustomer.name) : null;
    const matchedCustomerPhone = matchedCustomer?.phone ? String(matchedCustomer.phone) : preferredMobile;
    const extractedSummary = extracted.summary ? String(extracted.summary) : null;
    const mobileVerified = Boolean(mobileCandidates.length > 0);
    const locationVerified = String(extracted.location ?? "").trim().length >= 3;
    const confidence = Number(extracted.confidence ?? 0);
    const shouldAutoConvert =
      !row.converted_to_lead_id &&
      mobileVerified &&
      locationVerified &&
      confidence >= Number(process.env.CALL_AI_AUTO_CONVERT_CONFIDENCE ?? "0.75");
    const analyzedAtIso = new Date().toISOString();
    const attemptedAtIso = analyzedAtIso;
    const extractedJson = JSON.stringify(extracted);
    const turnsJson = conversationTurns ? JSON.stringify(conversationTurns) : null;

    const updatedRows = await sql<{ id: string }[]>`
      UPDATE call_ai_inquiries
      SET
        inquiry_summary = COALESCE(${extractedSummary}::text, inquiry_summary),
        inquiry_status = ${mobileVerified && locationVerified ? "qualified" : "new"},
        ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || jsonb_build_object(
          'manualVerification',
          jsonb_build_object(
            'mobile', ${mobileVerified},
            'location', ${locationVerified},
            'notes', ${"Verified by AI from recording"}::text,
            'verifiedAt', ${analyzedAtIso}::text
          ),
          'customerMatch',
          jsonb_build_object(
            'exists', ${Boolean(matchedCustomer)},
            'customerId', ${matchedCustomerId}::text,
            'customerName', ${matchedCustomerName}::text,
            'customerPhone', ${matchedCustomerPhone}::text,
            'matchedAt', ${analyzedAtIso}::text
          ),
          'aiRecordingAnalysis',
          jsonb_build_object(
            'transcript', ${transcript}::text,
            'extracted', ${extractedJson}::jsonb,
            'conversationTurns', ${turnsJson}::jsonb,
            'analyzedAt', ${analyzedAtIso}::text,
            'attemptedAt', ${attemptedAtIso}::text,
            'error', ${null}::text,
            'autoConvertEligible', ${shouldAutoConvert}
          ),
          'analysis_analyzed_at', ${analyzedAtIso}::text,
          'analysis_attempted_at', ${attemptedAtIso}::text,
          'analysis_error', ${null}::text,
          'analysis_auto_convert_eligible', ${shouldAutoConvert},
          'analysis_confidence', ${extracted.confidence ?? null}::double precision,
          'analysis_lead_type', ${extracted.lead_type ?? null}::text,
          'analysis_request_type', ${extracted.request_type ?? null}::text,
          'analysis_plate_number', ${extracted.plate_number ?? null}::text,
          'analysis_location', ${extracted.location ?? null}::text,
          'analysis_caller_name', ${extracted.caller_name ?? null}::text,
          'analysis_mobile_number', ${extracted.mobile_number ?? null}::text,
          'analysis_summary', ${extracted.summary ?? null}::text,
          'analysis_transcript', ${transcript}::text
        ),
        updated_at = now()
      WHERE company_id = ${companyId} AND id = ${inquiryId}
      RETURNING id
    `;
    if (!updatedRows?.[0]?.id) throw new Error("Failed to persist analysis payload");

    let leadId: string | null = row.converted_to_lead_id ? String(row.converted_to_lead_id) : null;
    if (shouldAutoConvert) {
      const converted = await CallAiWorkflow.convertInquiryToLead({
        inquiryId,
        source: "ai_recording_analysis",
        leadType: toLeadType(extracted.lead_type),
        leadStage: "pending_type_selection",
      });
      leadId = converted.leadId;
    }
    if (leadId) {
      await Leads.updateLeadPartial(companyId, leadId, { leadType: toLeadType(extracted.lead_type) });
    }

    return {
      ok: true,
      inquiryId,
      analysisSavedAt: analyzedAtIso,
      transcriptLength: transcript.length,
      extracted,
      verification: { mobile: mobileVerified, location: locationVerified, customerExists: Boolean(matchedCustomer) },
      autoConverted: Boolean(shouldAutoConvert),
      leadId,
    };
  } catch (err: any) {
    const message = String(err?.message ?? "Analyze recording failed");
    await saveAnalysisError(message);
    return { ok: false, error: message };
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim().toLowerCase();
  const inquiryId = String(body?.inquiryId ?? "").trim();

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  // batch_analyze does not require an inquiryId — handle before the inquiryId guard
  if (action === "batch_analyze") {
    const batchLimit = Math.min(Math.max(Number(body?.limit ?? 5), 1), 20);
    const sql = getSql();
    const startedAt = new Date().toISOString();

    // Find all unanalyzed inquiries for this company.
    // runInquiryAnalysis handles "no recording yet" gracefully (returns skipped:true),
    // so we don't need to pre-filter by recording here — doing so via JOIN would
    // silently drop inquiries whose session company_id doesn't match exactly.
    const pending = await sql<{ id: string }[]>`
      SELECT id
      FROM call_ai_inquiries
      WHERE company_id = ${companyId}
        AND (
          ai_payload IS NULL
          OR (jsonb_typeof(ai_payload) = 'object'
              AND (ai_payload->'aiRecordingAnalysis'->>'analyzedAt') IS NULL)
          OR (jsonb_typeof(ai_payload) = 'array'
              AND (ai_payload->-1->'aiRecordingAnalysis'->>'analyzedAt') IS NULL)
        )
      ORDER BY created_at ASC
      LIMIT ${batchLimit}
    `.catch(() => []);

    const pendingRows = (pending as any).rows ?? pending;
    const logs: { id: string; ok: boolean; skipped?: boolean; error?: string; ms: number }[] = [];

    for (const row of pendingRows) {
      const t0 = Date.now();
      const result = await runInquiryAnalysis({
        inquiryId: row.id,
        companyId,
        baseUrl: req.nextUrl.origin,
      });
      logs.push({ id: row.id, ok: result.ok, skipped: result.skipped, error: result.error, ms: Date.now() - t0 });
    }

    return NextResponse.json({
      action: "batch_analyze",
      startedAt,
      finishedAt: new Date().toISOString(),
      processed: logs.length,
      succeeded: logs.filter(l => l.ok).length,
      skipped: logs.filter(l => l.skipped).length,
      failed: logs.filter(l => !l.ok && !l.skipped).length,
      logs,
    });
  }

  if (!inquiryId) {
    return NextResponse.json({ error: "inquiryId is required" }, { status: 400 });
  }

  const sql = getSql();

  try {
    const inquiryCtxRows = await sql<{
      id: string;
      converted_to_lead_id: string | null;
      lead_status: string | null;
      lead_stage: string | null;
    }[]>`
      SELECT i.id, i.converted_to_lead_id, l.lead_status, l.lead_stage
      FROM call_ai_inquiries i
      LEFT JOIN leads l
        ON l.company_id = i.company_id
       AND l.id = i.converted_to_lead_id
      WHERE i.company_id = ${companyId}
        AND i.id = ${inquiryId}
      LIMIT 1
    `;
    const inquiryCtx = inquiryCtxRows?.[0];
    if (!inquiryCtx) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    if (
      inquiryCtx.converted_to_lead_id &&
      isLeadFinalized(inquiryCtx.lead_status, inquiryCtx.lead_stage)
    ) {
      return NextResponse.json(
        { error: "Converted lead is closed. Inquiry actions are disabled." },
        { status: 400 }
      );
    }

    if (action === "analyze_recording") {
      const result = await runInquiryAnalysis({
        inquiryId,
        companyId,
        baseUrl: req.nextUrl.origin,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.skipped ? 400 : 500 });
      }
      return NextResponse.json({ action: "analyze_recording", ...result });
    }

    if (action === "verify") {
      const verifiedMobile = Boolean(body?.verifiedMobile);
      const verificationLocationRaw = String(body?.verificationLocation ?? "").trim();
      const notes = String(body?.verificationNotes ?? "").trim();
      const inquiryRows = await sql<{ ai_payload_object: any }[]>`
        SELECT ${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)} AS ai_payload_object
        FROM call_ai_inquiries
        WHERE company_id = ${companyId} AND id = ${inquiryId}
        LIMIT 1
      `;
      if (!inquiryRows?.[0]) {
        return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
      }
      const matchedCustomerId = String(
        inquiryRows[0]?.ai_payload_object?.customerMatch?.customerId ??
          inquiryRows[0]?.ai_payload_object?.customerMatch?.id ??
          ""
      ).trim();
      let inferredLocation = "";
      if (matchedCustomerId) {
        const customerRows = await sql<{
          google_location: string | null;
          address: string | null;
          area: string | null;
          city: string | null;
        }[]>`
          SELECT
            (to_jsonb(customers)->>'google_location')::text AS google_location,
            (to_jsonb(customers)->>'address')::text AS address,
            (to_jsonb(customers)->>'area')::text AS area,
            (to_jsonb(customers)->>'city')::text AS city
          FROM customers
          WHERE company_id = ${companyId} AND id = ${matchedCustomerId}
          LIMIT 1
        `;
        const c = customerRows?.[0];
        inferredLocation =
          String(c?.google_location ?? "").trim() ||
          String(c?.address ?? "").trim() ||
          String(c?.area ?? "").trim() ||
          String(c?.city ?? "").trim() ||
          "";
      }
      const verificationLocation = verificationLocationRaw || inferredLocation;
      const verifiedLocation =
        (body?.verifiedLocation === undefined ? true : Boolean(body?.verifiedLocation)) &&
        verificationLocation.length >= 3;
      const nextInquiryStatus = verifiedMobile && verifiedLocation ? "qualified" : "new";

      const rows = await sql<any[]>`
        UPDATE call_ai_inquiries
        SET
          inquiry_status = ${nextInquiryStatus},
          ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || jsonb_build_object(
            'manualVerification',
            jsonb_build_object(
              'mobile', ${verifiedMobile}::boolean,
              'location', ${verifiedLocation}::boolean,
              'locationText', ${verificationLocation || null}::text,
              'notes', ${notes || null}::text,
              'verifiedAt', ${new Date().toISOString()}::text
            )
          ),
          updated_at = now()
        WHERE company_id = ${companyId} AND id = ${inquiryId}
        RETURNING id, inquiry_status, ai_payload, updated_at
      `;

      if (!rows?.[0]) {
        return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
      }

      return NextResponse.json({
        ok: true,
        action: "verify",
        inquiryId,
        inquiryStatus: rows[0].inquiry_status,
        verification: rows[0].ai_payload?.manualVerification ?? null,
      });
    }

    if (action === "convert_to_lead") {
      const converted = await CallAiWorkflow.convertInquiryToLead({
        inquiryId,
        source: "manual_inquiry_conversion",
        leadType: "rsa",
        leadStage: "pending_type_selection",
      });
      return NextResponse.json({
        ok: true,
        action: "convert_to_lead",
        inquiryId,
        leadId: converted.leadId,
        inquiryStatus: converted.inquiry.inquiryStatus,
        conversionStatus: converted.inquiry.conversionStatus,
      });
    }

    if (action === "set_lead_type") {
      const leadTypeRaw = String(body?.leadType ?? "").trim().toLowerCase();
      if (!["rsa", "recovery", "workshop"].includes(leadTypeRaw)) {
        return NextResponse.json({ error: "leadType must be one of rsa|recovery|workshop" }, { status: 400 });
      }
      const divisionRaw = String(body?.division ?? "").trim().toLowerCase();
      const validDivisions =
        leadTypeRaw === "rsa"
          ? RSA_DIVISIONS
          : leadTypeRaw === "recovery"
            ? RECOVERY_DIVISIONS
            : ([] as readonly string[]);
      if (validDivisions.length > 0 && !divisionRaw) {
        return NextResponse.json({ error: "Division is required for selected lead type" }, { status: 400 });
      }
      if (divisionRaw && validDivisions.length > 0 && !validDivisions.includes(divisionRaw as any)) {
        return NextResponse.json({ error: "Invalid division for selected lead type" }, { status: 400 });
      }
      const division = validDivisions.length > 0 ? (divisionRaw || null) : null;

      const inquiryRows = await sql<{ converted_to_lead_id: string | null }[]>`
        SELECT converted_to_lead_id
        FROM call_ai_inquiries
        WHERE company_id = ${companyId} AND id = ${inquiryId}
        LIMIT 1
      `;
      const leadId = inquiryRows?.[0]?.converted_to_lead_id ? String(inquiryRows[0].converted_to_lead_id) : null;
      if (!leadId) {
        return NextResponse.json({ error: "Inquiry is not converted yet" }, { status: 400 });
      }

      await Leads.updateLeadPartial(companyId, leadId, {
        leadType: leadTypeRaw as "rsa" | "recovery" | "workshop",
        serviceType: division,
        leadStage: "new",
      });

      await sql`
        UPDATE call_ai_inquiries
        SET
          ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || jsonb_build_object(
            'manualLeadType',
            jsonb_build_object(
              'value', ${leadTypeRaw}::text,
              'division', ${division}::text,
              'updatedAt', ${new Date().toISOString()}::text
            )
          ),
          updated_at = now()
        WHERE company_id = ${companyId} AND id = ${inquiryId}
      `;

      return NextResponse.json({
        ok: true,
        action: "set_lead_type",
        inquiryId,
        leadId,
        leadType: leadTypeRaw,
        division,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process inquiry action" },
      { status: 500 }
    );
  }
}
