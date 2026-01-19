import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const sql = getSql();
  const rows = await sql`
    SELECT
      i.lead_id,
      COUNT(*) FILTER (WHERE li.order_status = 'Ordered') AS ordered_count,
      COUNT(*) FILTER (WHERE li.order_status = 'Received') AS received_count,
      COUNT(*) FILTER (
        WHERE li.status = 'Approved'
          AND li.order_status <> 'Received'
          AND (
            POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
            AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
          )
      ) AS approved_spare_pending_count
    FROM line_items li
    JOIN inspections i ON i.id = li.inspection_id
    LEFT JOIN products p ON p.id = li.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
    WHERE li.company_id = ${companyId}
      AND li.order_status IN ('Ordered', 'Received', 'Returned')
    GROUP BY i.lead_id
  `;

  return NextResponse.json({ data: rows });
}
