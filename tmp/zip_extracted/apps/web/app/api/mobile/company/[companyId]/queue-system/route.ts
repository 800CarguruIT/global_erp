import { NextRequest } from "next/server";
import { listLeadsForCompany } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { listGatepassesForCompany } from "@repo/ai-core/workshop/gatepass/repository";
import { listInspectionsForCompany } from "@repo/ai-core/workshop/inspections/repository";
import { listQualityChecksForCompany } from "@repo/ai-core/workshop/qualityCheck/repository";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const lower = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const sql = getSql();
    const [leads, inspections, qcRows, gatepasses, bookings, jobCards] =
      await Promise.all([
        listLeadsForCompany(companyId),
        listInspectionsForCompany(companyId),
        listQualityChecksForCompany(companyId),
        listGatepassesForCompany(companyId),
        sql /* sql */ `
        SELECT
          lb.id,
          lb.lead_id,
          lb.booking_kind,
          lb.scheduled_at,
          lb.pickup_location,
          lb.dropoff_location,
          lb.priority,
          lb.status,
          lb.created_at,
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
          SELECT f.status, f.submitted_at, f.token
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
        ORDER BY lb.created_at DESC
      `,
        sql /* sql */ `
        SELECT
          jc.*,
          e.inspection_id,
          l.branch_id,
          COALESCE(b.display_name, b.name, b.code) AS branch_name,
          c.name AS customer_name,
          c.phone AS customer_phone,
          car.plate_number,
          car.make,
          car.model
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = jc.lead_id
        LEFT JOIN branches b ON b.id = l.branch_id
        LEFT JOIN inspections i ON i.id = e.inspection_id
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN cars car ON car.id = i.car_id
        WHERE e.company_id = ${companyId}
        ORDER BY jc.created_at DESC
      `,
      ]);

    const leadById = new Map<string, any>();
    (leads ?? []).forEach((lead: any) => {
      if (lead?.id) leadById.set(String(lead.id), lead);
    });

    const inspectionByLead = new Map<string, any>();
    (inspections ?? []).forEach((inspection: any) => {
      const leadId = String(
        inspection?.leadId ?? inspection?.lead_id ?? "",
      ).trim();
      if (leadId && !inspectionByLead.has(leadId)) {
        inspectionByLead.set(leadId, {
          id: inspection?.id ?? null,
          status: inspection?.status ?? null,
          startAt: inspection?.startAt ?? inspection?.start_at ?? null,
          branchId: inspection?.branchId ?? inspection?.branch_id ?? null,
        });
      }
    });

    const bookingByLead = new Map<string, any>();
    (bookings ?? []).forEach((row: any) => {
      const leadId = String(row?.lead_id ?? "").trim();
      if (leadId && !bookingByLead.has(leadId)) bookingByLead.set(leadId, row);
    });

    const normalizedBookings = (bookings ?? []).map((row: any) => ({
      id: row.id,
      leadId: row.lead_id,
      bookingKind: row.booking_kind,
      scheduledAt: row.scheduled_at ?? null,
      pickupLocation: row.pickup_location ?? null,
      dropoffLocation: row.dropoff_location ?? null,
      priority: row.priority ?? "medium",
      status: row.status ?? "active",
      preServiceFormStatus: row.pre_service_form_status ?? null,
      preServiceFormSubmittedAt: row.pre_service_form_submitted_at ?? null,
      preServiceFormToken: row.pre_service_form_token ?? null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      carPlateNumber: row.car_plate_number ?? null,
      carMake: row.car_make ?? null,
      carModel: row.car_model ?? null,
      createdAt: row.created_at ?? null,
    }));

    const normalizedJobCards = (jobCards ?? []).map((row: any) => ({
      id: row.id,
      leadId: row.lead_id ?? null,
      status: row.status ?? null,
      doneBy: row.done_by ?? null,
      startAt: row.start_at ?? null,
      completeAt: row.complete_at ?? null,
      finalInspectionAt: row.final_inspection_at ?? null,
      finalInspectionCarWash: row.final_inspection_car_wash ?? null,
      createdAt: row.created_at ?? null,
      branchName: row.branch_name ?? null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      plateNumber: row.plate_number ?? null,
      make: row.make ?? null,
      model: row.model ?? null,
    }));

    const normalizedGatepasses = (gatepasses ?? []).map((row: any) => ({
      id: row.id,
      invoiceId: row.invoiceId ?? row.invoice_id,
      handoverType: row.handoverType ?? row.handover_type,
      status: row.status,
      amountDue: Number(row.amountDue ?? row.amount_due ?? 0),
      paymentOk: Boolean(row.paymentOk ?? row.payment_ok),
      createdAt: row.createdAt ?? row.created_at ?? null,
    }));

    const normalizedQcRows = (qcRows ?? []).map((row: any) => ({
      id: row.id,
      workOrderId: row.workOrderId ?? row.work_order_id,
      status: row.status,
      testDriveDone: Boolean(row.testDriveDone ?? row.test_drive_done),
      washDone: Boolean(row.washDone ?? row.wash_done),
      updatedAt: row.updatedAt ?? row.updated_at ?? null,
    }));

    const checkInQueueBookings = normalizedBookings.filter((row: any) => {
      const lead = leadById.get(String(row.leadId));
      const alreadyCheckedIn =
        lower(lead?.leadStatus ?? lead?.lead_status) === "car_in";
      return (
        row.bookingKind === "workshop_walkin" &&
        lower(row.status) === "active" &&
        lower(row.preServiceFormStatus) === "submitted" &&
        !alreadyCheckedIn
      );
    });

    const bookedLeadIds = new Set(
      checkInQueueBookings.map((row: any) => String(row.leadId)),
    );
    const walkinLeads = (leads ?? []).filter((lead: any) => {
      const isWorkshopWalkin =
        lower(lead?.leadType ?? lead?.lead_type) === "workshop" &&
        lower(lead?.workshopVisitMode ?? lead?.workshop_visit_mode) ===
          "walkin";
      const alreadyCheckedIn =
        lower(lead?.leadStatus ?? lead?.lead_status) === "car_in";
      const formSubmitted =
        Boolean(
          lead?.preInspectionSubmitted ?? lead?.pre_inspection_submitted,
        ) ||
        lower(lead?.preInspectionStatus ?? lead?.pre_inspection_status) ===
          "submitted";
      return (
        isWorkshopWalkin &&
        formSubmitted &&
        !alreadyCheckedIn &&
        !bookedLeadIds.has(String(lead?.id ?? ""))
      );
    });

    const inspectionQueue = (leads ?? []).filter((lead: any) => {
      const isCheckedIn =
        lower(lead?.leadStatus ?? lead?.lead_status) === "car_in";
      if (!isCheckedIn) return false;
      const stage = lower(lead?.leadStage ?? lead?.lead_stage);
      const isInspectionPendingStage =
        stage === "checkin" || stage === "inspection_queue" || !stage;
      if (!isInspectionPendingStage) return false;
      const inspection = inspectionByLead.get(String(lead?.id ?? ""));
      if (!inspection) return true;
      return lower(inspection?.status) === "pending";
    });

    const workQueue = normalizedJobCards.filter((row: any) => {
      const status = lower(row.status);
      const isPending =
        status === "pending" || status === "re-assigned" || status === "";
      return isPending && !row.startAt;
    });

    const qualityQueue = normalizedJobCards.filter(
      (row: any) => Boolean(row.completeAt) && !row.finalInspectionAt,
    );
    const carWashQueue = normalizedJobCards.filter(
      (row: any) =>
        Boolean(row.finalInspectionAt) && row.finalInspectionCarWash !== true,
    );
    const deliveryQueue = normalizedGatepasses.filter(
      (row: any) => lower(row.status) === "pending",
    );

    return createMobileSuccessResponse({
      summary: {
        checkIn: checkInQueueBookings.length + walkinLeads.length,
        inspection: inspectionQueue.length,
        work: workQueue.length,
        quality: qualityQueue.length,
        wash: carWashQueue.length,
        delivery: deliveryQueue.length,
      },
      checkInQueue: {
        workshopWalkinBookings: checkInQueueBookings,
        walkinLeads,
      },
      inspectionQueue,
      workQueue,
      qualityQueue,
      carWashQueue,
      deliveryQueue,
      bookingByLead: Object.fromEntries(bookingByLead),
      inspectionByLead: Object.fromEntries(inspectionByLead),
      qcRows: normalizedQcRows,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/queue-system error:",
      error,
    );
    return handleMobileError(error);
  }
}
