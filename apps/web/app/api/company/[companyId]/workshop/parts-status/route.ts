import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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
      ) source
      GROUP BY source.line_item_id
    ),
    normalized AS (
      SELECT
        li.*,
        i.lead_id,
        CASE
          WHEN qr.status_rank >= 3 THEN 'Received'
          WHEN qr.status_rank = 2 THEN 'Returned'
          WHEN qr.status_rank = 1 THEN 'Ordered'
          ELSE COALESCE(li.order_status, 'Pending')
        END AS normalized_order_status
      FROM line_items li
      JOIN inspections i ON i.id = li.inspection_id
      LEFT JOIN quote_rank qr ON qr.line_item_id = li.id
      WHERE li.company_id = ${companyId}
    )
    SELECT
      n.lead_id,
      COUNT(*) FILTER (WHERE n.normalized_order_status = 'Ordered') AS ordered_count,
      COUNT(*) FILTER (WHERE n.normalized_order_status = 'Received') AS received_count,
      COUNT(*) FILTER (
        WHERE n.status = 'Approved'
          AND n.normalized_order_status <> 'Received'
          AND (
            POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
            AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
          )
      ) AS approved_spare_pending_count
    FROM normalized n
    LEFT JOIN products p ON p.id = n.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(n.product_name)
    WHERE n.normalized_order_status IN ('Ordered', 'Received', 'Returned')
    GROUP BY n.lead_id
  `;

  return NextResponse.json({ data: rows });
}
