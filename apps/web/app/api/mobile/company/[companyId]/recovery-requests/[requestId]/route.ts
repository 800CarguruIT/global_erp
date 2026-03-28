import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  getPendingMandatoryFormForRecoveryRequest,
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

const mapRow = (row: any) => ({
  id: row.id,
  leadId: row.lead_id ?? null,
  pickupLocation: row.pickup_location ?? null,
  dropoffLocation: row.dropoff_location ?? null,
  type: row.type ?? null,
  status: row.status ?? null,
  stage: row.stage ?? null,
  remarks: row.remarks ?? null,
  scheduledAt: row.scheduled_at ?? null,
  pickupVideo: row.pickup_video ?? null,
  pickupFrontImage: row.pickup_front_image ?? null,
  pickupRearImage: row.pickup_rear_image ?? null,
  pickupRightImage: row.pickup_right_image ?? null,
  pickupLeftImage: row.pickup_left_image ?? null,
  pickupClusterImage: row.pickup_cluster_image ?? null,
  dropoffVideo: row.dropoff_video ?? null,
  dropoffFrontImage: row.dropoff_front_image ?? null,
  dropoffRearImage: row.dropoff_rear_image ?? null,
  dropoffRightImage: row.dropoff_right_image ?? null,
  dropoffLeftImage: row.dropoff_left_image ?? null,
  dropoffClusterImage: row.dropoff_cluster_image ?? null,
  pickupRemarks: row.pickup_remarks ?? null,
  dropoffRemarks: row.dropoff_remarks ?? null,
  verificationCost: row.verification_cost ?? null,
  verificationSale: row.verification_sale ?? null,
  verifiedAt: row.verified_at ?? null,
  agentName: row.agent_name ?? null,
  agentPhone: row.agent_phone ?? null,
  agentCarPlate: row.agent_car_plate ?? null,
  assignedTo: row.assigned_to ?? null,
  acceptedAt: row.accepted_at ?? null,
  pickupReachedAt: row.pickup_reached_at ?? null,
  pickupFromCustomer: row.pickup_from_customer ?? false,
  pickupTermsSharedAt: row.pickup_terms_shared_at ?? null,
  pickupTermsConfirmedAt: row.pickup_terms_confirmed_at ?? null,
  pickupCompletedAt: row.pickup_completed_at ?? null,
  dropoffReachedAt: row.dropoff_reached_at ?? null,
  startedAt: row.started_at ?? null,
  completedAt: row.completed_at ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  customerName: row.customer_name ?? null,
  customerPhone: row.customer_phone ?? null,
  carPlateNumber: row.car_plate_number ?? null,
  carMake: row.car_make ?? null,
  carModel: row.car_model ?? null,
});

async function getRequestRow(companyId: string, requestId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      rr.*,
      l.id AS lead_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      car.plate_number AS car_plate_number,
      car.make AS car_make,
      car.model AS car_model
    FROM recovery_requests rr
    JOIN leads l ON l.id = rr.lead_id
    LEFT JOIN customers c ON c.id = l.customer_id
    LEFT JOIN cars car ON car.id = l.car_id
    WHERE rr.id = ${requestId}
      AND l.company_id = ${companyId}
    LIMIT 1
  `;
  return rows?.[0] ?? null;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const row = await getRequestRow(companyId, requestId);
    if (!row) {
      return createMobileErrorResponse("Recovery request not found", 404);
    }
    return createMobileSuccessResponse({ request: mapRow(row) });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/recovery-requests/[requestId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const payload = await req.json().catch(() => ({}));
    const row = await getRequestRow(companyId, requestId);
    if (!row) {
      return createMobileErrorResponse("Recovery request not found", 404);
    }

    const sql = getSql();
    const action = String(payload?.action ?? "").trim();

    if (action) {
      const now = new Date().toISOString();
      const supportedActions = new Set([
        "save_agent",
        "accept",
        "reach_pickup",
        "set_pickup_from_customer",
        "share_terms",
        "confirm_terms",
        "upload_pickup",
        "pickup_done",
        "reach_dropoff",
        "upload_dropoff",
        "dropoff_done",
      ]);
      if (!supportedActions.has(action)) {
        return createMobileErrorResponse("Unsupported action", 400);
      }

      const blockedUntilFormSubmitted = new Set([
        "reach_pickup",
        "set_pickup_from_customer",
        "share_terms",
        "confirm_terms",
        "upload_pickup",
        "pickup_done",
        "reach_dropoff",
        "upload_dropoff",
        "dropoff_done",
      ]);
      if (blockedUntilFormSubmitted.has(action)) {
        const pending = await getPendingMandatoryFormForRecoveryRequest({
          companyId,
          requestId,
        });
        if (pending) {
          return createMobileErrorResponse(
            "Pre-inspection form must be submitted before continuing this recovery process.",
            409,
            {
              formUrl: `/pre-inspection/${pending.token}`,
            },
          );
        }
      }

      switch (action) {
        case "save_agent":
          await sql`
            UPDATE recovery_requests
            SET
              agent_name = ${payload?.agentName ?? row.agent_name ?? null},
              agent_phone = ${payload?.agentPhone ?? row.agent_phone ?? null},
              agent_car_plate = ${payload?.agentCarPlate ?? row.agent_car_plate ?? null},
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "accept":
          await sql`
            UPDATE recovery_requests
            SET
              stage = 'Accepted',
              status = COALESCE(status, 'Pending'),
              accepted_at = COALESCE(accepted_at, ${now}),
              started_at = COALESCE(started_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "reach_pickup":
          await sql`
            UPDATE recovery_requests
            SET
              stage = 'Reached',
              pickup_reached_at = COALESCE(pickup_reached_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "set_pickup_from_customer":
          await sql`
            UPDATE recovery_requests
            SET
              pickup_from_customer = ${payload?.pickupFromCustomer ?? false},
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "share_terms":
          await sql`
            UPDATE recovery_requests
            SET
              pickup_from_customer = TRUE,
              pickup_terms_shared_at = COALESCE(pickup_terms_shared_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "confirm_terms":
          await sql`
            UPDATE recovery_requests
            SET
              pickup_terms_confirmed_at = COALESCE(pickup_terms_confirmed_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "upload_pickup":
          await sql`
            UPDATE recovery_requests
            SET
              pickup_video = ${payload?.pickupVideo ?? row.pickup_video ?? null},
              pickup_front_image = ${payload?.pickupFrontImage ?? row.pickup_front_image ?? null},
              pickup_rear_image = ${payload?.pickupRearImage ?? row.pickup_rear_image ?? null},
              pickup_right_image = ${payload?.pickupRightImage ?? row.pickup_right_image ?? null},
              pickup_left_image = ${payload?.pickupLeftImage ?? row.pickup_left_image ?? null},
              pickup_cluster_image = ${payload?.pickupClusterImage ?? row.pickup_cluster_image ?? null},
              pickup_remarks = ${payload?.pickupRemarks ?? row.pickup_remarks ?? null},
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "pickup_done":
          await sql`
            UPDATE recovery_requests
            SET
              stage = 'Picked Up',
              pickup_completed_at = COALESCE(pickup_completed_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          await sql`
            UPDATE leads
            SET
              lead_status = 'car_in',
              checkin_at = COALESCE(checkin_at, ${now}),
              updated_at = now()
            WHERE company_id = ${companyId}
              AND id = ${row.lead_id}
          `;
          break;
        case "reach_dropoff":
          await sql`
            UPDATE recovery_requests
            SET
              dropoff_reached_at = COALESCE(dropoff_reached_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "upload_dropoff":
          await sql`
            UPDATE recovery_requests
            SET
              dropoff_video = ${payload?.dropoffVideo ?? row.dropoff_video ?? null},
              dropoff_front_image = ${payload?.dropoffFrontImage ?? row.dropoff_front_image ?? null},
              dropoff_rear_image = ${payload?.dropoffRearImage ?? row.dropoff_rear_image ?? null},
              dropoff_right_image = ${payload?.dropoffRightImage ?? row.dropoff_right_image ?? null},
              dropoff_left_image = ${payload?.dropoffLeftImage ?? row.dropoff_left_image ?? null},
              dropoff_cluster_image = ${payload?.dropoffClusterImage ?? row.dropoff_cluster_image ?? null},
              dropoff_remarks = ${payload?.dropoffRemarks ?? row.dropoff_remarks ?? null},
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        case "dropoff_done":
          await sql`
            UPDATE recovery_requests
            SET
              stage = 'Dropped Off',
              status = 'Done',
              completed_at = COALESCE(completed_at, ${now}),
              updated_at = now()
            WHERE id = ${requestId}
          `;
          break;
        default:
          return createMobileErrorResponse("Unsupported action", 400);
      }

      if (action === "accept") {
        const pending = await getPendingMandatoryFormForRecoveryRequest({
          companyId,
          requestId,
        });
        if (pending) {
          await sendPreInspectionFormRequestIfPending({
            formId: pending.id,
            reason: "recovery_started",
          }).catch(() => undefined);
        }
      }

      const updatedRow = await getRequestRow(companyId, requestId);
      if (!updatedRow) {
        return createMobileErrorResponse("Recovery request not found", 404);
      }
      return createMobileSuccessResponse({ request: mapRow(updatedRow) });
    }

    const pickupLocation =
      payload?.pickupLocation != null ? String(payload.pickupLocation) : null;
    const dropoffLocation =
      payload?.dropoffLocation != null ? String(payload.dropoffLocation) : null;
    const scheduledAt =
      payload?.scheduledAt != null ? String(payload.scheduledAt) : null;
    const remarks =
      payload?.remarks != null ? String(payload.remarks).trim() : null;

    if (dropoffLocation != null && !dropoffLocation.trim()) {
      return createMobileErrorResponse("dropoffLocation is required", 400);
    }

    let rows: any[] = [];
    try {
      rows = await sql`
        UPDATE recovery_requests rr
        SET
          pickup_location = COALESCE(${pickupLocation ?? null}, rr.pickup_location),
          dropoff_location = COALESCE(${dropoffLocation ?? null}, rr.dropoff_location),
          scheduled_at = COALESCE(${scheduledAt ?? null}, rr.scheduled_at),
          remarks = COALESCE(${remarks ?? null}, rr.remarks),
          updated_at = now()
        FROM leads l
        WHERE rr.id = ${requestId}
          AND rr.lead_id = l.id
          AND l.company_id = ${companyId}
        RETURNING rr.id
      `;
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (!message.includes("scheduled_at")) {
        throw error;
      }
      rows = await sql`
        UPDATE recovery_requests rr
        SET
          pickup_location = COALESCE(${pickupLocation ?? null}, rr.pickup_location),
          dropoff_location = COALESCE(${dropoffLocation ?? null}, rr.dropoff_location),
          remarks = COALESCE(${remarks ?? null}, rr.remarks),
          updated_at = now()
        FROM leads l
        WHERE rr.id = ${requestId}
          AND rr.lead_id = l.id
          AND l.company_id = ${companyId}
        RETURNING rr.id
      `;
    }

    if (!rows?.[0]) {
      return createMobileErrorResponse("Recovery request not found", 404);
    }

    const updatedRow = await getRequestRow(companyId, requestId);
    if (!updatedRow) {
      return createMobileErrorResponse("Recovery request not found", 404);
    }

    return createMobileSuccessResponse({ request: mapRow(updatedRow) });
  } catch (error) {
    console.error(
      "PUT /api/mobile/company/[companyId]/recovery-requests/[requestId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
