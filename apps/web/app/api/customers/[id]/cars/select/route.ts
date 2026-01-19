import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import {
  appendLeadEvent,
  createLead,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

const payloadSchema = z.object({
  carId: z.string().min(1),
  action: z.enum(["car_in", "appointment"]),
  appointmentAt: z.string().optional().nullable(),
  appointmentType: z.enum(["walkin", "recovery"]).optional().nullable(),
  recoveryType: z.enum(["pickup", "dropoff"]).optional().nullable(),
  pickupLocation: z.string().optional().nullable(),
  dropoffLocation: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

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
      const remarks = parsed.data.remarks?.trim() || null;
      const lead = await createLead({
        companyId,
        customerId: customer.id,
        carId: car.id,
        leadType: "workshop",
        leadStage: "checkin",
        source: "walk_in",
      });
      const checkinAt = new Date().toISOString();
      await updateLeadPartial(companyId, lead.id, {
        leadStatus: "car_in",
        leadStage: "checkin",
        checkinAt,
      });
      if (remarks) {
        await updateLeadPartial(companyId, lead.id, { agentRemark: remarks });
      }
      await appendLeadEvent({
        companyId,
        leadId: lead.id,
        eventType: "car_in",
        eventPayload: { checkinAt, remarks, source: "customer_car_select" },
      });
      return NextResponse.json({ data: lead }, { status: 201 });
    }

    const appointmentAt = parsed.data.appointmentAt ?? null;
    if (!appointmentAt) {
      return NextResponse.json({ error: "appointmentAt is required" }, { status: 400 });
    }
    const appointmentType = parsed.data.appointmentType ?? "walkin";
    const remarks = parsed.data.remarks?.trim() || null;

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
      const recoveryRequestRows =
        await sql/* sql */ `
          INSERT INTO recovery_requests (
            lead_id,
            pickup_location,
            dropoff_location,
            type,
            remarks
          )
          VALUES (
            ${lead.id},
            ${pickupLocation},
            ${dropoffLocation},
            ${recoveryType},
            ${remarks}
          )
          RETURNING id
        `;
      const recoveryRequestId = recoveryRequestRows?.[0]?.id ?? null;
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
          recoveryRequestId,
          remarks,
          source: "customer_car_select",
        },
      });
      return NextResponse.json({ data: lead }, { status: 201 });
    }

    const lead = await createLead({
      companyId,
      customerId: customer.id,
      carId: car.id,
      leadType: "workshop",
      leadStage: "new",
      source: "walk_in",
    });
    if (remarks) {
      await updateLeadPartial(companyId, lead.id, { agentRemark: remarks });
    }
    await appendLeadEvent({
      companyId,
      leadId: lead.id,
      eventType: "appointment_created",
      eventPayload: { appointmentAt, appointmentType, remarks, source: "customer_car_select" },
    });
    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers/[id]/cars/select error:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
