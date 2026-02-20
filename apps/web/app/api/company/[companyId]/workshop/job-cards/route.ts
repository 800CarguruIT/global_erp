import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getEstimateWithItems } from "@repo/ai-core/workshop/estimates/repository";
import { requireUserId } from "../../../../../../lib/auth/current-user";

type Params = { params: Promise<{ companyId: string }> };

function isDbUnavailableError(err: any): boolean {
  if (!err) return false;
  if (err.code === "ECONNREFUSED") return true;
  if (Array.isArray(err.errors)) {
    return err.errors.some((entry: any) => entry?.code === "ECONNREFUSED");
  }
  return false;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
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
          wq.id AS workshop_quote_id,
          wq.status AS workshop_quote_status,
          wq.total_amount AS workshop_quote_total_amount,
          wq.currency AS workshop_quote_currency,
          wq.verified_at AS workshop_quote_verified_at,
          wq.verified_by AS workshop_quote_verified_by,
          COALESCE(b.display_name, b.name, b.code) AS branch_name,
          c.name AS customer_name,
          c.phone AS customer_phone,
          car.plate_number,
          car.make,
          car.model
        FROM job_cards jc
        LEFT JOIN estimates e ON e.id = jc.estimate_id
        LEFT JOIN leads l ON l.id = jc.lead_id
        LEFT JOIN LATERAL (
          SELECT id, status, total_amount, currency, verified_at, verified_by, approved_at, updated_at
          FROM workshop_quotes
          WHERE company_id = ${companyId}
            AND (
              job_card_id = jc.id
              OR (
                job_card_id IS NULL
                AND estimate_id = jc.estimate_id
                AND branch_id IS NOT DISTINCT FROM l.branch_id
              )
            )
          ORDER BY
            CASE
              WHEN status = 'verified' THEN 3
              WHEN status = 'accepted' THEN 2
              WHEN status = 'pending' THEN 1
              ELSE 0
            END DESC,
            approved_at DESC NULLS LAST,
            updated_at DESC NULLS LAST
          LIMIT 1
        ) wq ON TRUE
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
  } catch (err: any) {
    console.error("GET job cards failed", err);
    if (isDbUnavailableError(err)) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to load job cards" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  try {
    const userId = await requireUserId(req);
    const body = await req.json().catch(() => ({}));
    if (!body.estimateId) {
      return NextResponse.json({ error: "estimateId is required" }, { status: 400 });
    }
    const isAdd = body.isAdd === 1 || body.isAdd === "1" || body.isAdd === true ? 1 : 0;
    const requestedLineItemIds = Array.isArray(body.lineItemIds)
      ? body.lineItemIds
          .map((id: unknown) => String(id ?? "").trim())
          .filter((id: string) => /^[0-9a-f-]{36}$/i.test(id))
      : [];

    const estimateData = await getEstimateWithItems(companyId, body.estimateId);
    const estimate = estimateData?.estimate ?? null;
    if (!estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }
    if (!estimate.inspectionId) {
      return NextResponse.json({ error: "Inspection not found for estimate" }, { status: 400 });
    }

    const sql = getSql();
    const existing =
      isAdd === 1
        ? await sql`
            SELECT jc.id, jc.status
            FROM job_cards jc
            WHERE jc.estimate_id = ${body.estimateId}
              AND jc.status IN ('Pending', 'Re-Assigned')
              AND EXISTS (
                SELECT 1
                FROM line_items li
                WHERE li.job_card_id = jc.id
                  AND li.is_add = 1
              )
            LIMIT 1
          `
        : await sql`
            SELECT jc.id, jc.status
            FROM job_cards jc
            WHERE jc.estimate_id = ${body.estimateId}
              AND jc.status IN ('Pending', 'Re-Assigned')
              AND NOT EXISTS (
                SELECT 1
                FROM line_items li
                WHERE li.job_card_id = jc.id
                  AND li.is_add = 1
              )
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

    if (requestedLineItemIds.length) {
      await sql`
        UPDATE line_items
        SET job_card_id = ${jobCard.id}
        WHERE company_id = ${companyId}
          AND inspection_id = ${estimate.inspectionId}
          AND status = 'Approved'
          AND is_add = ${isAdd}
          AND job_card_id IS NULL
          AND id = ANY(${requestedLineItemIds}::uuid[])
      `;
    } else {
      await sql`
        UPDATE line_items
        SET job_card_id = ${jobCard.id}
        WHERE company_id = ${companyId}
          AND inspection_id = ${estimate.inspectionId}
          AND status = 'Approved'
          AND is_add = ${isAdd}
          AND job_card_id IS NULL
      `;
    }

    return NextResponse.json({ data: jobCard }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST job card failed", err);
    return NextResponse.json({ error: "Failed to create job card" }, { status: 500 });
  }
}
