import { NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { companyId } = await params;
  const sql = getSql();
  const rows = await sql`
    WITH quote_rank AS (
      SELECT
        source.line_item_id,
        MAX(
          CASE
            WHEN LOWER(COALESCE(source.status, '')) IN ('received', 'completed') THEN 3
            WHEN LOWER(COALESCE(source.status, '')) IN ('return', 'returned') THEN 2
            WHEN LOWER(COALESCE(source.status, '')) = 'ordered' THEN 1
            ELSE 0
          END
        ) AS status_rank
      FROM (
        SELECT
          li.id AS line_item_id,
          pq.status
        FROM line_items li
        INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        WHERE li.company_id = ${companyId}
        UNION ALL
        SELECT
          ei.inspection_item_id AS line_item_id,
          pq.status
        FROM estimate_items ei
        INNER JOIN part_quotes pq ON pq.estimate_item_id = ei.id
        INNER JOIN line_items li ON li.id = ei.inspection_item_id
        WHERE li.company_id = ${companyId}
      ) source
      GROUP BY source.line_item_id
    )
    SELECT
      li.id AS line_item_id,
      li.product_name,
      li.description,
      li.quantity,
      li.status,
      li.part_ordered,
      li.order_status,
      quote_rank.status_rank,
      li.inspection_id,
      i.lead_id,
      i.car_id,
      i.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      car.plate_number,
      car.make,
      car.model,
      car.model_year,
      li.created_at,
      vendor_info.vendor_id,
      vendor_info.vendor_name,
      vendor_info.quote_status
    FROM line_items li
    JOIN inspections i ON i.id = li.inspection_id
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN cars car ON car.id = i.car_id
    LEFT JOIN quote_rank ON quote_rank.line_item_id = li.id
    LEFT JOIN LATERAL (
      SELECT
        pq.vendor_id,
        v.name AS vendor_name,
        pq.status AS quote_status
      FROM part_quotes pq
      LEFT JOIN estimate_items ei ON ei.id = pq.estimate_item_id
      LEFT JOIN estimates est ON est.id = ei.estimate_id
      INNER JOIN vendors v ON v.id = pq.vendor_id
      WHERE
        pq.company_id = ${companyId}
        AND (
          pq.line_item_id = li.id
          OR (
            est.inspection_id = li.inspection_id
            AND LOWER(COALESCE(ei.part_name, '')) = LOWER(COALESCE(li.product_name, ''))
          )
        )
      ORDER BY pq.updated_at DESC
      LIMIT 1
    ) vendor_info ON TRUE
    WHERE li.company_id = ${companyId}
      AND li.part_ordered = 1
    ORDER BY li.created_at DESC
  `;

  return NextResponse.json({
    data: rows.map((row: any) => ({
      ...row,
      order_status:
        Number(row.status_rank ?? 0) >= 3
          ? "Received"
          : Number(row.status_rank ?? 0) === 2
          ? "Returned"
          : Number(row.status_rank ?? 0) === 1
          ? "Ordered"
          : row.order_status ?? null,
      vendorId: row.vendor_id ?? null,
      vendorName: row.vendor_name ?? null,
      quoteStatus: row.quote_status ?? row.order_status ?? null,
    })),
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const { companyId } = await params;
  const body = await req.json().catch(() => ({}));
  const lineItemId = body?.lineItemId;
  const orderStatus = body?.orderStatus;
  const allowed = ["Ordered", "Received", "Returned"];

  if (!lineItemId || !allowed.includes(orderStatus)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE line_items
    SET order_status = ${orderStatus},
        updated_at = NOW()
    WHERE company_id = ${companyId} AND id = ${lineItemId}
    RETURNING id, order_status
  `;
  await sql`
    UPDATE part_quotes
    SET status = ${
      orderStatus === "Returned" ? "Return" : orderStatus
    },
        updated_at = NOW()
    WHERE company_id = ${companyId}
      AND (
        line_item_id = ${lineItemId}
        OR estimate_item_id IN (
          SELECT id FROM estimate_items WHERE inspection_item_id = ${lineItemId}
        )
      )
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id: rows[0].id, orderStatus: rows[0].order_status } });
}
