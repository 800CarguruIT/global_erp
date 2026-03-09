import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

type BucketKey = "pre_pickup" | "work_progress" | "happiness_check";

function bucketFromRow(row: any): BucketKey {
  const status = String(row.status ?? "").toLowerCase();
  const stage = String(row.stage ?? "").toLowerCase();
  if (status === "done" || stage === "dropped off") return "happiness_check";
  if (stage === "picked up") return "work_progress";
  return "pre_pickup";
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "jobs.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const sql = getSql();
    const rows = await sql<any[]>`
      SELECT
        rr.id,
        rr.lead_id,
        rel.related_lead_id,
        rr.type,
        rr.status,
        rr.stage,
        rr.scheduled_at,
        rr.created_at,
        rr.updated_at,
        rr.pickup_location,
        rr.dropoff_location,
        rr.remarks,
        rr.agent_name,
        rr.agent_phone,
        rr.agent_car_plate,
        c.name AS customer_name,
        c.phone AS customer_phone,
        car.plate_number AS car_plate_number,
        car.make AS car_make,
        car.model AS car_model,
        CASE
          WHEN f.status = 'submitted' THEN TRUE
          ELSE FALSE
        END AS form_submitted,
        f.status AS form_status,
        f.token AS form_token
      FROM recovery_requests rr
      JOIN leads l ON l.id = rr.lead_id
      LEFT JOIN LATERAL (
        SELECT lw.id AS related_lead_id
        FROM leads lw
        WHERE lw.company_id = l.company_id
          AND lw.id <> l.id
          AND lw.lead_type = 'workshop'
          AND lw.customer_id IS NOT DISTINCT FROM l.customer_id
          AND lw.car_id IS NOT DISTINCT FROM l.car_id
        ORDER BY ABS(EXTRACT(EPOCH FROM (lw.created_at - l.created_at))) ASC
        LIMIT 1
      ) rel ON TRUE
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      LEFT JOIN pre_inspection_form_requests f
        ON f.lead_id = l.id
       AND f.appointment_type = 'recovery'
      WHERE l.company_id = ${companyId}
      ORDER BY COALESCE(rr.scheduled_at, rr.created_at) DESC
      LIMIT 500
    `;

    const list = rows.map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      relatedLeadId: row.related_lead_id ?? null,
      appointmentAt: row.scheduled_at ?? row.created_at ?? null,
      recoveryDriver: [row.agent_name, row.agent_phone].filter(Boolean).join(" | ") || "-",
      customerDetails: [row.customer_name, row.customer_phone].filter(Boolean).join(" | ") || "-",
      carDetails: [row.car_plate_number, row.car_make, row.car_model].filter(Boolean).join(" | ") || "-",
      type: row.type ?? null,
      status: row.status ?? null,
      stage: row.stage ?? null,
      pickupLocation: row.pickup_location ?? null,
      dropoffLocation: row.dropoff_location ?? null,
      formSubmitted: Boolean(row.form_submitted),
      formStatus: row.form_status ?? null,
      formToken: row.form_token ?? null,
      formUrl: row.form_token ? `/pre-inspection/${encodeURIComponent(String(row.form_token))}` : null,
      callRemarks: row.remarks ?? null,
      bucket: bucketFromRow(row),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    }));

    const counts = {
      pre_pickup: list.filter((r) => r.bucket === "pre_pickup").length,
      work_progress: list.filter((r) => r.bucket === "work_progress").length,
      happiness_check: list.filter((r) => r.bucket === "happiness_check").length,
    };

    return NextResponse.json({ data: list, counts });
  } catch (error) {
    console.error("GET /api/company/[companyId]/recovery-requests/cc error:", error);
    return NextResponse.json({ error: "Failed to load recovery CC dashboard" }, { status: 500 });
  }
}
