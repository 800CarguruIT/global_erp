import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getEstimateWithItems } from "@repo/ai-core/workshop/estimates/repository";
import { requireUserId } from "../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const estimateId = url.searchParams.get("estimateId");
  const includeAll = url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";
  const sql = getSql();
  if (!estimateId) {
    const rows = await sql`
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
    `;
    return NextResponse.json({ data: rows });
  }
  if (includeAll) {
    const rows = await sql`
      SELECT *
      FROM job_cards
      WHERE estimate_id = ${estimateId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ data: rows });
  }
  const rows = await sql`
      SELECT *
      FROM job_cards
      WHERE estimate_id = ${estimateId}
        AND status IN ('Pending', 'Re-Assigned')
      LIMIT 1
    `;
  return NextResponse.json({ data: rows[0] ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    if (!body.estimateId) {
      return NextResponse.json({ error: "estimateId is required" }, { status: 400 });
    }

    const estimateData = await getEstimateWithItems(companyId, body.estimateId);
    const estimate = estimateData?.estimate ?? null;
    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }
    if (!estimate.inspectionId) {
      return NextResponse.json({ error: "Inspection not found for estimate" }, { status: 400 });
    }

    const sql = getSql();
    const existing = await sql`
      SELECT id, status
      FROM job_cards
      WHERE estimate_id = ${body.estimateId}
        AND status IN ('Pending', 'Re-Assigned')
      LIMIT 1
    `;
    if (existing.length) {
      return NextResponse.json({ error: "Job card already active" }, { status: 409 });
    }

    const createdRows = await sql`
      INSERT INTO job_cards (
        done_by,
        estimate_id,
        lead_id,
        status
      ) VALUES (
        ${userId},
        ${body.estimateId},
        ${estimate.leadId ?? null},
        'Pending'
      )
      RETURNING *
    `;
    const jobCard = createdRows[0];

    await sql`
      UPDATE line_items
      SET job_card_id = ${jobCard.id}
      WHERE inspection_id = ${estimate.inspectionId}
        AND status = 'Approved'
        AND job_card_id IS NULL
    `;

    return NextResponse.json({ data: jobCard }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST job card failed", err);
    return NextResponse.json({ error: "Failed to create job card" }, { status: 500 });
  }
}
