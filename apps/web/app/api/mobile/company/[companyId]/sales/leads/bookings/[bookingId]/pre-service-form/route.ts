import { NextRequest } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createOrUpdatePreInspectionFormRequest,
  getLatestFormForLead,
  sendPreInspectionFormRequestByChannel,
  sendPreInspectionFormRequestIfPending,
} from "@/lib/pre-inspection-form";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; bookingId: string }> };

const bodySchema = z.object({
  channel: z.enum(["sms", "whatsapp", "email", "all"]).default("all"),
  reason: z
    .enum(["direct", "before_24h", "recovery_started"])
    .optional()
    .default("direct"),
  force: z.boolean().optional().default(true),
});

function buildPublicFormUrl(args: {
  token: string;
  companyId: string;
  bookingId: string;
  leadId: string;
}): string {
  const base =
    process.env.APP_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const query = new URLSearchParams({
    source: "lead-booking",
    companyId: args.companyId,
    bookingId: args.bookingId,
    leadId: args.leadId,
  }).toString();
  const path = `/pre-inspection/${encodeURIComponent(args.token)}?${query}`;
  if (base) return `${base.replace(/\/+$/, "")}${path}`;
  return path;
}

function appointmentTypeFromBookingKind(kind: string): "walkin" | "recovery" {
  const value = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (value === "recovery" || value === "workshop_recovery") return "recovery";
  return "walkin";
}

async function ensureForm(companyId: string, bookingId: string) {
  const sql = getSql();
  const rows = await sql<any[]>`
    SELECT
      lb.id AS booking_id,
      lb.lead_id,
      lb.booking_kind,
      lb.scheduled_at
    FROM lead_bookings lb
    WHERE lb.id = ${bookingId}
      AND lb.company_id = ${companyId}
    LIMIT 1
  `;
  const row = ((rows as any).rows ?? rows)?.[0];
  if (!row) return null;
  const appointmentType = appointmentTypeFromBookingKind(
    String(row.booking_kind),
  );

  let form = await getLatestFormForLead({
    companyId,
    leadId: String(row.lead_id),
  });
  if (!form || form.appointment_type !== appointmentType) {
    form = await createOrUpdatePreInspectionFormRequest({
      companyId,
      leadId: String(row.lead_id),
      appointmentType,
      appointmentAt: row.scheduled_at ?? null,
    });
  }

  return {
    bookingId: String(row.booking_id),
    leadId: String(row.lead_id),
    appointmentType,
    form,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, bookingId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const ensured = await ensureForm(companyId, bookingId);
    if (!ensured) {
      return createMobileErrorResponse("Booking not found", 404);
    }

    return createMobileSuccessResponse({
      bookingId: ensured.bookingId,
      leadId: ensured.leadId,
      appointmentType: ensured.appointmentType,
      formId: ensured.form.id,
      formStatus: ensured.form.status,
      formUrl: buildPublicFormUrl({
        token: ensured.form.token,
        companyId,
        bookingId: ensured.bookingId,
        leadId: ensured.leadId,
      }),
      token: ensured.form.token,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/sales/leads/bookings/[bookingId]/pre-service-form error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, bookingId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const ensured = await ensureForm(companyId, bookingId);
    if (!ensured) {
      return createMobileErrorResponse("Booking not found", 404);
    }

    const payload = parsed.data;
    const bookingFormUrl = buildPublicFormUrl({
      token: ensured.form.token,
      companyId,
      bookingId: ensured.bookingId,
      leadId: ensured.leadId,
    });
    const result =
      payload.channel === "all"
        ? await sendPreInspectionFormRequestIfPending({
            formId: ensured.form.id,
            reason: payload.reason,
            force: payload.force,
            formLinkOverride: bookingFormUrl,
          })
        : await sendPreInspectionFormRequestByChannel({
            formId: ensured.form.id,
            channel: payload.channel,
            reason: payload.reason,
            force: payload.force,
            formLinkOverride: bookingFormUrl,
          });

    return createMobileSuccessResponse({
      sent: result.sent,
      skippedReason: result.skippedReason ?? null,
      bookingId: ensured.bookingId,
      leadId: ensured.leadId,
      formId: ensured.form.id,
      formUrl: bookingFormUrl,
      formStatus: result.form?.status ?? ensured.form.status,
      channel: payload.channel,
    });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/sales/leads/bookings/[bookingId]/pre-service-form error:",
      error,
    );
    return handleMobileError(error);
  }
}
