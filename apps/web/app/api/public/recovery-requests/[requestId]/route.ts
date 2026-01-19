import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";

type Params = { params: { requestId: string } | Promise<{ requestId: string }> };

const payloadSchema = z.object({
  companyId: z.string().min(1),
  action: z.enum([
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
  ]),
  agentName: z.string().optional(),
  agentPhone: z.string().optional(),
  agentCarPlate: z.string().optional(),
  pickupFromCustomer: z.boolean().optional(),
  pickupVideo: z.string().optional(),
  pickupRemarks: z.string().optional(),
  dropoffVideo: z.string().optional(),
  dropoffRemarks: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: Params) {
  const { requestId } = await Promise.resolve(params);
  const companyId = req.nextUrl.searchParams.get("companyId") ?? "";
  if (!requestId || !companyId) {
    return NextResponse.json({ error: "requestId and companyId are required" }, { status: 400 });
  }
  const sql = getSql();
  const rows =
    await sql/* sql */ `
      SELECT rr.*, l.company_id
      FROM recovery_requests rr
      JOIN leads l ON l.id = rr.lead_id
      WHERE rr.id = ${requestId} AND l.company_id = ${companyId}
      LIMIT 1
    `;
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: row });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { requestId } = await Promise.resolve(params);
  const json = await req.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }
  const { companyId, action } = parsed.data;
  const sql = getSql();
  const rows =
    await sql/* sql */ `
      SELECT rr.*, l.company_id
      FROM recovery_requests rr
      JOIN leads l ON l.id = rr.lead_id
      WHERE rr.id = ${requestId} AND l.company_id = ${companyId}
      LIMIT 1
    `;
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date().toISOString();

  switch (action) {
    case "save_agent":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          agent_name = ${parsed.data.agentName ?? row.agent_name ?? null},
          agent_phone = ${parsed.data.agentPhone ?? row.agent_phone ?? null},
          agent_car_plate = ${parsed.data.agentCarPlate ?? row.agent_car_plate ?? null},
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "accept":
      await sql/* sql */ `
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
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          stage = 'Reached',
          pickup_reached_at = COALESCE(pickup_reached_at, ${now}),
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "set_pickup_from_customer":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          pickup_from_customer = ${parsed.data.pickupFromCustomer ?? false},
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "share_terms":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          pickup_from_customer = TRUE,
          pickup_terms_shared_at = COALESCE(pickup_terms_shared_at, ${now}),
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "confirm_terms":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          pickup_terms_confirmed_at = COALESCE(pickup_terms_confirmed_at, ${now}),
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "upload_pickup":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          pickup_video = ${parsed.data.pickupVideo ?? row.pickup_video ?? null},
          pickup_remarks = ${parsed.data.pickupRemarks ?? row.pickup_remarks ?? null},
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "pickup_done":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          stage = 'Picked Up',
          pickup_completed_at = COALESCE(pickup_completed_at, ${now}),
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "reach_dropoff":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          dropoff_reached_at = COALESCE(dropoff_reached_at, ${now}),
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "upload_dropoff":
      await sql/* sql */ `
        UPDATE recovery_requests
        SET
          dropoff_video = ${parsed.data.dropoffVideo ?? row.dropoff_video ?? null},
          dropoff_remarks = ${parsed.data.dropoffRemarks ?? row.dropoff_remarks ?? null},
          updated_at = now()
        WHERE id = ${requestId}
      `;
      break;
    case "dropoff_done":
      await sql/* sql */ `
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
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const refreshed =
    await sql/* sql */ `
      SELECT rr.*, l.company_id
      FROM recovery_requests rr
      JOIN leads l ON l.id = rr.lead_id
      WHERE rr.id = ${requestId} AND l.company_id = ${companyId}
      LIMIT 1
    `;
  return NextResponse.json({ data: refreshed?.[0] ?? null });
}
