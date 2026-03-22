import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  serviceRequestTypes,
  type ServiceRequestType,
} from "@repo/ai-core/crm/leads/service-request-types";
import { Crm } from "@repo/ai-core";
import {
  appendLeadEvent,
  createLead,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { dispatchLeadBookingFlow } from "@/lib/workshop-booking-flow";

const payloadSchema = z.object({
  carId: z.string().min(1),
  action: z.enum(["car_in", "appointment"]),
  appointmentAt: z.string().optional().nullable(),
  appointmentType: z.enum(["walkin", "recovery"]).optional().nullable(),
  recoveryType: z.enum(["pickup", "dropoff"]).optional().nullable(),
  pickupLocation: z.string().optional().nullable(),
  dropoffLocation: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  serviceType: z.enum(serviceRequestTypes).optional().nullable(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

function parseScheduledAt(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function POST(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.leads", scopeCtx);
    if (permResp) return permResp;

    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const customer = await Crm.getCustomerWithCars(id);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    const carLink = (customer.cars ?? []).find((item: any) => item?.car?.id === parsed.data.carId);
    const car = carLink?.car ?? null;
    if (!car) return NextResponse.json({ error: "Car not found" }, { status: 404 });

    const sql = getSql();
    const existing =
      await sql/* sql */ `
        SELECT id, lead_status
        FROM leads
        WHERE company_id = ${companyId}
          AND customer_id = ${customer.id}
          AND car_id = ${car.id}
          AND lead_status NOT IN ('closed', 'lost', 'closed_won')
        LIMIT 1
      `;
    if (existing?.[0]) {
      return NextResponse.json(
        {
          error: "An open lead already exists for this customer car. Close it before creating a new one.",
          leadId: existing[0].id,
          leadStatus: existing[0].lead_status,
        },
        { status: 409 }
      );
    }

    if (parsed.data.action === "car_in") {
      const serviceType: ServiceRequestType | null = parsed.data.serviceType ?? null;
      if (!serviceType) {
        return NextResponse.json(
          { error: "serviceType is required for walk-in service requests" },
          { status: 400 }
        );
      }
      const remarks = parsed.data.remarks?.trim() || null;
      const lead = await createLead({
        companyId,
        customerId: customer.id,
        carId: car.id,
        leadType: "workshop",
        leadStage: "new",
        source: "walk_in",
        serviceType,
      });
      if (remarks) {
        await updateLeadPartial(companyId, lead.id, { agentRemark: remarks });
      }
      await appendLeadEvent({
        companyId,
        leadId: lead.id,
        eventType: "lead_created",
        eventPayload: { remarks, serviceType, source: "customer_car_select" },
      });
      return NextResponse.json({ data: lead }, { status: 201 });
    }

    const appointmentAt = parsed.data.appointmentAt ?? null;
    if (!appointmentAt) {
      return NextResponse.json({ error: "appointmentAt is required" }, { status: 400 });
    }
    const scheduledAt = parseScheduledAt(appointmentAt);
    if (!scheduledAt) {
      return NextResponse.json({ error: "appointmentAt is invalid" }, { status: 400 });
    }
    const appointmentType = parsed.data.appointmentType ?? "walkin";
    const remarks = parsed.data.remarks?.trim() || null;
    const currentUserId = await getCurrentUserIdFromRequest(req);

    if (appointmentType === "recovery") {
      const pickupLocation = (parsed.data.pickupLocation ?? "").trim();
      const dropoffLocation = (parsed.data.dropoffLocation ?? "").trim();
      if (!pickupLocation || !dropoffLocation) {
        return NextResponse.json(
          { error: "pickupLocation and dropoffLocation are required for recovery appointments" },
          { status: 400 }
        );
      }
      const recoveryType = parsed.data.recoveryType ?? "pickup";
      const lead = await createLead({
        companyId,
        customerId: customer.id,
        carId: car.id,
        leadType: "recovery",
        leadStage: "new",
        serviceType: "recovery",
        source: "walk_in",
      });
      const bookingRows = await sql/* sql */ `
        INSERT INTO lead_bookings (
          company_id,
          lead_id,
          booking_kind,
          scheduled_at,
          pickup_location,
          dropoff_location,
          notes,
          priority,
          status,
          created_by_user_id
        )
        VALUES (
          ${companyId},
          ${lead.id},
          ${"recovery"},
          ${scheduledAt},
          ${pickupLocation},
          ${dropoffLocation},
          ${remarks},
          ${"medium"},
          ${"active"},
          ${currentUserId ?? null}
        )
        ON CONFLICT (lead_id, booking_kind)
        WHERE status = 'active'
        DO UPDATE SET
          scheduled_at = EXCLUDED.scheduled_at,
          pickup_location = EXCLUDED.pickup_location,
          dropoff_location = EXCLUDED.dropoff_location,
          notes = EXCLUDED.notes,
          priority = EXCLUDED.priority,
          created_by_user_id = EXCLUDED.created_by_user_id,
          updated_at = now()
        RETURNING id
      `;
      const bookingId = String(bookingRows?.[0]?.id ?? "").trim() || null;
      const flow = await dispatchLeadBookingFlow({
        companyId,
        leadId: lead.id,
        lead: {
          id: lead.id,
          carId: (lead as any).carId ?? null,
          customerId: (lead as any).customerId ?? null,
          branchId: (lead as any).branchId ?? null,
          workshopVisitMode: "recovery",
        },
        bookingKind: "recovery",
        scheduledAt,
        pickupLocation,
        dropoffLocation,
        notes: remarks,
      });
      if (remarks) {
        await updateLeadPartial(companyId, lead.id, { agentRemark: remarks });
      }
      await appendLeadEvent({
        companyId,
        leadId: lead.id,
        eventType: "appointment_created",
        eventPayload: {
          appointmentAt,
          appointmentType,
          recoveryType,
          bookingId,
          recoveryRequestId: flow.recoveryRequestId,
          remarks,
          source: "customer_car_select",
        },
      });
      return NextResponse.json(
        { data: lead, meta: { bookingId, recoveryRequestId: flow.recoveryRequestId } },
        { status: 201 }
      );
    }

    const lead = await createLead({
      companyId,
      customerId: customer.id,
      carId: car.id,
      leadType: "workshop",
      leadStage: "new",
      source: "walk_in",
    });
    const bookingRows = await sql/* sql */ `
      INSERT INTO lead_bookings (
        company_id,
        lead_id,
        booking_kind,
        scheduled_at,
        notes,
        priority,
        status,
        created_by_user_id
      )
      VALUES (
        ${companyId},
        ${lead.id},
        ${"workshop_walkin"},
        ${scheduledAt},
        ${remarks},
        ${"medium"},
        ${"active"},
        ${currentUserId ?? null}
      )
      ON CONFLICT (lead_id, booking_kind)
      WHERE status = 'active'
      DO UPDATE SET
        scheduled_at = EXCLUDED.scheduled_at,
        notes = EXCLUDED.notes,
        priority = EXCLUDED.priority,
        created_by_user_id = EXCLUDED.created_by_user_id,
        updated_at = now()
      RETURNING id
    `;
    const bookingId = String(bookingRows?.[0]?.id ?? "").trim() || null;
    const flow = await dispatchLeadBookingFlow({
      companyId,
      leadId: lead.id,
      lead: {
        id: lead.id,
        carId: (lead as any).carId ?? null,
        customerId: (lead as any).customerId ?? null,
        branchId: (lead as any).branchId ?? null,
        workshopVisitMode: "walkin",
      },
      bookingKind: "workshop_walkin",
      scheduledAt,
      notes: remarks,
    });
    if (remarks) {
      await updateLeadPartial(companyId, lead.id, { agentRemark: remarks });
    }
    await appendLeadEvent({
      companyId,
      leadId: lead.id,
        eventType: "appointment_created",
      eventPayload: {
        appointmentAt,
        appointmentType,
        remarks,
        bookingId,
        preInspectionFormId: flow.preInspectionFormId,
        inspectionId: flow.inspectionId,
        source: "customer_car_select",
      },
    });
    return NextResponse.json(
      { data: lead, meta: { bookingId, preInspectionFormId: flow.preInspectionFormId, inspectionId: flow.inspectionId } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/customers/[id]/cars/select error:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
