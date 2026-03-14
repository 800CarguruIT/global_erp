import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const status = String(searchParams.get("status") ?? "").trim().toLowerCase();
  const priority = String(searchParams.get("priority") ?? "").trim().toLowerCase();
  const bookingType = String(searchParams.get("bookingType") ?? "").trim().toLowerCase();
  const q = String(searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const sql = getSql();
    const rows = await sql/* sql */ `
      SELECT
        lb.id,
        lb.company_id,
        lb.lead_id,
        lb.booking_kind,
        lb.scheduled_at,
        lb.pickup_location,
        lb.pickup_google_location,
        lb.dropoff_location,
        lb.dropoff_google_location,
        lb.notes,
        lb.priority,
        lb.status,
        lb.created_by_user_id,
        lb.created_at,
        lb.updated_at,
        l.lead_type,
        l.workshop_visit_mode,
        l.lead_status,
        l.lead_stage,
        pif.status AS pre_service_form_status,
        pif.submitted_at AS pre_service_form_submitted_at,
        pif.token AS pre_service_form_token,
        c.name AS customer_name,
        c.phone AS customer_phone,
        car.plate_number AS car_plate_number,
        car.make AS car_make,
        car.model AS car_model
      FROM lead_bookings lb
      JOIN leads l ON l.id = lb.lead_id
      LEFT JOIN LATERAL (
        SELECT
          f.status,
          f.submitted_at,
          f.token
        FROM pre_inspection_form_requests f
        WHERE f.company_id = lb.company_id
          AND f.lead_id = lb.lead_id
          AND f.appointment_type = CASE
            WHEN LOWER(lb.booking_kind) IN ('recovery', 'workshop_recovery') THEN 'recovery'
            ELSE 'walkin'
          END
        ORDER BY f.created_at DESC
        LIMIT 1
      ) pif ON TRUE
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      WHERE lb.company_id = ${companyId}
        AND (${!status} OR LOWER(lb.status) = ${status})
        AND (${!priority} OR LOWER(lb.priority) = ${priority})
        AND (
          ${!bookingType}
          OR (${bookingType} = 'rsa' AND LOWER(lb.booking_kind) = 'rsa')
          OR (${bookingType} = 'recovery' AND LOWER(lb.booking_kind) = 'recovery')
          OR (${bookingType} = 'workshop' AND LOWER(lb.booking_kind) IN ('workshop_walkin', 'workshop_recovery'))
        )
      ORDER BY lb.created_at DESC
    `;

    const data = (rows ?? []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      leadId: row.lead_id,
      bookingKind: row.booking_kind,
      scheduledAt: row.scheduled_at ?? null,
      pickupLocation: row.pickup_location ?? null,
      pickupGoogleLocation: row.pickup_google_location ?? null,
      dropoffLocation: row.dropoff_location ?? null,
      dropoffGoogleLocation: row.dropoff_google_location ?? null,
      notes: row.notes ?? null,
      priority: row.priority ?? "medium",
      status: row.status ?? "active",
      createdByUserId: row.created_by_user_id ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      leadType: row.lead_type ?? null,
      workshopVisitMode: row.workshop_visit_mode ?? null,
      leadStatus: row.lead_status ?? null,
      leadStage: row.lead_stage ?? null,
      preServiceFormStatus: row.pre_service_form_status ?? null,
      preServiceFormSubmittedAt: row.pre_service_form_submitted_at ?? null,
      preServiceFormToken: row.pre_service_form_token ?? null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      carPlateNumber: row.car_plate_number ?? null,
      carMake: row.car_make ?? null,
      carModel: row.car_model ?? null,
    }));

    const filtered = q
      ? data.filter((row: any) =>
          [
            row.id,
            row.leadId,
            row.bookingKind,
            row.priority,
            row.status,
            row.customerName,
            row.customerPhone,
            row.carPlateNumber,
            row.carMake,
            row.carModel,
            row.pickupLocation,
            row.dropoffLocation,
          ]
            .map((v) => String(v ?? "").toLowerCase())
            .join(" ")
            .includes(q)
        )
      : data;

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("GET /api/company/[companyId]/sales/leads/bookings error:", error);
    return NextResponse.json({ error: "Failed to load lead bookings" }, { status: 500 });
  }
}
