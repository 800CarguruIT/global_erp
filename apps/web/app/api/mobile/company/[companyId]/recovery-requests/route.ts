import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const normalizeDateValue = (raw?: string | null, endOfDay = false) => {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  if (!raw.includes("T")) {
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
  }
  return date;
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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const includeVerified =
      req.nextUrl.searchParams.get("includeVerified") === "true";
    const query = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const type = req.nextUrl.searchParams.get("type")?.trim().toLowerCase() ?? "";
    const fromDate = normalizeDateValue(
      req.nextUrl.searchParams.get("from"),
      false,
    );
    const toDate = normalizeDateValue(req.nextUrl.searchParams.get("to"), true);

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
      WHERE l.company_id = ${companyId}
        AND (${includeVerified} = true OR rr.verified_at IS NULL)
        AND (${fromDate === null} = true OR rr.created_at >= ${fromDate})
        AND (${toDate === null} = true OR rr.created_at <= ${toDate})
      ORDER BY rr.created_at DESC
    `;

    const data = (rows ?? []).map(mapRow).filter((row: any) => {
      if (type && type !== "all") {
        const rowType = String(row?.type ?? "").trim().toLowerCase();
        if (rowType !== type) return false;
      }
      if (!query) return true;
      const haystack = [
        row.id,
        row.leadId,
        row.customerName,
        row.customerPhone,
        row.carPlateNumber,
        row.carMake,
        row.carModel,
        row.pickupLocation,
        row.dropoffLocation,
        row.status,
        row.stage,
        row.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    return createMobileSuccessResponse({ requests: data });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/recovery-requests error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const payload = await req.json().catch(() => ({}));
    const leadId = String(payload?.leadId ?? "").trim();
    const pickupLocation =
      payload?.pickupLocation != null ? String(payload.pickupLocation) : null;
    const dropoffLocation =
      payload?.dropoffLocation != null ? String(payload.dropoffLocation) : null;
    const type =
      String(payload?.type ?? "dropoff").trim().toLowerCase() === "pickup"
        ? "pickup"
        : "dropoff";
    const scheduledAt =
      payload?.scheduledAt != null ? String(payload.scheduledAt) : null;
    const remarks =
      payload?.remarks != null ? String(payload.remarks).trim() : null;

    if (!leadId) {
      return createMobileErrorResponse("leadId is required", 400);
    }
    if (type === "dropoff" && !dropoffLocation?.trim()) {
      return createMobileErrorResponse("dropoffLocation is required", 400);
    }

    const sql = getSql();
    const leadRows = await sql`
      SELECT id
      FROM leads
      WHERE id = ${leadId}
        AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!leadRows?.[0]) {
      return createMobileErrorResponse("Lead not found", 404);
    }

    const rows = await sql`
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
        ${pickupLocation ?? null},
        ${dropoffLocation ?? null},
        ${type},
        ${remarks},
        ${scheduledAt}
      )
      RETURNING id
    `;
    const id = rows?.[0]?.id ?? null;
    if (!id) {
      return createMobileErrorResponse("Failed to create recovery request", 500);
    }
    return createMobileSuccessResponse({ id }, 201);
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/recovery-requests error:",
      error,
    );
    return handleMobileError(error);
  }
}
