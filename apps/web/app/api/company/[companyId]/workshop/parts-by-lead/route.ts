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
    SELECT
      li.id,
      li.product_name,
      li.order_status,
      COALESCE(p.type, p2.type) AS product_type
    FROM line_items li
    LEFT JOIN products p ON p.id = li.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
    JOIN inspections i ON i.id = li.inspection_id
    WHERE li.company_id = ${companyId}
      AND i.lead_id = ${leadId}
    ORDER BY li.created_at ASC
  `;

  return NextResponse.json({ data: rows });
}
