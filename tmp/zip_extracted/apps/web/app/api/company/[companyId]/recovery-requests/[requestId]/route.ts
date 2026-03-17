import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type Params = {
  params: { companyId: string; requestId: string } | Promise<{ companyId: string; requestId: string }>;
};

const updateSchema = z.object({
  pickupLocation: z.string().optional().nullable(),
  dropoffLocation: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest, { params }: Params) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId;
  const requestId = resolved?.requestId;
  if (!companyId || !requestId) {
    return NextResponse.json({ error: "companyId and requestId are required" }, { status: 400 });
  }
  const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
  const perm = await requirePermission(req, "jobs.view", scopeCtx);
  if (perm) return perm;

  const payload = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
  }

  const { pickupLocation, dropoffLocation, scheduledAt, remarks } = parsed.data;
  if (dropoffLocation != null && !dropoffLocation.trim()) {
    return NextResponse.json({ error: "dropoffLocation is required" }, { status: 400 });
  }

  try {
    const sql = getSql();
    let rows;
    try {
      rows =
        await sql/* sql */ `
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
      if (!message.includes("scheduled_at")) throw error;
      rows =
        await sql/* sql */ `
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
      return NextResponse.json({ error: "Recovery request not found" }, { status: 404 });
    }
    return NextResponse.json({ data: { id: rows[0].id } });
  } catch (error) {
    console.error("PUT /api/company/[companyId]/recovery-requests/[requestId] error:", error);
    return NextResponse.json({ error: "Failed to update recovery request" }, { status: 500 });
  }
}
