import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
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
  dropoffVideo: row.dropoff_video ?? null,
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
  completedAt: row.completed_at ?? null,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
  customerName: row.customer_name ?? null,
  customerPhone: row.customer_phone ?? null,
  carPlateNumber: row.car_plate_number ?? null,
  carMake: row.car_make ?? null,
  carModel: row.car_model ?? null,
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, requestId } = await params;
    await ensureCompanyAccess(userId, companyId);

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
    const row = rows?.[0];
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

    const sql = getSql();
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
    return createMobileSuccessResponse({ id: rows[0].id });
  } catch (error) {
    console.error(
      "PUT /api/mobile/company/[companyId]/recovery-requests/[requestId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
