import { NextRequest, NextResponse } from "next/server";
import { getSql, CallAiWorkflow, Leads } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string }> };

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

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const sql = getSql();
  try {
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
      lead_outcome: string | null;
      outcome_reason: string | null;
      verified_mobile: boolean;
      verified_location: boolean;
      verification_notes: string | null;
      customer_exists: boolean;
      matched_customer_id: string | null;
      matched_customer_name: string | null;
      matched_customer_phone: string | null;
      recording_url: string | null;
      recording_duration_seconds: number | null;
      created_at: string;
      updated_at: string;
    }[]>`
      SELECT
        call_ai_inquiries.id,
        call_ai_inquiries.provider_key,
        call_ai_inquiries.provider_call_id,
        call_ai_inquiries.from_number,
        call_ai_inquiries.to_number,
        call_ai_inquiries.inquiry_status,
        call_ai_inquiries.inquiry_summary,
        call_ai_inquiries.conversion_status,
        call_ai_inquiries.converted_to_lead_id,
        l.lead_type AS converted_lead_type,
        call_ai_inquiries.lead_outcome,
        call_ai_inquiries.outcome_reason,
        COALESCE((call_ai_inquiries.ai_payload->'manualVerification'->>'mobile')::boolean, false) AS verified_mobile,
        COALESCE((call_ai_inquiries.ai_payload->'manualVerification'->>'location')::boolean, false) AS verified_location,
        (call_ai_inquiries.ai_payload->'manualVerification'->>'notes')::text AS verification_notes,
        COALESCE((call_ai_inquiries.ai_payload->'customerMatch'->>'exists')::boolean, false) AS customer_exists,
        (call_ai_inquiries.ai_payload->'customerMatch'->>'customerId')::text AS matched_customer_id,
        (call_ai_inquiries.ai_payload->'customerMatch'->>'customerName')::text AS matched_customer_name,
        (call_ai_inquiries.ai_payload->'customerMatch'->>'customerPhone')::text AS matched_customer_phone,
        rec.url AS recording_url,
        rec.duration_seconds AS recording_duration_seconds,
        call_ai_inquiries.created_at,
        call_ai_inquiries.updated_at
      FROM call_ai_inquiries
      LEFT JOIN leads l ON l.company_id = call_ai_inquiries.company_id AND l.id = call_ai_inquiries.converted_to_lead_id
      LEFT JOIN LATERAL (
        SELECT cr.url, cr.duration_seconds
        FROM call_sessions cs
        JOIN call_recordings cr ON cr.call_session_id = cs.id
        WHERE cs.company_id = call_ai_inquiries.company_id
          AND cs.provider_call_id = call_ai_inquiries.provider_call_id
        ORDER BY cr.created_at DESC
        LIMIT 1
      ) rec ON true
      WHERE call_ai_inquiries.company_id = ${companyId}
      ORDER BY call_ai_inquiries.created_at DESC
      LIMIT 200
    `;

    const unresolvedRows = rows.filter((r) => !r.customer_exists && r.from_number);
    if (!unresolvedRows.length) {
      return NextResponse.json({ companyId, inquiries: rows });
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
    }[]>`
      SELECT id, name, phone, phone_alt, whatsapp_phone
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

    const customerByNormalized = new Map<string, { id: string; name: string | null; phone: string | null }>();
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
      };
    });

    return NextResponse.json({ companyId, inquiries: enriched });
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
  if (!inquiryId) {
    return NextResponse.json({ error: "inquiryId is required" }, { status: 400 });
  }

  const sql = getSql();

  try {
    if (action === "verify") {
      const verifiedMobile = Boolean(body?.verifiedMobile);
      const verifiedLocation = Boolean(body?.verifiedLocation);
      const notes = String(body?.verificationNotes ?? "").trim();
      const nextInquiryStatus = verifiedMobile && verifiedLocation ? "qualified" : "new";

      const rows = await sql<any[]>`
        UPDATE call_ai_inquiries
        SET
          inquiry_status = ${nextInquiryStatus},
          ai_payload = COALESCE(ai_payload, '{}'::jsonb) || jsonb_build_object(
            'manualVerification',
            jsonb_build_object(
              'mobile', ${verifiedMobile},
              'location', ${verifiedLocation},
              'notes', ${notes || null},
              'verifiedAt', ${new Date().toISOString()}
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
      });

      await sql`
        UPDATE call_ai_inquiries
        SET
          ai_payload = COALESCE(ai_payload, '{}'::jsonb) || jsonb_build_object(
            'manualLeadType',
            jsonb_build_object(
              'value', ${leadTypeRaw},
              'updatedAt', ${new Date().toISOString()}
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
