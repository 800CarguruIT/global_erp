import { NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { companyId } = await params;
  const sql = getSql();
  const rows = await sql`
    SELECT
      li.id AS line_item_id,
      li.product_name,
      li.description,
      li.quantity,
      li.status,
      li.part_ordered,
      li.order_status,
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
    LEFT JOIN LATERAL (
      SELECT
        pq.vendor_id,
        v.name AS vendor_name,
        pq.status AS quote_status
      FROM part_quotes pq
      INNER JOIN estimate_items ei ON ei.id = pq.estimate_item_id
      INNER JOIN estimates est ON est.id = ei.estimate_id
      INNER JOIN vendors v ON v.id = pq.vendor_id
      WHERE
        est.company_id = ${companyId}
        AND est.inspection_id = li.inspection_id
        AND LOWER(COALESCE(ei.part_name, '')) = LOWER(COALESCE(li.product_name, ''))
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

  if (!rows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id: rows[0].id, orderStatus: rows[0].order_status } });
}
