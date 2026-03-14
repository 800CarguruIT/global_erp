import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { resolveRsaAccess, rsaErrorFromUnknown, rsaSuccess } from "../../utils";

function toBoolean(value: string | null, fallback = false): boolean {
  if (value === null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
}

function toLimit(value: string | null, fallback = 120): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

export async function GET(req: NextRequest) {
  try {
    const { userId, companyId } = await resolveRsaAccess(req);
    const sql = getSql();
    const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? null;
    const status =
      req.nextUrl.searchParams.get("status")?.trim().toLowerCase() ?? null;
    const mine = toBoolean(req.nextUrl.searchParams.get("mine"), true);
    const limit = toLimit(req.nextUrl.searchParams.get("limit"), 120);
    const assignedUserFilter = mine ? userId : null;

    const rows = await sql`
      SELECT
        l.id,
        l.source,
        l.lead_status,
        l.lead_stage,
        l.assigned_user_id,
        l.assigned_at,
        l.branch_id,
        l.created_at,
        l.updated_at,
        c.id AS customer_id,
        COALESCE(c.name, CONCAT_WS(' ', c.first_name, c.last_name), c.legal_name) AS customer_name,
        COALESCE(c.phone, c.whatsapp_phone, c.phone_alt) AS customer_phone,
        car.id AS car_id,
        car.plate_number,
        car.make,
        car.model,
        car.model_year,
        COALESCE(u.full_name, u.name, u.email) AS assigned_to_name
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      LEFT JOIN users u ON u.id = l.assigned_user_id
      WHERE l.company_id = ${companyId}
        AND LOWER(COALESCE(l.lead_type, '')) = 'rsa'
        AND (
          l.assigned_user_id IS NOT NULL
          OR l.assigned_at IS NOT NULL
          OR l.branch_id IS NOT NULL
          OR LOWER(COALESCE(l.lead_stage, '')) IN ('assigned', 'dispatched', 'enroute', 'processing', 'car_in')
        )
        AND (${assignedUserFilter}::uuid IS NULL OR l.assigned_user_id = ${assignedUserFilter})
        AND (
          ${status}::text IS NULL
          OR LOWER(COALESCE(l.lead_status, '')) = ${status}
          OR LOWER(COALESCE(l.lead_stage, '')) = ${status}
        )
        AND (
          ${q}::text IS NULL
          OR LOWER(
            CONCAT_WS(
              ' ',
              l.id::text,
              COALESCE(l.source, ''),
              COALESCE(l.lead_status, ''),
              COALESCE(l.lead_stage, ''),
              COALESCE(c.name, CONCAT_WS(' ', c.first_name, c.last_name), c.legal_name, ''),
              COALESCE(c.phone, c.whatsapp_phone, c.phone_alt, ''),
              COALESCE(car.plate_number, ''),
              COALESCE(u.full_name, u.name, u.email, '')
            )
          ) LIKE ${`%${q ?? ""}%`}
        )
      ORDER BY COALESCE(l.updated_at, l.created_at) DESC
      LIMIT ${limit}
    `;

    const leads = rows.map((row: any) => ({
      id: row.id,
      source: row.source ?? null,
      leadStatus: row.lead_status ?? null,
      leadStage: row.lead_stage ?? null,
      assignedUserId: row.assigned_user_id ?? null,
      assignedAt: row.assigned_at ?? null,
      branchId: row.branch_id ?? null,
      assignedToName: row.assigned_to_name ?? null,
      customerId: row.customer_id ?? null,
      customerName: row.customer_name ?? null,
      customerPhone: row.customer_phone ?? null,
      carId: row.car_id ?? null,
      carPlateNumber: row.plate_number ?? null,
      carMake: row.make ?? null,
      carModel: row.model ?? null,
      carModelYear: row.model_year ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    }));

    return rsaSuccess({ leads });
  } catch (error) {
    return rsaErrorFromUnknown(error);
  }
}
