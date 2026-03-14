import { randomBytes } from "node:crypto";
import { getSql } from "@repo/ai-core/db";
import { sendMessageWithIntegrationId } from "@repo/ai-core/channels/service";

export type PreInspectionFormRequest = {
  id: string;
  company_id: string;
  lead_id: string;
  recovery_request_id: string | null;
  customer_id: string | null;
  car_id: string | null;
  appointment_type: "walkin" | "recovery";
  appointment_at: string | null;
  token: string;
  status: "pending" | "submitted";
  answers: Record<string, unknown>;
  terms_accepted: boolean;
  submitted_at: string | null;
  direct_sent_at: string | null;
  before_24h_sent_at: string | null;
  recovery_started_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type FormSendReason = "direct" | "before_24h" | "recovery_started";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return ((result as any).rows ?? result) as T[];
}

function toFormRow(row: any): PreInspectionFormRequest {
  return row as PreInspectionFormRequest;
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

function getPublicBaseUrl(): string {
  const base =
    process.env.APP_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return base.replace(/\/+$/, "");
}

export async function createOrUpdatePreInspectionFormRequest(args: {
  companyId: string;
  leadId: string;
  appointmentType: "walkin" | "recovery";
  appointmentAt?: string | null;
  recoveryRequestId?: string | null;
}): Promise<PreInspectionFormRequest> {
  const sql: any = getSql();
  const token = generateToken();
  const result = await sql`
    INSERT INTO pre_inspection_form_requests (
      company_id,
      lead_id,
      recovery_request_id,
      customer_id,
      car_id,
      appointment_type,
      appointment_at,
      token
    )
    SELECT
      ${args.companyId},
      ${args.leadId},
      ${args.recoveryRequestId ?? null},
      l.customer_id,
      l.car_id,
      ${args.appointmentType},
      ${args.appointmentAt ?? null},
      ${token}
    FROM leads l
    WHERE l.id = ${args.leadId}
      AND l.company_id = ${args.companyId}
    ON CONFLICT (lead_id, appointment_type)
    DO UPDATE SET
      recovery_request_id = COALESCE(EXCLUDED.recovery_request_id, pre_inspection_form_requests.recovery_request_id),
      appointment_at = COALESCE(EXCLUDED.appointment_at, pre_inspection_form_requests.appointment_at),
      updated_at = NOW()
    RETURNING *
  `;
  const row = rowsFrom<any>(result)[0];
  if (!row) {
    throw new Error("Lead not found for pre-inspection form request");
  }
  return toFormRow(row);
}

export async function getPreInspectionFormByToken(token: string): Promise<{
  form: PreInspectionFormRequest;
  customerName: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  carLabel: string | null;
  carPlate: string | null;
} | null> {
  const sql: any = getSql();
  const result = await sql`
    SELECT
      f.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.whatsapp_phone AS customer_whatsapp,
      c.email AS customer_email,
      car.make AS car_make,
      car.model AS car_model,
      car.plate_number AS car_plate
    FROM pre_inspection_form_requests f
    LEFT JOIN customers c ON c.id = f.customer_id
    LEFT JOIN cars car ON car.id = f.car_id
    WHERE f.token = ${token}
    LIMIT 1
  `;
  const row = rowsFrom<any>(result)[0];
  if (!row) return null;
  return {
    form: toFormRow(row),
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    customerWhatsapp: row.customer_whatsapp ?? null,
    customerEmail: row.customer_email ?? null,
    carLabel: [row.car_make, row.car_model].filter(Boolean).join(" ") || null,
    carPlate: row.car_plate ?? null,
  };
}

export async function submitPreInspectionFormByToken(args: {
  token: string;
  answers: Record<string, unknown>;
  termsAccepted: boolean;
}): Promise<PreInspectionFormRequest> {
  const sql: any = getSql();
  const result = await sql`
    UPDATE pre_inspection_form_requests
    SET
      answers = ${args.answers},
      terms_accepted = ${args.termsAccepted},
      status = 'submitted',
      submitted_at = NOW(),
      updated_at = NOW()
    WHERE token = ${args.token}
      AND status = 'pending'
    RETURNING *
  `;
  const row = rowsFrom<any>(result)[0];
  if (!row) {
    throw new Error("Form already submitted or token invalid");
  }
  return toFormRow(row);
}

async function getDefaultChannelIntegrations(companyId: string): Promise<{
  email: string | null;
  sms: string | null;
  whatsapp: string | null;
}> {
  const sql: any = getSql();
  const result = await sql`
    SELECT DISTINCT ON (channel_type)
      id,
      channel_type
    FROM integration_channels
    WHERE scope = 'company'
      AND company_id = ${companyId}
      AND is_active = TRUE
      AND channel_type IN ('email', 'sms', 'whatsapp')
    ORDER BY channel_type, created_at DESC
  `;
  const out = { email: null, sms: null, whatsapp: null } as {
    email: string | null;
    sms: string | null;
    whatsapp: string | null;
  };
  for (const row of rowsFrom<any>(result)) {
    const key = String(row.channel_type ?? "") as "email" | "sms" | "whatsapp";
    if (key in out) out[key] = String(row.id);
  }
  return out;
}

function buildFormLink(token: string): string {
  return `${getPublicBaseUrl()}/pre-inspection/${encodeURIComponent(token)}`;
}

function buildMessageBody(args: {
  customerName: string | null;
  formLink: string;
  appointmentType: "walkin" | "recovery";
  reason: FormSendReason;
}): string {
  const who = args.customerName || "Customer";
  const stageText =
    args.appointmentType === "recovery"
      ? "before pickup"
      : "before inspection";
  const reasonText =
    args.reason === "before_24h"
      ? "Reminder: your appointment is in less than 24 hours."
      : args.reason === "recovery_started"
      ? "Recovery has been accepted/started."
      : "Please complete your pre-inspection form.";
  return `${who}, ${reasonText} Please submit the mandatory form ${stageText}: ${args.formLink}`;
}

export async function sendPreInspectionFormRequestIfPending(args: {
  formId: string;
  reason: FormSendReason;
  force?: boolean;
  formLinkOverride?: string;
}): Promise<{ sent: boolean; skippedReason?: string | null; form?: PreInspectionFormRequest | null }> {
  const sql: any = getSql();
  const result = await sql`
    SELECT
      f.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.whatsapp_phone AS customer_whatsapp,
      c.email AS customer_email
    FROM pre_inspection_form_requests f
    LEFT JOIN customers c ON c.id = f.customer_id
    WHERE f.id = ${args.formId}
    LIMIT 1
  `;
  const row = rowsFrom<any>(result)[0];
  if (!row) return { sent: false, skippedReason: "form_not_found", form: null };
  if (!args.force && String(row.status) !== "pending") {
    return { sent: false, skippedReason: "already_submitted", form: toFormRow(row) };
  }
  if (!args.force && args.reason === "direct" && row.direct_sent_at) {
    return { sent: false, skippedReason: "direct_already_sent", form: toFormRow(row) };
  }
  if (!args.force && args.reason === "before_24h" && row.before_24h_sent_at) {
    return { sent: false, skippedReason: "before_24h_already_sent", form: toFormRow(row) };
  }
  if (!args.force && args.reason === "recovery_started" && row.recovery_started_sent_at) {
    return { sent: false, skippedReason: "recovery_started_already_sent", form: toFormRow(row) };
  }

  const companyId = String(row.company_id);
  const integrations = await getDefaultChannelIntegrations(companyId);
  const link = args.formLinkOverride?.trim() || buildFormLink(String(row.token));
  const messageBody = buildMessageBody({
    customerName: row.customer_name ?? null,
    formLink: link,
    appointmentType: row.appointment_type,
    reason: args.reason,
  });
  const emailSubject =
    row.appointment_type === "recovery"
      ? "Mandatory Recovery Pre-Pickup Form"
      : "Mandatory Pre-Inspection Form";
  const emailBody = `${messageBody}\n\nIf already submitted, please ignore this message.`;

  if (integrations.sms && row.customer_phone) {
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.sms,
      input: { to: String(row.customer_phone), body: messageBody },
    }).catch(() => undefined);
  }

  if (integrations.whatsapp && (row.customer_whatsapp || row.customer_phone)) {
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.whatsapp,
      input: { to: String(row.customer_whatsapp || row.customer_phone), body: messageBody },
    }).catch(() => undefined);
  }

  if (integrations.email && row.customer_email) {
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.email,
      input: { to: String(row.customer_email), subject: emailSubject, body: emailBody, htmlBody: emailBody },
    }).catch(() => undefined);
  }

  const sentColumn =
    args.reason === "before_24h"
      ? "before_24h_sent_at"
      : args.reason === "recovery_started"
      ? "recovery_started_sent_at"
      : "direct_sent_at";
  await sql.unsafe(
    `UPDATE pre_inspection_form_requests SET ${sentColumn} = COALESCE(${sentColumn}, NOW()), updated_at = NOW() WHERE id = $1`,
    [args.formId]
  );

  const refreshed = await sql`
    SELECT *
    FROM pre_inspection_form_requests
    WHERE id = ${args.formId}
    LIMIT 1
  `;
  return { sent: true, form: toFormRow(rowsFrom<any>(refreshed)[0]) };
}

export async function sendPreInspectionFormRequestByChannel(args: {
  formId: string;
  channel: "sms" | "whatsapp" | "email";
  reason?: FormSendReason;
  force?: boolean;
  formLinkOverride?: string;
}): Promise<{ sent: boolean; skippedReason?: string | null; form?: PreInspectionFormRequest | null }> {
  const sql: any = getSql();
  const reason = args.reason ?? "direct";
  const result = await sql`
    SELECT
      f.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.whatsapp_phone AS customer_whatsapp,
      c.email AS customer_email
    FROM pre_inspection_form_requests f
    LEFT JOIN customers c ON c.id = f.customer_id
    WHERE f.id = ${args.formId}
    LIMIT 1
  `;
  const row = rowsFrom<any>(result)[0];
  if (!row) return { sent: false, skippedReason: "form_not_found", form: null };
  if (!args.force && String(row.status) !== "pending") {
    return { sent: false, skippedReason: "already_submitted", form: toFormRow(row) };
  }

  const companyId = String(row.company_id);
  const integrations = await getDefaultChannelIntegrations(companyId);
  const link = args.formLinkOverride?.trim() || buildFormLink(String(row.token));
  const messageBody = buildMessageBody({
    customerName: row.customer_name ?? null,
    formLink: link,
    appointmentType: row.appointment_type,
    reason,
  });
  const emailSubject =
    row.appointment_type === "recovery"
      ? "Mandatory Recovery Pre-Pickup Form"
      : "Mandatory Pre-Inspection Form";
  const emailBody = `${messageBody}\n\nIf already submitted, please ignore this message.`;

  if (args.channel === "sms") {
    if (!integrations.sms || !row.customer_phone) {
      return { sent: false, skippedReason: "sms_channel_or_phone_missing", form: toFormRow(row) };
    }
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.sms,
      input: { to: String(row.customer_phone), body: messageBody },
    });
  } else if (args.channel === "whatsapp") {
    if (!integrations.whatsapp || !(row.customer_whatsapp || row.customer_phone)) {
      return { sent: false, skippedReason: "whatsapp_channel_or_phone_missing", form: toFormRow(row) };
    }
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.whatsapp,
      input: { to: String(row.customer_whatsapp || row.customer_phone), body: messageBody },
    });
  } else {
    if (!integrations.email || !row.customer_email) {
      return { sent: false, skippedReason: "email_channel_or_email_missing", form: toFormRow(row) };
    }
    await sendMessageWithIntegrationId({
      scope: "company",
      companyId,
      integrationId: integrations.email,
      input: { to: String(row.customer_email), subject: emailSubject, body: emailBody, htmlBody: emailBody },
    });
  }

  const sentColumn =
    reason === "before_24h"
      ? "before_24h_sent_at"
      : reason === "recovery_started"
      ? "recovery_started_sent_at"
      : "direct_sent_at";
  await sql.unsafe(
    `UPDATE pre_inspection_form_requests SET ${sentColumn} = COALESCE(${sentColumn}, NOW()), updated_at = NOW() WHERE id = $1`,
    [args.formId]
  );

  const refreshed = await sql`
    SELECT *
    FROM pre_inspection_form_requests
    WHERE id = ${args.formId}
    LIMIT 1
  `;
  return { sent: true, form: toFormRow(rowsFrom<any>(refreshed)[0]) };
}

export async function processPreInspectionBefore24h(companyId: string): Promise<{
  total: number;
  sent: number;
}> {
  const sql: any = getSql();
  const rows = await sql`
    SELECT id
    FROM pre_inspection_form_requests
    WHERE company_id = ${companyId}
      AND status = 'pending'
      AND appointment_at IS NOT NULL
      AND before_24h_sent_at IS NULL
      AND NOW() >= (appointment_at - INTERVAL '24 hours')
      AND created_at < (appointment_at - INTERVAL '24 hours')
    ORDER BY appointment_at ASC
    LIMIT 200
  `;
  let sent = 0;
  const all = rowsFrom<any>(rows);
  for (const row of all) {
    const res = await sendPreInspectionFormRequestIfPending({
      formId: String(row.id),
      reason: "before_24h",
    });
    if (res.sent) sent += 1;
  }
  return { total: all.length, sent };
}

export async function getPendingMandatoryFormForLead(args: {
  companyId: string;
  leadId: string;
  appointmentType: "walkin" | "recovery";
}): Promise<PreInspectionFormRequest | null> {
  const sql: any = getSql();
  const rows = await sql`
    SELECT *
    FROM pre_inspection_form_requests
    WHERE company_id = ${args.companyId}
      AND lead_id = ${args.leadId}
      AND appointment_type = ${args.appointmentType}
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rowsFrom<any>(rows)[0];
  return row ? toFormRow(row) : null;
}

export async function getPendingMandatoryFormForRecoveryRequest(args: {
  companyId: string;
  requestId: string;
}): Promise<PreInspectionFormRequest | null> {
  const sql: any = getSql();
  const rows = await sql`
    SELECT f.*
    FROM pre_inspection_form_requests f
    JOIN recovery_requests rr ON rr.id = f.recovery_request_id
    JOIN leads l ON l.id = rr.lead_id
    WHERE rr.id = ${args.requestId}
      AND l.company_id = ${args.companyId}
      AND f.status = 'pending'
      AND f.appointment_type = 'recovery'
    ORDER BY f.created_at DESC
    LIMIT 1
  `;
  const row = rowsFrom<any>(rows)[0];
  return row ? toFormRow(row) : null;
}

export async function getLatestFormForRecoveryRequest(args: {
  companyId: string;
  requestId: string;
}): Promise<PreInspectionFormRequest | null> {
  const sql: any = getSql();
  const rows = await sql`
    SELECT f.*
    FROM pre_inspection_form_requests f
    JOIN recovery_requests rr ON rr.id = f.recovery_request_id
    JOIN leads l ON l.id = rr.lead_id
    WHERE rr.id = ${args.requestId}
      AND l.company_id = ${args.companyId}
      AND f.appointment_type = 'recovery'
    ORDER BY f.created_at DESC
    LIMIT 1
  `;
  const row = rowsFrom<any>(rows)[0];
  return row ? toFormRow(row) : null;
}

export async function getLatestFormForLead(args: {
  companyId: string;
  leadId: string;
}): Promise<PreInspectionFormRequest | null> {
  const sql: any = getSql();
  const rows = await sql`
    SELECT *
    FROM pre_inspection_form_requests
    WHERE company_id = ${args.companyId}
      AND lead_id = ${args.leadId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rowsFrom<any>(rows)[0];
  return row ? toFormRow(row) : null;
}

export async function getLatestFormForLeadOrRelated(args: {
  companyId: string;
  leadId: string;
}): Promise<PreInspectionFormRequest | null> {
  const sql: any = getSql();
  const rows = await sql`
    WITH target AS (
      SELECT
        l.id,
        l.company_id,
        l.customer_id,
        l.car_id,
        NULLIF(regexp_replace(COALESCE(l.customer_phone, tc.phone, tc.whatsapp_phone, ''), '[^0-9]', '', 'g'), '') AS normalized_phone
      FROM leads l
      LEFT JOIN customers tc ON tc.id = l.customer_id
      WHERE id = ${args.leadId}
        AND l.company_id = ${args.companyId}
      LIMIT 1
    )
    SELECT f.*
    FROM target t
    JOIN LATERAL (
      SELECT f.*
      FROM pre_inspection_form_requests f
      JOIN leads lf ON lf.id = f.lead_id
      LEFT JOIN customers lfc ON lfc.id = lf.customer_id
      WHERE f.company_id = t.company_id
        AND lf.company_id = t.company_id
        AND (
          f.lead_id = t.id
          OR (
            (
              t.customer_id IS NOT NULL
              AND lf.customer_id IS NOT DISTINCT FROM t.customer_id
            )
            OR (
              t.car_id IS NOT NULL
              AND lf.car_id IS NOT DISTINCT FROM t.car_id
            )
            OR (
              t.normalized_phone IS NOT NULL
              AND (
                NULLIF(regexp_replace(COALESCE(lf.customer_phone, lfc.phone, lfc.whatsapp_phone, ''), '[^0-9]', '', 'g'), '') IS NOT DISTINCT FROM t.normalized_phone
                OR RIGHT(NULLIF(regexp_replace(COALESCE(lf.customer_phone, lfc.phone, lfc.whatsapp_phone, ''), '[^0-9]', '', 'g'), ''), 9) =
                   RIGHT(t.normalized_phone, 9)
              )
            )
          )
        )
      ORDER BY
        CASE WHEN f.lead_id = t.id THEN 0 ELSE 1 END,
        CASE WHEN f.status = 'submitted' THEN 0 ELSE 1 END,
        f.created_at DESC
      LIMIT 1
    ) f ON TRUE
  `;
  const row = rowsFrom<any>(rows)[0];
  return row ? toFormRow(row) : null;
}

export async function listLatestFormsForLeads(args: {
  companyId: string;
  leadIds: string[];
}): Promise<Record<string, PreInspectionFormRequest>> {
  const leadIds = Array.from(new Set(args.leadIds.filter(Boolean)));
  if (!leadIds.length) return {};
  const sql: any = getSql();
  const rows = await sql`
    WITH target AS (
      SELECT
        l.id,
        l.company_id,
        l.customer_id,
        l.car_id,
        NULLIF(regexp_replace(COALESCE(l.customer_phone, tc.phone, tc.whatsapp_phone, ''), '[^0-9]', '', 'g'), '') AS normalized_phone
      FROM leads l
      LEFT JOIN customers tc ON tc.id = l.customer_id
      WHERE company_id = ${args.companyId}
        AND l.id::text = ANY(${sql.array(leadIds, "text")})
    )
    SELECT
      t.id AS target_lead_id,
      f.*
    FROM target t
    JOIN LATERAL (
      SELECT f.*
      FROM pre_inspection_form_requests f
      JOIN leads lf ON lf.id = f.lead_id
      LEFT JOIN customers lfc ON lfc.id = lf.customer_id
      WHERE f.company_id = t.company_id
        AND lf.company_id = t.company_id
        AND (
          f.lead_id = t.id
          OR (
            (
              t.customer_id IS NOT NULL
              AND lf.customer_id IS NOT DISTINCT FROM t.customer_id
            )
            OR (
              t.car_id IS NOT NULL
              AND lf.car_id IS NOT DISTINCT FROM t.car_id
            )
            OR (
              t.normalized_phone IS NOT NULL
              AND (
                NULLIF(regexp_replace(COALESCE(lf.customer_phone, lfc.phone, lfc.whatsapp_phone, ''), '[^0-9]', '', 'g'), '') IS NOT DISTINCT FROM t.normalized_phone
                OR RIGHT(NULLIF(regexp_replace(COALESCE(lf.customer_phone, lfc.phone, lfc.whatsapp_phone, ''), '[^0-9]', '', 'g'), ''), 9) =
                   RIGHT(t.normalized_phone, 9)
              )
            )
          )
        )
      ORDER BY
        CASE WHEN f.lead_id = t.id THEN 0 ELSE 1 END,
        CASE WHEN f.status = 'submitted' THEN 0 ELSE 1 END,
        f.created_at DESC
      LIMIT 1
    ) f ON TRUE
  `;
  const out: Record<string, PreInspectionFormRequest> = {};
  for (const row of rowsFrom<any>(rows)) {
    const leadId = String(row?.target_lead_id ?? "");
    if (!leadId) continue;
    out[leadId] = toFormRow(row);
  }
  return out;
}
