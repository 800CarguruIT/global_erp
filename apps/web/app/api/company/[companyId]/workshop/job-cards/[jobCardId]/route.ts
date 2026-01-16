import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; jobCardId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, jobCardId } = await params;
  const sql = getSql();

  const jobRows = await sql`
    SELECT
           jc.id,
           jc.done_by,
           jc.start_at,
           jc.complete_at,
           jc.estimate_id,
           jc.lead_id,
           jc.status,
           jc.remarks,
           jc.created_at,
           jc.updated_at,
           e.inspection_id,
           e.lead_id AS estimate_lead_id,
           i.customer_id,
           i.car_id,
           COALESCE(i.customer_remark, i.draft_payload->>'customerComplain') AS customer_remark,
           COALESCE(i.inspector_remark, i.draft_payload->>'inspectorRemarks') AS inspector_remark,
           c.code AS customer_code,
           c.name AS customer_name,
           c.phone AS customer_phone,
           c.customer_type,
           car.plate_number,
           car.make,
           car.model,
           car.body_type,
           COALESCE(b.display_name, b.name, b.code) AS branch_name
    FROM job_cards jc
    LEFT JOIN estimates e ON e.id = jc.estimate_id
    LEFT JOIN inspections i ON i.id = e.inspection_id
    LEFT JOIN leads l ON l.id = e.lead_id
    LEFT JOIN branches b ON b.id = l.branch_id
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN cars car ON car.id = i.car_id
    WHERE jc.id = ${jobCardId} AND jc.estimate_id IS NOT NULL
    LIMIT 1
  `;

  if (!jobRows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jobCard = jobRows[0];
  if (jobCard && jobCard.estimate_id) {
    // ensure company scope by joining estimate
    const companyCheck = await sql`
      SELECT 1
      FROM estimates
      WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!companyCheck.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const items = await sql`
    SELECT *
    FROM line_items
    WHERE job_card_id = ${jobCardId}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ data: { jobCard, items } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, jobCardId } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "start" && body?.action !== "complete") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const sql = getSql();
  const jobRows = await sql`
    SELECT jc.*, e.inspection_id
    FROM job_cards jc
    LEFT JOIN estimates e ON e.id = jc.estimate_id
    WHERE jc.id = ${jobCardId}
    LIMIT 1
  `;
  if (!jobRows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const jobCard = jobRows[0];
  if (jobCard && jobCard.estimate_id) {
    const companyCheck = await sql`
      SELECT 1
      FROM estimates
      WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!companyCheck.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (body?.action === "start") {
    const missingMedia = await sql`
      SELECT li.id, li.product_name
      FROM line_items li
      LEFT JOIN products p ON p.id = li.product_id
      LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
      WHERE li.job_card_id = ${jobCardId}
        AND li.part_pic IS NULL
        AND (
          POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
          AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
        )
    `;

    if (missingMedia.length) {
      return NextResponse.json(
        { error: "Spare part images are required before starting." },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE job_cards
      SET start_at = NOW()
      WHERE id = ${jobCardId} AND start_at IS NULL
      RETURNING *
    `;

    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
  if (!remarks) {
    return NextResponse.json({ error: "Remarks are required before completing." }, { status: 400 });
  }

  const missingScrap = await sql`
    SELECT li.id, li.product_name
    FROM line_items li
    LEFT JOIN products p ON p.id = li.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
    WHERE li.job_card_id = ${jobCardId}
      AND li.scrap_pic IS NULL
      AND (
        POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
        AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
      )
  `;

  if (missingScrap.length) {
    return NextResponse.json(
      { error: "Spare part scrap pictures are required before completing." },
      { status: 400 }
    );
  }

  const updated = await sql`
    UPDATE job_cards
    SET complete_at = NOW(),
        status = 'Completed',
        remarks = ${remarks}
    WHERE id = ${jobCardId} AND complete_at IS NULL
    RETURNING *
  `;

  return NextResponse.json({ data: updated[0] ?? jobCard });
}
