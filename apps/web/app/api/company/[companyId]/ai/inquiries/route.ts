import { NextRequest, NextResponse } from "next/server";
import { getSql, CallAiWorkflow, Leads, Crm, getOpenAIClientForCompany } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type Params = { params: Promise<{ companyId: string }> };
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  req: NextRequest;
  companyId: string;
  recordingUrl: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const path = `/api/company/${args.companyId}/call-center/history/recording-proxy`;
  const hostHeader = String(args.req.headers.get("host") ?? "").trim();
  const port =
    hostHeader.includes(":") && hostHeader.split(":")[1]
      ? hostHeader.split(":")[1]
      : "3000";
  const candidates = [
    new URL(path, args.req.nextUrl.origin),
    new URL(`${path}`, `http://127.0.0.1:${port}`),
    new URL(`${path}`, `http://localhost:${port}`),
  ];

  let lastError: string | null = null;
  for (const proxyUrl of candidates) {
    proxyUrl.searchParams.set("recordingUrl", args.recordingUrl);
    try {
      const res = await fetch(proxyUrl.toString(), {
        headers: {
          cookie: args.req.headers.get("cookie") ?? "",
          authorization: args.req.headers.get("authorization") ?? "",
        },
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

/**
 * Standalone server-side analysis function — used by the internal auto-analyze endpoint
 * and the webhook post-call trigger.  Does NOT require an HTTP request context.
 */
export async function runInquiryAnalysis(args: {
  inquiryId: string;
  companyId: string;
  baseUrl: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const { inquiryId, companyId, baseUrl } = args;
  const sql = getSql();

  try {
    const rows = await sql<{
      id: string;
      company_id: string;
      provider_call_id: string;
      from_number: string | null;
      to_number: string | null;
      converted_to_lead_id: string | null;
      recording_url: string | null;
      already_analyzed: boolean;
    }[]>`
      SELECT
        i.id,
        i.company_id,
        i.provider_call_id,
        i.from_number,
        i.to_number,
        i.converted_to_lead_id,
        rec.url AS recording_url,
        COALESCE(
          (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)})->'aiRecordingAnalysis'->>'analyzedAt' IS NOT NULL,
          false
        ) AS already_analyzed
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
    if (row.already_analyzed) return { ok: true, skipped: true };
    if (!isUsableRecordingUrl(row.recording_url)) return { ok: false, skipped: true, error: "No recording" };

    const { client } = await getOpenAIClientForCompany(companyId);
    if (!client) return { ok: false, error: "AI provider not configured" };

    // Fetch recording via internal proxy
    const proxyUrl = `${baseUrl}/api/company/${companyId}/call-center/history/recording-proxy?recordingUrl=${encodeURIComponent(String(row.recording_url))}`;
    const recRes = await fetch(proxyUrl, { cache: "no-store" });
    if (!recRes.ok) return { ok: false, error: `Recording fetch failed: ${recRes.status}` };
    const recBuffer = Buffer.from(await recRes.arrayBuffer());
    const fileName = `recording_${row.provider_call_id}.wav`;

    const file = new File([recBuffer], fileName, { type: "audio/wav" });
    const tx = await client.audio.transcriptions.create({
      model: process.env.CALL_AI_TRANSCRIBE_MODEL || "whisper-1",
      file,
    });
    const transcript = String((tx as any)?.text ?? "").trim();
    if (!transcript) return { ok: false, skipped: true, error: "Empty transcript" };

    const extracted = await analyzeTranscriptWithAi({
      companyId,
      transcript,
      fromNumber: row.from_number,
      toNumber: row.to_number,
    });

    const mobileCandidates = buildPhoneCandidates(extracted.mobile_number ?? row.from_number ?? null);
    const mobileSuffixCandidates = buildPhoneSuffixCandidates(extracted.mobile_number ?? row.from_number ?? null);
    const matchedCustomers = mobileCandidates.length
      ? await sql<{ id: string; name: string | null; phone: string | null; phone_alt: string | null; whatsapp_phone: string | null; google_location: string | null; address: string | null }[]>`
          SELECT id, name, phone, phone_alt, whatsapp_phone,
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
          ORDER BY updated_at DESC LIMIT 1
        `
      : [];

    const analysisName = cleanText(extracted.caller_name);
    const analysisLocation = cleanText(extracted.location);
    const preferredMobile = cleanText(extracted.mobile_number) ?? cleanText(row.from_number);
    let matchedCustomer = matchedCustomers?.[0] ?? null;

    if (!matchedCustomer && preferredMobile) {
      const created = await Crm.createCustomer({
        companyId,
        customerType: "individual",
        name: analysisName ?? "Customer",
        phone: preferredMobile,
        whatsappPhone: preferredMobile,
        address: analysisLocation,
        notes: `Auto-created from AI auto-analysis (${inquiryId})`,
      });
      matchedCustomer = {
        id: String(created.id), name: created.name ?? analysisName ?? "Customer",
        phone: created.phone ?? preferredMobile, phone_alt: created.phone_alt ?? null,
        whatsapp_phone: created.whatsapp_phone ?? null,
        google_location: (created as any).google_location ?? null, address: created.address ?? analysisLocation,
      };
    }

    if (matchedCustomer) {
      const nameMissing = !cleanText(matchedCustomer.name) || String(matchedCustomer.name).trim().toLowerCase() === "customer";
      const phoneMissing = !cleanText(matchedCustomer.phone) && !cleanText(matchedCustomer.phone_alt) && !cleanText(matchedCustomer.whatsapp_phone);
      const locationMissing = !cleanText(matchedCustomer.google_location) && !cleanText(matchedCustomer.address);
      const patch: Record<string, string> = {};
      if (nameMissing && analysisName) patch.name = analysisName;
      if (phoneMissing && preferredMobile) { patch.phone = preferredMobile; patch.whatsappPhone = preferredMobile; }
      if (locationMissing && analysisLocation) patch.address = analysisLocation;
      if (Object.keys(patch).length > 0) await Crm.updateCustomerRecord(String(matchedCustomer.id), patch as any);
    }

    const matchedCustomerId = matchedCustomer ? String(matchedCustomer.id) : null;
    const matchedCustomerName = matchedCustomer?.name ? String(matchedCustomer.name) : null;
    const matchedCustomerPhone = matchedCustomer?.phone ? String(matchedCustomer.phone) : preferredMobile;
    const mobileVerified = Boolean(mobileCandidates.length > 0);
    const locationVerified = String(extracted.location ?? "").trim().length >= 3;
    const confidence = Number(extracted.confidence ?? 0);
    const shouldAutoConvert =
      !row.converted_to_lead_id && mobileVerified && locationVerified &&
      confidence >= Number(process.env.CALL_AI_AUTO_CONVERT_CONFIDENCE ?? "0.75");
    const analyzedAtIso = new Date().toISOString();
    const extractedJson = JSON.stringify(extracted);

    await sql`
      UPDATE call_ai_inquiries
      SET
        inquiry_summary = COALESCE(${extracted.summary ?? null}::text, inquiry_summary),
        inquiry_status = ${mobileVerified && locationVerified ? "qualified" : "new"},
        ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || jsonb_build_object(
          'manualVerification', jsonb_build_object(
            'mobile', ${mobileVerified}, 'location', ${locationVerified},
            'notes', ${"Verified by AI from recording"}::text, 'verifiedAt', ${analyzedAtIso}::text
          ),
          'customerMatch', jsonb_build_object(
            'exists', ${Boolean(matchedCustomer)}, 'customerId', ${matchedCustomerId}::text,
            'customerName', ${matchedCustomerName}::text, 'customerPhone', ${matchedCustomerPhone}::text,
            'matchedAt', ${analyzedAtIso}::text
          ),
          'aiRecordingAnalysis', jsonb_build_object(
            'transcript', ${transcript}::text, 'extracted', ${extractedJson}::jsonb,
            'analyzedAt', ${analyzedAtIso}::text, 'attemptedAt', ${analyzedAtIso}::text,
            'error', ${null}::text, 'autoConvertEligible', ${shouldAutoConvert}
          ),
          'analysis_analyzed_at', ${analyzedAtIso}::text,
          'analysis_attempted_at', ${analyzedAtIso}::text,
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
    `;

    if (shouldAutoConvert) {
      const converted = await CallAiWorkflow.convertInquiryToLead({
        inquiryId,
        source: "ai_recording_analysis",
        leadType: toLeadType(extracted.lead_type),
        leadStage: "pending_type_selection",
      });
      if (converted.leadId) {
        await Leads.updateLeadPartial(companyId, converted.leadId, { leadType: toLeadType(extracted.lead_type) });
      }
    }

    return { ok: true };
  } catch (err: any) {
    const msg = String(err?.message ?? "Analysis failed");
    // Persist error so we don't retry this inquiry endlessly
    try {
      const sql2 = getSql();
      const failedPatch = { aiRecordingAnalysis: { attemptedAt: new Date().toISOString(), error: msg }, analysis_attempted_at: new Date().toISOString(), analysis_error: msg };
      await sql2`
        UPDATE call_ai_inquiries
        SET ai_payload = (${sql2.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || ${JSON.stringify(failedPatch)}::jsonb, updated_at = now()
        WHERE company_id = ${companyId} AND id = ${inquiryId}
      `;
    } catch { /* best effort */ }
    return { ok: false, error: msg };
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const sql = getSql();
  const url = new URL(req.url);
  const isGrouped = url.searchParams.get("grouped") === "true";
  const pageNum = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageLimit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const searchFilter = (url.searchParams.get("search") ?? "").trim();
  const toNumberFilter = (url.searchParams.get("toNumber") ?? "").trim();
  const conversionFilter = (url.searchParams.get("conversionStatus") ?? "").trim();
  const fromNumberFilter = (url.searchParams.get("fromNumber") ?? "").trim();

  // Default to last 30 days if no date filters provided — avoids full table scan
  const rawDateFrom = (url.searchParams.get("dateFrom") ?? "").trim();
  const rawDateTo = (url.searchParams.get("dateTo") ?? "").trim();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const dateFromFilter = rawDateFrom || defaultFrom.toISOString();
  const dateToFilter = rawDateTo;

  try {
    if (isGrouped) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const conditions: string[] = [];
      if (dateFromFilter) conditions.push(`i.created_at >= '${dateFromFilter.replace(/'/g, "''")}'::timestamptz`);
      if (dateToFilter) conditions.push(`i.created_at <= '${dateToFilter.replace(/'/g, "''")}'::timestamptz`);
      if (searchFilter) {
        const escaped = searchFilter.replace(/'/g, "''").replace(/%/g, "\\%");
        conditions.push(`(i.from_number ILIKE '%${escaped}%' OR i.to_number ILIKE '%${escaped}%' OR i.provider_call_id ILIKE '%${escaped}%')`);
      }
      if (toNumberFilter) conditions.push(`i.to_number = '${toNumberFilter.replace(/'/g, "''")}'`);
      if (conversionFilter) conditions.push(`i.conversion_status = '${conversionFilter.replace(/'/g, "''")}'`);
      if (fromNumberFilter) conditions.push(`i.from_number = '${fromNumberFilter.replace(/'/g, "''")}'`);
      const extraWhere = conditions.length ? `AND ${conditions.join(" AND ")}` : "";

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
        _total: number;
      }[]>`
        SELECT
          i.from_number,
          COUNT(*)::int AS call_count,
          COUNT(*) FILTER (WHERE i.created_at >= ${todayStart.toISOString()}::timestamptz)::int AS today_count,
          MAX(i.created_at)::text AS last_call_at,
          COUNT(*) FILTER (WHERE i.conversion_status = 'converted')::int AS converted_count,
          COUNT(*) FILTER (WHERE i.conversion_status = 'not_converted' AND i.inquiry_status = 'new')::int AS pending_count,
          STRING_AGG(DISTINCT i.to_number, ', ') FILTER (WHERE i.to_number IS NOT NULL) AS agent_names,
          MAX((i.ai_payload->'customerMatch'->>'customerName')::text) AS customer_name,
          MAX((i.ai_payload->'customerMatch'->>'customerId')::text) AS customer_id,
          COUNT(*) OVER()::int AS _total
        FROM call_ai_inquiries i
        WHERE i.company_id = ${companyId}
          ${sql.unsafe(extraWhere)}
        GROUP BY i.from_number
        ORDER BY MAX(i.created_at) DESC
        LIMIT ${pageLimit}
        OFFSET ${(pageNum - 1) * pageLimit}
      `;

      const totalCount = groupedRows[0]?._total ?? 0;

      return NextResponse.json({
        companyId,
        inquiries: groupedRows,
        totalCount,
        totalPages: Math.ceil(totalCount / pageLimit),
      });
    }

    // Build WHERE conditions for ungrouped query (pushed into CTE for performance)
    const ungroupedConditions: string[] = [];
    if (dateFromFilter) ungroupedConditions.push(`call_ai_inquiries.created_at >= '${dateFromFilter.replace(/'/g, "''")}'::timestamptz`);
    if (dateToFilter) ungroupedConditions.push(`call_ai_inquiries.created_at <= '${dateToFilter.replace(/'/g, "''")}'::timestamptz`);
    if (searchFilter) {
      const escaped = searchFilter.replace(/'/g, "''").replace(/%/g, "\\%");
      ungroupedConditions.push(`(call_ai_inquiries.from_number ILIKE '%${escaped}%' OR call_ai_inquiries.to_number ILIKE '%${escaped}%' OR call_ai_inquiries.provider_call_id ILIKE '%${escaped}%')`);
    }
    if (toNumberFilter) ungroupedConditions.push(`call_ai_inquiries.to_number = '${toNumberFilter.replace(/'/g, "''")}'`);
    if (conversionFilter) ungroupedConditions.push(`call_ai_inquiries.conversion_status = '${conversionFilter.replace(/'/g, "''")}'`);
    if (fromNumberFilter) ungroupedConditions.push(`call_ai_inquiries.from_number = '${fromNumberFilter.replace(/'/g, "''")}'`);
    const ungroupedExtraWhere = ungroupedConditions.length ? `AND ${ungroupedConditions.join(" AND ")}` : "";

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
      analysis_error: string | null;
      analysis_attempted_at: string | null;
      created_at: string;
      updated_at: string;
    }[]>`
      WITH inquiry_rows AS (
        SELECT
          call_ai_inquiries.*,
          ${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)} AS ai_payload_object
        FROM call_ai_inquiries
        WHERE call_ai_inquiries.company_id = ${companyId}
          ${sql.unsafe(ungroupedExtraWhere)}
        ORDER BY call_ai_inquiries.created_at DESC
        LIMIT ${pageLimit}
        OFFSET ${(pageNum - 1) * pageLimit}
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
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'error')::text,
          (i.ai_payload_object->>'analysis_error')::text
        ) AS analysis_error,
        COALESCE(
          (i.ai_payload_object->'aiRecordingAnalysis'->>'attemptedAt')::text,
          (i.ai_payload_object->>'analysis_attempted_at')::text
        ) AS analysis_attempted_at,
        i.created_at,
        i.updated_at
      FROM inquiry_rows i
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
      ORDER BY i.created_at DESC
    `;

    // Get total count for pagination (separate lightweight query)
    const countResult = await sql<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM call_ai_inquiries
      WHERE company_id = ${companyId}
        ${sql.unsafe(ungroupedExtraWhere)}
    `;
    const ungroupedTotal = countResult[0]?.total ?? 0;

    const unresolvedRows = rows.filter((r) => !r.customer_exists && r.from_number);
    if (!unresolvedRows.length) {
      return NextResponse.json({
        companyId,
        inquiries: rows,
        totalCount: ungroupedTotal,
        totalPages: Math.ceil(ungroupedTotal / pageLimit),
      });
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
      return NextResponse.json({ companyId, inquiries: rows });
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

    const enriched = rows.map((row) => {
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

    return NextResponse.json({
      companyId,
      inquiries: enriched,
      totalCount: ungroupedTotal,
      totalPages: Math.ceil(ungroupedTotal / pageLimit),
    });
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

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

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

  const sql = getSql();

  // --- batch_analyze: process multiple unanalyzed inquiries ---
  if (action === "batch_analyze") {
    const batchLimit = Math.min(20, Math.max(1, parseInt(String(body?.limit ?? "10"), 10) || 10));

    try {
      // Find inquiries that have no analysis yet and have a recording available
      const candidates = await sql<{
        id: string;
        provider_call_id: string;
        from_number: string | null;
        to_number: string | null;
        converted_to_lead_id: string | null;
        recording_url: string | null;
      }[]>`
        SELECT
          i.id,
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
        WHERE i.company_id = ${companyId}
          AND (
            (i.ai_payload IS NULL)
            OR (i.ai_payload = '{}'::jsonb)
            OR (i.ai_payload = '[]'::jsonb)
            OR (
              (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)})->>'analysis_analyzed_at' IS NULL
              AND (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)})->'aiRecordingAnalysis'->>'analyzedAt' IS NULL
            )
          )
          AND (
            (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)})->>'analysis_error' IS NULL
            AND (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)})->'aiRecordingAnalysis'->>'error' IS NULL
          )
        ORDER BY i.created_at DESC
        LIMIT ${batchLimit}
      `;

      if (!candidates.length) {
        return NextResponse.json({ ok: true, processed: 0, succeeded: 0, skipped: 0, failed: 0, logs: [] });
      }

      const { client } = await getOpenAIClientForCompany(companyId);
      if (!client) {
        return NextResponse.json({ error: "AI provider is not configured for this company" }, { status: 400 });
      }

      const logs: { id: string; ok: boolean; error?: string; ms: number }[] = [];
      let succeeded = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of candidates) {
        const start = Date.now();
        try {
          if (!isUsableRecordingUrl(candidate.recording_url)) {
            skipped++;
            logs.push({ id: candidate.id, ok: false, error: "No recording", ms: Date.now() - start });
            continue;
          }

          const { buffer, fileName } = await fetchRecordingBufferViaProxy({
            req,
            companyId,
            recordingUrl: String(candidate.recording_url),
          });
          const file = new File([buffer], fileName, { type: "audio/wav" });
          const tx = await client.audio.transcriptions.create({
            model: process.env.CALL_AI_TRANSCRIBE_MODEL || "whisper-1",
            file,
          });
          const transcript = String((tx as any)?.text ?? "").trim();
          if (!transcript) {
            skipped++;
            logs.push({ id: candidate.id, ok: false, error: "Empty transcript", ms: Date.now() - start });
            continue;
          }

          const extracted = await analyzeTranscriptWithAi({
            companyId,
            transcript,
            fromNumber: candidate.from_number,
            toNumber: candidate.to_number,
          });

          const mobileCandidates = buildPhoneCandidates(extracted.mobile_number ?? candidate.from_number ?? null);
          const mobileSuffixCandidates = buildPhoneSuffixCandidates(extracted.mobile_number ?? candidate.from_number ?? null);
          const matchedCustomers = mobileCandidates.length
            ? await sql<{ id: string; name: string | null; phone: string | null; phone_alt: string | null; whatsapp_phone: string | null; google_location: string | null; address: string | null }[]>`
                SELECT id, name, phone, phone_alt, whatsapp_phone,
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
                ORDER BY updated_at DESC LIMIT 1
              `
            : [];

          const analysisName = cleanText(extracted.caller_name);
          const analysisLocation = cleanText(extracted.location);
          const preferredMobile = cleanText(extracted.mobile_number) ?? cleanText(candidate.from_number);
          let matchedCustomer = matchedCustomers?.[0] ?? null;

          if (!matchedCustomer && preferredMobile) {
            const createdCustomer = await Crm.createCustomer({
              companyId,
              customerType: "individual",
              name: analysisName ?? "Customer",
              phone: preferredMobile,
              whatsappPhone: preferredMobile,
              address: analysisLocation,
              notes: `Auto-created from AI batch analysis (${candidate.id})`,
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
            const nameMissing = !cleanText(matchedCustomer.name) || String(matchedCustomer.name).trim().toLowerCase() === "customer";
            const phoneMissing = !cleanText(matchedCustomer.phone) && !cleanText(matchedCustomer.phone_alt) && !cleanText(matchedCustomer.whatsapp_phone);
            const locationMissing = !cleanText(matchedCustomer.google_location) && !cleanText(matchedCustomer.address);
            const patch: Record<string, string> = {};
            if (nameMissing && analysisName) patch.name = analysisName;
            if (phoneMissing && preferredMobile) { patch.phone = preferredMobile; patch.whatsappPhone = preferredMobile; }
            if (locationMissing && analysisLocation) patch.address = analysisLocation;
            if (Object.keys(patch).length > 0) {
              await Crm.updateCustomerRecord(String(matchedCustomer.id), patch as any);
            }
          }

          const matchedCustomerId = matchedCustomer ? String(matchedCustomer.id) : null;
          const matchedCustomerName = matchedCustomer?.name ? String(matchedCustomer.name) : null;
          const matchedCustomerPhone = matchedCustomer?.phone ? String(matchedCustomer.phone) : preferredMobile;
          const mobileVerified = Boolean(mobileCandidates.length > 0);
          const locationVerified = String(extracted.location ?? "").trim().length >= 3;
          const confidence = Number(extracted.confidence ?? 0);
          const shouldAutoConvert =
            !candidate.converted_to_lead_id &&
            mobileVerified &&
            locationVerified &&
            confidence >= Number(process.env.CALL_AI_AUTO_CONVERT_CONFIDENCE ?? "0.75");
          const analyzedAtIso = new Date().toISOString();
          const extractedJson = JSON.stringify(extracted);

          await sql`
            UPDATE call_ai_inquiries
            SET
              inquiry_summary = COALESCE(${extracted.summary ?? null}::text, inquiry_summary),
              inquiry_status = ${mobileVerified && locationVerified ? "qualified" : "new"},
              ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || jsonb_build_object(
                'manualVerification', jsonb_build_object(
                  'mobile', ${mobileVerified}, 'location', ${locationVerified},
                  'notes', ${"Verified by AI from recording"}::text, 'verifiedAt', ${analyzedAtIso}::text
                ),
                'customerMatch', jsonb_build_object(
                  'exists', ${Boolean(matchedCustomer)}, 'customerId', ${matchedCustomerId}::text,
                  'customerName', ${matchedCustomerName}::text, 'customerPhone', ${matchedCustomerPhone}::text,
                  'matchedAt', ${analyzedAtIso}::text
                ),
                'aiRecordingAnalysis', jsonb_build_object(
                  'transcript', ${transcript}::text, 'extracted', ${extractedJson}::jsonb,
                  'analyzedAt', ${analyzedAtIso}::text, 'attemptedAt', ${analyzedAtIso}::text,
                  'error', ${null}::text, 'autoConvertEligible', ${shouldAutoConvert}
                ),
                'analysis_analyzed_at', ${analyzedAtIso}::text,
                'analysis_attempted_at', ${analyzedAtIso}::text,
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
            WHERE company_id = ${companyId} AND id = ${candidate.id}
          `;

          if (shouldAutoConvert) {
            const converted = await CallAiWorkflow.convertInquiryToLead({
              inquiryId: candidate.id,
              source: "ai_recording_analysis",
              leadType: toLeadType(extracted.lead_type),
              leadStage: "pending_type_selection",
            });
            if (converted.leadId) {
              await Leads.updateLeadPartial(companyId, converted.leadId, {
                leadType: toLeadType(extracted.lead_type),
              });
            }
          }

          succeeded++;
          logs.push({ id: candidate.id, ok: true, ms: Date.now() - start });
        } catch (err: any) {
          failed++;
          const errMsg = String(err?.message ?? "Unknown error");
          logs.push({ id: candidate.id, ok: false, error: errMsg, ms: Date.now() - start });
          // Save error on the inquiry so it's not retried immediately
          try {
            const failedPatch = {
              aiRecordingAnalysis: { attemptedAt: new Date().toISOString(), error: errMsg },
              analysis_attempted_at: new Date().toISOString(),
              analysis_error: errMsg,
            };
            await sql`
              UPDATE call_ai_inquiries
              SET ai_payload = (${sql.unsafe(AI_PAYLOAD_OBJECT_SQL)}) || ${JSON.stringify(failedPatch)}::jsonb,
                  updated_at = now()
              WHERE company_id = ${companyId} AND id = ${candidate.id}
            `;
          } catch { /* best effort */ }
        }
      }

      return NextResponse.json({
        ok: true,
        processed: candidates.length,
        succeeded,
        skipped,
        failed,
        logs,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Batch analyze failed" }, { status: 500 });
    }
  }

  if (!inquiryId) {
    return NextResponse.json({ error: "inquiryId is required" }, { status: 400 });
  }

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
      if (!row) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
      const saveAnalysisError = async (errorMessage: string) => {
        const failedPatch = {
          aiRecordingAnalysis: {
            attemptedAt: new Date().toISOString(),
            error: errorMessage,
          },
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

      try {
        if (!isUsableRecordingUrl(row.recording_url)) {
          await saveAnalysisError("Recording not available for this inquiry yet");
          return NextResponse.json({ error: "Recording not available for this inquiry yet" }, { status: 400 });
        }

        const { client } = await getOpenAIClientForCompany(companyId);
        if (!client) {
          await saveAnalysisError("AI provider is not configured for this company");
          return NextResponse.json({ error: "AI provider is not configured for this company" }, { status: 400 });
        }

        const { buffer, fileName } = await fetchRecordingBufferViaProxy({
          req,
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
          return NextResponse.json({ error: "Transcription is empty" }, { status: 400 });
        }

        const extracted = await analyzeTranscriptWithAi({
          companyId,
          transcript,
          fromNumber: row.from_number,
          toNumber: row.to_number,
        });

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
              id,
              name,
              phone,
              phone_alt,
              whatsapp_phone,
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

        // If analysis extracted extra details, backfill missing customer fields.
        if (matchedCustomer) {
          const nameMissing = !cleanText(matchedCustomer.name) || String(matchedCustomer.name).trim().toLowerCase() === "customer";
          const phoneMissing =
            !cleanText(matchedCustomer.phone) && !cleanText(matchedCustomer.phone_alt) && !cleanText(matchedCustomer.whatsapp_phone);
          const locationMissing = !cleanText(matchedCustomer.google_location) && !cleanText(matchedCustomer.address);
          const patch: Record<string, string> = {};
          if (nameMissing && analysisName) patch.name = analysisName;
          if (phoneMissing && preferredMobile) {
            patch.phone = preferredMobile;
            patch.whatsappPhone = preferredMobile;
          }
          if (locationMissing && analysisLocation) {
            patch.address = analysisLocation;
          }
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
        if (!updatedRows?.[0]?.id) {
          throw new Error("Failed to persist analysis payload");
        }
        const analysisSavedAt = analyzedAtIso;

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
          await Leads.updateLeadPartial(companyId, leadId, {
            leadType: toLeadType(extracted.lead_type),
          });
        }

        return NextResponse.json({
          ok: true,
          action: "analyze_recording",
          inquiryId,
          analysisSavedAt,
          transcriptLength: transcript.length,
          extracted,
          verification: {
            mobile: mobileVerified,
            location: locationVerified,
            customerExists: Boolean(matchedCustomer),
          },
          autoConverted: Boolean(shouldAutoConvert),
          leadId,
        });
      } catch (err: any) {
        const message = String(err?.message ?? "Analyze recording failed");
        await saveAnalysisError(message);
        return NextResponse.json({ error: message }, { status: 500 });
      }
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
