import { NextRequest } from "next/server";
import { z } from "zod";
import { Crm } from "@repo/ai-core";
import {
  appendLeadEvent,
  createLead,
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

type Params = { params: Promise<{ companyId: string; customerId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, customerId } = await params;
    if (!companyId || !customerId) {
      return createMobileErrorResponse("companyId and customerId are required", 400);
    }

    await ensureCompanyAccess(userId, companyId);

    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const customer = await Crm.getCustomerWithCars(customerId);
    if (!customer) {
      return createMobileErrorResponse("Customer not found", 404);
    }
    if (customer.company_id !== companyId) {
      return createMobileErrorResponse("Forbidden", 403);
    }

    const carLink = (customer.cars ?? []).find((item: any) => item?.car?.id === parsed.data.carId);
    const car = carLink?.car ?? null;
    if (!car) {
      return createMobileErrorResponse("Car not found", 404);
    }

    const sql = getSql();
    const existing =
      await sql`
        SELECT id, lead_status
        FROM leads
        WHERE company_id = ${companyId}
          AND customer_id = ${customer.id}
          AND car_id = ${car.id}
          AND lead_status NOT IN ('closed', 'lost', 'closed_won')
        LIMIT 1
      `;
    if (existing?.[0]) {
      return createMobileErrorResponse(
        "An open lead already exists for this customer car. Close it before creating a new one.",
        409,
        {
          leadId: existing[0].id,
          leadStatus: existing[0].lead_status,
        }
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
      return createMobileSuccessResponse({ lead }, 201);
    }

    const appointmentAt = parsed.data.appointmentAt ?? null;
    if (!appointmentAt) {
      return createMobileErrorResponse("appointmentAt is required", 400);
    }
    const appointmentType = parsed.data.appointmentType ?? "walkin";
    const remarks = parsed.data.remarks?.trim() || null;

    if (appointmentType === "recovery") {
      const pickupLocation = (parsed.data.pickupLocation ?? "").trim();
      const dropoffLocation = (parsed.data.dropoffLocation ?? "").trim();
      if (!pickupLocation || !dropoffLocation) {
        return createMobileErrorResponse(
          "pickupLocation and dropoffLocation are required for recovery appointments",
          400
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
        await sql`
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
      return createMobileSuccessResponse({ lead }, 201);
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
    return createMobileSuccessResponse({ lead }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/customers/[customerId]/cars/select error:",
      error
    );
    return handleMobileError(error);
  }
}
