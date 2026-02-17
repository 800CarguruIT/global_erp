import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const url = new URL(req.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
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
      li.id,
      li.product_name,
      CASE
        WHEN qr.status_rank >= 3 THEN 'Received'
        WHEN qr.status_rank = 2 THEN 'Returned'
        WHEN qr.status_rank = 1 THEN 'Ordered'
        ELSE li.order_status
      END AS order_status,
      COALESCE(p.type, p2.type) AS product_type
    FROM line_items li
    LEFT JOIN quote_rank qr ON qr.line_item_id = li.id
    LEFT JOIN products p ON p.id = li.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
    JOIN inspections i ON i.id = li.inspection_id
    WHERE li.company_id = ${companyId}
      AND i.lead_id = ${leadId}
    ORDER BY li.created_at ASC
  `;

  return NextResponse.json({ data: rows });
}
