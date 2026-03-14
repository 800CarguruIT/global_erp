import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import {
  createOrUpdatePreInspectionFormRequest,
  getLatestFormForRecoveryRequest,
  sendPreInspectionFormRequestByChannel,
  sendPreInspectionFormRequestIfPending,
} from "@/lib/pre-inspection-form";
import { getSql } from "@repo/ai-core/db";

type Params = {
  params:
    | { companyId: string; requestId: string }
    | Promise<{ companyId: string; requestId: string }>;
};

const bodySchema = z.object({
  channel: z.enum(["sms", "whatsapp", "email", "all"]).optional().default("all"),
  reason: z.enum(["direct", "before_24h", "recovery_started"]).optional().default("direct"),
  force: z.boolean().optional().default(true),
});

function buildPublicFormUrl(token: string): string {
  const base =
    process.env.APP_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (base) return `${base.replace(/\/+$/, "")}/pre-inspection/${encodeURIComponent(token)}`;
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
  const row = ((rows as any).rows ?? rows)?.[0];
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

export async function GET(req: NextRequest, ctx: Params) {
  const { companyId, requestId } = await Promise.resolve(ctx.params);
  const perm = await requirePermission(
    req,
    "jobs.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  const form = await ensureRecoveryForm(companyId, requestId);
  if (!form) {
    return NextResponse.json({ error: "Form not found for this recovery request" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      formId: form.id,
      status: form.status,
      formUrl: buildPublicFormUrl(form.token),
      token: form.token,
    },
  });
}

export async function POST(req: NextRequest, ctx: Params) {
  const { companyId, requestId } = await Promise.resolve(ctx.params);
  const perm = await requirePermission(
    req,
    "jobs.view",
    buildScopeContextFromRoute({ companyId }, "company")
  );
  if (perm) return perm;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const form = await ensureRecoveryForm(companyId, requestId);
  if (!form) {
    return NextResponse.json({ error: "Form not found for this recovery request" }, { status: 404 });
  }

  const channel = parsed.data.channel;
  const finalResult =
    channel === "all"
      ? await sendPreInspectionFormRequestIfPending({
          formId: form.id,
          reason: parsed.data.reason,
          force: parsed.data.force,
        })
      : await sendPreInspectionFormRequestByChannel({
          formId: form.id,
          channel,
          reason: parsed.data.reason,
          force: parsed.data.force,
        });

  return NextResponse.json({
    data: {
      sent: finalResult.sent,
      skippedReason: finalResult.skippedReason ?? null,
      formId: form.id,
      formUrl: buildPublicFormUrl(form.token),
      status: finalResult.form?.status ?? form.status,
      channel,
    },
  });
}
