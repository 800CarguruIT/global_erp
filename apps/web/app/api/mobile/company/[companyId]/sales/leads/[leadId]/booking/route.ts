import { NextRequest } from "next/server";
import {
  appendLeadEvent,
  getLeadById,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; leadId: string }> };

type BookingKind = "rsa" | "recovery" | "workshop_walkin" | "workshop_recovery";
type WorkshopVisitMode = "walkin" | "recovery";
type BookingPriority = "low" | "medium" | "high";
type BookingLeadType = "rsa" | "recovery" | "workshop";

function normalizeWorkshopVisitMode(lead: any): WorkshopVisitMode {
  const explicit = String(lead?.workshopVisitMode ?? "")
    .trim()
    .toLowerCase();
  if (explicit === "walkin" || explicit === "recovery") return explicit;
  const serviceType = String(lead?.serviceType ?? "")
    .trim()
    .toLowerCase();
  if (serviceType === "pickup" || serviceType === "recovery") return "recovery";
  if (
    String(lead?.pickupFrom ?? "").trim() ||
    String(lead?.dropoffTo ?? "").trim()
  ) {
    return "recovery";
  }
  return "walkin";
}

function normalizeLeadType(input: unknown): BookingLeadType | null {
  const value = String(input ?? "")
    .trim()
    .toLowerCase();
  if (value === "rsa" || value === "recovery" || value === "workshop") {
    return value;
  }
  return null;
}

function bookingKindToLeadType(
  kind: string | null | undefined,
): BookingLeadType | null {
  const value = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (value === "rsa") return "rsa";
  if (value === "recovery") return "recovery";
  if (value === "workshop_walkin" || value === "workshop_recovery") {
    return "workshop";
  }
  return null;
}

function resolveBookingKind(
  lead: any,
  workshopTypeInput?: unknown,
  leadTypeInput?: unknown,
): BookingKind {
  const leadType =
    normalizeLeadType(leadTypeInput) ??
    normalizeLeadType(lead?.leadType) ??
    "rsa";
  if (leadType === "rsa") return "rsa";
  if (leadType === "recovery") return "recovery";
  if (leadType === "workshop") {
    const requested = String(workshopTypeInput ?? "")
      .trim()
      .toLowerCase();
    if (requested === "recovery") return "workshop_recovery";
    if (requested === "walkin") return "workshop_walkin";
    return normalizeWorkshopVisitMode(lead) === "recovery"
      ? "workshop_recovery"
      : "workshop_walkin";
  }
  throw new Error("Unsupported lead type for booking");
}

function cleanText(input: unknown): string | null {
  const value = String(input ?? "").trim();
  return value ? value : null;
}

function parseScheduledAt(input: unknown): string | null {
  const raw = cleanText(input);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizePriority(input: unknown): BookingPriority {
  const value = String(input ?? "")
    .trim()
    .toLowerCase();
  if (value === "low" || value === "high") return value;
  return "medium";
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, leadId } = await params;

    await ensureCompanyAccess(userId, companyId);

    const lead = await getLeadById(companyId, leadId);
    if (!lead) return createMobileErrorResponse("Lead not found", 404);

    const sql = getSql();
    const rows = await sql /* sql */ `
      SELECT booking_kind, priority, scheduled_at, pickup_location, dropoff_location
      FROM lead_bookings
      WHERE company_id = ${companyId}
        AND lead_id = ${leadId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const latest = rows?.[0] ?? null;
    const leadType =
      bookingKindToLeadType(latest?.booking_kind) ??
      normalizeLeadType(lead.leadType) ??
      "rsa";
    const workshopType =
      String(latest?.booking_kind ?? "").toLowerCase() === "workshop_recovery"
        ? "recovery"
        : String(latest?.booking_kind ?? "").toLowerCase() === "workshop_walkin"
          ? "walkin"
          : normalizeWorkshopVisitMode(lead);

    return createMobileSuccessResponse({
      leadType,
      workshopType,
      priority: normalizePriority(latest?.priority),
      scheduledAt: latest?.scheduled_at ?? null,
      pickupLocation: latest?.pickup_location ?? null,
      dropoffLocation: latest?.dropoff_location ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/sales/leads/[leadId]/booking error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, leadId } = await params;

    await ensureCompanyAccess(userId, companyId);

    const lead = await getLeadById(companyId, leadId);
    if (!lead) return createMobileErrorResponse("Lead not found", 404);

    const body = await req.json().catch(() => ({}));
    const scheduledAt = parseScheduledAt(body?.scheduledAt);
    const pickupLocation = cleanText(body?.pickupLocation ?? body?.pickupFrom);
    const pickupGoogleLocation = cleanText(body?.pickupGoogleLocation);
    const dropoffLocation = cleanText(body?.dropoffLocation ?? body?.dropoffTo);
    const dropoffGoogleLocation = cleanText(body?.dropoffGoogleLocation);
    const notes = cleanText(body?.notes ?? body?.remarks);
    const priority = normalizePriority(body?.priority);
    const verifiedLeadType = normalizeLeadType(body?.leadType);

    if (!scheduledAt) {
      return createMobileErrorResponse("scheduledAt is required", 400);
    }

    let bookingKind: BookingKind;
    try {
      bookingKind = resolveBookingKind(
        lead,
        body?.bookingType,
        verifiedLeadType,
      );
    } catch (error: any) {
      return createMobileErrorResponse(
        String(error?.message ?? "Unsupported lead type"),
        400,
      );
    }

    if (bookingKind === "rsa" && !pickupLocation) {
      return createMobileErrorResponse(
        "pickupLocation is required for RSA booking",
        400,
      );
    }
    if (
      (bookingKind === "recovery" || bookingKind === "workshop_recovery") &&
      (!pickupLocation || !dropoffLocation)
    ) {
      return createMobileErrorResponse(
        "pickupLocation and dropoffLocation are required for recovery booking",
        400,
      );
    }

    const sql = getSql();
    const bookingRows = await sql /* sql */ `
      INSERT INTO lead_bookings (
        company_id,
        lead_id,
        booking_kind,
        scheduled_at,
        pickup_location,
        pickup_google_location,
        dropoff_location,
        dropoff_google_location,
        notes,
        priority,
        status,
        created_by_user_id
      )
      VALUES (
        ${companyId},
        ${leadId},
        ${bookingKind},
        ${scheduledAt},
        ${pickupLocation},
        ${pickupGoogleLocation},
        ${dropoffLocation},
        ${dropoffGoogleLocation},
        ${notes},
        ${priority},
        'active',
        ${userId}
      )
      ON CONFLICT (lead_id, booking_kind)
      WHERE status = 'active'
      DO UPDATE SET
        scheduled_at = EXCLUDED.scheduled_at,
        pickup_location = EXCLUDED.pickup_location,
        pickup_google_location = EXCLUDED.pickup_google_location,
        dropoff_location = EXCLUDED.dropoff_location,
        dropoff_google_location = EXCLUDED.dropoff_google_location,
        notes = EXCLUDED.notes,
        priority = EXCLUDED.priority,
        created_by_user_id = EXCLUDED.created_by_user_id,
        updated_at = now()
      RETURNING id
    `;
    const bookingId = String(bookingRows?.[0]?.id ?? "");

    await updateLeadPartial(companyId, leadId, {
      pickupFrom: pickupLocation ?? lead.pickupFrom ?? null,
      pickupGoogleLocation:
        pickupGoogleLocation ?? lead.pickupGoogleLocation ?? null,
      dropoffTo:
        bookingKind === "recovery" || bookingKind === "workshop_recovery"
          ? (dropoffLocation ?? lead.dropoffTo ?? null)
          : (lead.dropoffTo ?? null),
      dropoffGoogleLocation:
        bookingKind === "recovery" || bookingKind === "workshop_recovery"
          ? (dropoffGoogleLocation ?? lead.dropoffGoogleLocation ?? null)
          : (lead.dropoffGoogleLocation ?? null),
      workshopVisitMode:
        lead.leadType === "workshop"
          ? bookingKind === "workshop_recovery"
            ? "recovery"
            : "walkin"
          : undefined,
    });

    let recoveryRequestId: string | null = null;
    if (bookingKind === "recovery" || bookingKind === "workshop_recovery") {
      const existingRows = await sql /* sql */ `
        SELECT id
        FROM recovery_requests
        WHERE lead_id = ${leadId}
          AND type = 'pickup'
          AND status <> 'Done'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const existingId = String(existingRows?.[0]?.id ?? "").trim();
      if (existingId) {
        await sql /* sql */ `
          UPDATE recovery_requests
          SET
            pickup_location = ${pickupLocation},
            dropoff_location = ${dropoffLocation},
            type = 'pickup',
            scheduled_at = ${scheduledAt},
            remarks = ${notes},
            updated_at = now()
          WHERE id = ${existingId}
        `;
        recoveryRequestId = existingId;
      } else {
        const inserted = await sql /* sql */ `
          INSERT INTO recovery_requests (
            lead_id,
            pickup_location,
            dropoff_location,
            type,
            remarks,
            scheduled_at
          )
          VALUES (
            ${leadId},
            ${pickupLocation},
            ${dropoffLocation},
            'pickup',
            ${notes},
            ${scheduledAt}
          )
          RETURNING id
        `;
        recoveryRequestId = String(inserted?.[0]?.id ?? "").trim() || null;
      }
    }

    await appendLeadEvent({
      companyId,
      leadId,
      actorUserId: userId,
      eventType: "lead_booking_saved",
      eventPayload: {
        bookingId,
        bookingKind,
        verifiedLeadType: verifiedLeadType ?? normalizeLeadType(lead.leadType),
        priority,
        scheduledAt,
        pickupLocation,
        dropoffLocation,
        recoveryRequestId,
      },
    });

    const refreshed = await getLeadById(companyId, leadId);
    return createMobileSuccessResponse({
      bookingId,
      bookingKind,
      recoveryRequestId,
      lead: refreshed ?? lead,
    });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/sales/leads/[leadId]/booking error:",
      error,
    );
    return handleMobileError(error);
  }
}
