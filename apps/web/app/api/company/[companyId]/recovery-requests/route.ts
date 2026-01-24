import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const includeVerified = req.nextUrl.searchParams.get("includeVerified") === "true";
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;
  if (fromDate && !Number.isNaN(fromDate.getTime()) && fromParam && !fromParam.includes("T")) {
    fromDate.setHours(0, 0, 0, 0);
  }
  if (toDate && !Number.isNaN(toDate.getTime()) && toParam && !toParam.includes("T")) {
    toDate.setHours(23, 59, 59, 999);
  }
  const fromValue = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
  const toValue = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;
  const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
  const perm = await requirePermission(req, "jobs.view", scopeCtx);
  if (perm) return perm;

  try {
    const sql = getSql();
    const rows =
      await sql/* sql */ `
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
          AND (${fromValue === null} = true OR rr.created_at >= ${fromValue})
          AND (${toValue === null} = true OR rr.created_at <= ${toValue})
        ORDER BY rr.created_at DESC
      `;
      const data = (rows ?? []).map((row: any) => ({
        id: row.id,
        leadId: row.lead_id,
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
    }));
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/company/[companyId]/recovery-requests error:", error);
    return NextResponse.json({ error: "Failed to load recovery requests" }, { status: 500 });
  }
}

const createSchema = z.object({
  leadId: z.string().min(1),
  pickupLocation: z.string().optional().nullable(),
  dropoffLocation: z.string().optional().nullable(),
  type: z.enum(["pickup", "dropoff"]).optional().default("dropoff"),
  scheduledAt: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
  const perm = await requirePermission(req, "jobs.view", scopeCtx);
  if (perm) return perm;

  const payload = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const {
    leadId,
    pickupLocation,
    dropoffLocation,
    type,
    scheduledAt,
    remarks,
  } = parsed.data;

  if (!dropoffLocation && type === "dropoff") {
    return NextResponse.json({ error: "dropoffLocation is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    const leadRows =
      await sql/* sql */ `
        SELECT id
        FROM leads
        WHERE id = ${leadId}
          AND company_id = ${companyId}
        LIMIT 1
      `;
    if (!leadRows?.[0]) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const noteParts: string[] = [];
    const baseRemarks = remarks?.trim();
    if (baseRemarks) noteParts.push(baseRemarks);
    if (scheduledAt) {
      const parsedDate = new Date(scheduledAt);
      const label = Number.isNaN(parsedDate.getTime())
        ? scheduledAt
        : parsedDate.toISOString();
      noteParts.push(`Scheduled dropoff at: ${label}`);
    }
    const finalRemarks = noteParts.length ? noteParts.join("\n") : null;

    const rows =
      await sql/* sql */ `
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
          ${finalRemarks},
          ${scheduledAt ?? null}
        )
        RETURNING id
      `;
    const id = rows?.[0]?.id ?? null;
    return NextResponse.json({ data: { id } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/company/[companyId]/recovery-requests error:", error);
    return NextResponse.json({ error: "Failed to create recovery request" }, { status: 500 });
  }
}
