import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string; estimateId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, vendorId, estimateId } = await params;
  if (!companyId || !estimateId) {
    return NextResponse.json({ error: "companyId and estimateId are required" }, { status: 400 });
  }

  const source = req.nextUrl.searchParams.get("source") ?? "estimate";
  if (source === "inventory") {
    const sql = getSql();
    const rows = await sql`
      SELECT
        iori.id,
        iori.part_name,
        iori.description,
        iori.quantity,
        iori.part_type,
        EXISTS(
          SELECT 1
          FROM part_quotes pq
          WHERE pq.company_id = ${companyId}
            AND pq.vendor_id = ${vendorId}
            AND pq.inventory_request_item_id = iori.id
        ) AS is_submitted
      FROM inventory_order_request_items iori
      WHERE iori.request_id = ${estimateId} AND iori.status = 'inquiry'
      ORDER BY iori.line_no ASC
    `;
    const parts = rows.map((row: any) => ({
      id: row.id,
      partName: row.part_name,
      description: row.description ?? null,
      quantity: Number(row.quantity ?? 0),
      partType: row.part_type ?? null,
      isSubmitted: Boolean(row.is_submitted),
    }));
    return NextResponse.json({ data: parts });
  }

  const sql = getSql();
  const parts = await sql`
    SELECT
      li.id,
      li.product_name AS part_name,
      li.description,
      li.quantity,
      NULL::text AS part_type,
      EXISTS(
        SELECT 1
        FROM part_quotes pq
        WHERE pq.company_id = ${companyId}
          AND pq.vendor_id = ${vendorId}
          AND pq.line_item_id = li.id
      ) AS is_submitted,
      'line_item' AS item_source
    FROM line_items li
    WHERE li.inspection_id = ${estimateId}
      AND li.company_id = ${companyId}
      AND LOWER(COALESCE(li.status, '')) IN ('inquiry', 'pending')
    ORDER BY part_name ASC
  `;

  const mapped = parts.map((row: any) => ({
    id: row.id,
    partName: row.part_name,
    description: row.description ?? null,
    quantity: Number(row.quantity ?? 0),
    partType: row.part_type ?? null,
    itemSource: "line_item",
    isSubmitted: Boolean(row.is_submitted),
  }));

  return NextResponse.json({ data: mapped });
}
