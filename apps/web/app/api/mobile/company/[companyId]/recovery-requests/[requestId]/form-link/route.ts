import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createOrUpdatePreInspectionFormRequest,
  getLatestFormForRecoveryRequest,
  sendPreInspectionFormRequestByChannel,
  sendPreInspectionFormRequestIfPending,
} from "@/lib/pre-inspection-form";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = {
  params: Promise<{ companyId: string; requestId: string }>;
};

function buildPublicFormUrl(token: string) {
  const base =
    process.env.APP_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (base) {
    return `${base.replace(/\/+$/, "")}/pre-inspection/${encodeURIComponent(token)}`;
  }
  return `/pre-inspection/${encodeURIComponent(token)}`;
}

async function ensureRecoveryForm(companyId: string, requestId: string) {
  let form = await getLatestFormForRecoveryRequest({ companyId, requestId });
  if (form) return form;

  const sql = getSql();
  const rows = await sql<any[]>`
    SELECT
      rr.id AS recovery_request_id,
      rr.lead_id,
      rr.scheduled_at
    FROM recovery_requests rr
    JOIN leads l ON l.id = rr.lead_id
    WHERE rr.id = ${requestId}
      AND l.company_id = ${companyId}
    LIMIT 1
  `;
  const row = rows?.[0] ?? null;
  if (!row) return null;

  form = await createOrUpdatePreInspectionFormRequest({
    companyId,
    leadId: String(row.lead_id),
    appointmentType: "recovery",
    appointmentAt: row.scheduled_at ?? null,
    recoveryRequestId: String(row.recovery_request_id),
  });
  return form;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const form = await ensureRecoveryForm(companyId, requestId);
    if (!form) {
      return createMobileErrorResponse(
        "Form not found for this recovery request",
        404,
      );
    }

    return createMobileSuccessResponse({
      formId: form.id,
      status: form.status,
      formUrl: buildPublicFormUrl(form.token),
      token: form.token,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/recovery-requests/[requestId]/form-link error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    const channel = ["sms", "whatsapp", "email", "all"].includes(
      String(body?.channel ?? "all"),
    )
      ? String(body?.channel ?? "all")
      : "all";
    const reason = ["direct", "before_24h", "recovery_started"].includes(
      String(body?.reason ?? "direct"),
    )
      ? String(body?.reason ?? "direct")
      : "direct";
    const force = body?.force === undefined ? true : Boolean(body.force);

    const form = await ensureRecoveryForm(companyId, requestId);
    if (!form) {
      return createMobileErrorResponse(
        "Form not found for this recovery request",
        404,
      );
    }

    const finalResult =
      channel === "all"
        ? await sendPreInspectionFormRequestIfPending({
            formId: form.id,
            reason: reason as any,
            force,
          })
        : await sendPreInspectionFormRequestByChannel({
            formId: form.id,
            channel: channel as any,
            reason: reason as any,
            force,
          });

    return createMobileSuccessResponse({
      sent: finalResult.sent,
      skippedReason: finalResult.skippedReason ?? null,
      formId: form.id,
      formUrl: buildPublicFormUrl(form.token),
      status: finalResult.form?.status ?? form.status,
      channel,
    });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/recovery-requests/[requestId]/form-link error:",
      error,
    );
    return handleMobileError(error);
  }
}
