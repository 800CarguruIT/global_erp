import { createInspection, getLatestInspectionForLead } from "@repo/ai-core/workshop/inspections/repository";
import { updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import {
  createOrUpdatePreInspectionFormRequest,
  sendPreInspectionFormRequestIfPending,
} from "@/lib/pre-inspection-form";

export type BookingKind = "rsa" | "recovery" | "workshop_walkin" | "workshop_recovery";

function isRecoveryBooking(kind: BookingKind): boolean {
  return kind === "recovery" || kind === "workshop_recovery";
}

function isWorkshopWalkinBooking(kind: BookingKind): boolean {
  return kind === "workshop_walkin";
}

export async function dispatchLeadBookingFlow(args: {
  companyId: string;
  leadId: string;
  lead: {
    id: string;
    carId?: string | null;
    customerId?: string | null;
    branchId?: string | null;
    workshopVisitMode?: "walkin" | "recovery" | null;
  };
  bookingKind: BookingKind;
  scheduledAt: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  notes?: string | null;
}): Promise<{
  recoveryRequestId: string | null;
  preInspectionFormId: string | null;
  inspectionId: string | null;
}> {
  const sql = getSql();
  let recoveryRequestId: string | null = null;
  let preInspectionFormId: string | null = null;
  let inspectionId: string | null = null;

  if (isRecoveryBooking(args.bookingKind)) {
    const existingRows = await sql/* sql */ `
      SELECT id
      FROM recovery_requests
      WHERE lead_id = ${args.leadId}
        AND type = 'pickup'
        AND status <> 'Done'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const existingId = String(existingRows?.[0]?.id ?? "").trim();
    if (existingId) {
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          pickup_location = ${args.pickupLocation ?? null},
          dropoff_location = ${args.dropoffLocation ?? null},
          type = 'pickup',
          scheduled_at = ${args.scheduledAt},
          remarks = ${args.notes ?? null},
          updated_at = now()
        WHERE id = ${existingId}
      `;
      recoveryRequestId = existingId;
    } else {
      const inserted = await sql/* sql */ `
        INSERT INTO recovery_requests (
          lead_id,
          pickup_location,
          dropoff_location,
          type,
          remarks,
          scheduled_at
        )
        VALUES (
          ${args.leadId},
          ${args.pickupLocation ?? null},
          ${args.dropoffLocation ?? null},
          'pickup',
          ${args.notes ?? null},
          ${args.scheduledAt}
        )
        RETURNING id
      `;
      recoveryRequestId = String(inserted?.[0]?.id ?? "").trim() || null;
    }
  }

  if (args.bookingKind === "workshop_walkin" || args.bookingKind === "workshop_recovery") {
    const appointmentType = args.bookingKind === "workshop_recovery" ? "recovery" : "walkin";
    const form = await createOrUpdatePreInspectionFormRequest({
      companyId: args.companyId,
      leadId: args.leadId,
      appointmentType,
      appointmentAt: args.scheduledAt,
      recoveryRequestId,
    });
    preInspectionFormId = form.id;

    const appointmentAtMs = new Date(args.scheduledAt).getTime();
    if (Number.isFinite(appointmentAtMs) && appointmentAtMs - Date.now() <= 24 * 60 * 60 * 1000) {
      await sendPreInspectionFormRequestIfPending({
        formId: form.id,
        reason: "direct",
      }).catch(() => undefined);
    }
  }

  if (isWorkshopWalkinBooking(args.bookingKind)) {
    const latest = await getLatestInspectionForLead(args.companyId, args.leadId).catch(() => null);
    const latestStatus = String(latest?.status ?? "").trim().toLowerCase();
    if (!latest || latestStatus !== "pending") {
      const inspection = await createInspection({
        companyId: args.companyId,
        leadId: args.leadId,
        carId: args.lead.carId ?? null,
        customerId: args.lead.customerId ?? null,
        branchId: args.lead.branchId ?? null,
        status: "pending",
        agentRemark: args.notes ?? null,
        draftPayload: {
          source: "lead_booking_dispatch",
          bookingKind: args.bookingKind,
        },
      });
      inspectionId = inspection.id;
    } else {
      inspectionId = latest.id;
    }

    await updateLeadPartial(args.companyId, args.leadId, {
      leadStage: "inspection_queue",
      workshopVisitMode: "walkin",
    });
  } else if (args.bookingKind === "workshop_recovery") {
    await updateLeadPartial(args.companyId, args.leadId, {
      workshopVisitMode: "recovery",
    });
  }

  return {
    recoveryRequestId,
    preInspectionFormId,
    inspectionId,
  };
}
