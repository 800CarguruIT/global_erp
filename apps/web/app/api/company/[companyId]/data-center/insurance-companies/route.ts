import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/server";

type ParamsCtx = { params: Promise<{ companyId: string }> };

function getCurrentUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  const userId = getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  const sql = getSql();
  const normRows = <T,>(r: T[] | { rows: T[] }): T[] => Array.isArray(r) ? r : r.rows ?? [];

  // Try customers.insurance_name first
  const rows = normRows(await sql<Array<{ insurance_name: string; count: number }>>`
    SELECT
      TRIM(c.insurance_name) AS insurance_name,
      COUNT(*)::int AS count
    FROM customers c
    WHERE c.company_id = ${companyId}
      AND c.insurance_name IS NOT NULL
      AND TRIM(c.insurance_name) <> ''
      AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')
    GROUP BY TRIM(c.insurance_name)
    ORDER BY count DESC, insurance_name ASC
  `);

  // Fallback: query insurance_data table if no results from customers
  if (rows.length === 0) {
    try {
      const fallback = normRows(await sql<Array<{ insurance_name: string; count: number }>>`
        SELECT
          TRIM(id.insurance_name) AS insurance_name,
          COUNT(DISTINCT id.phone)::int AS count
        FROM insurance_data id
        WHERE id.company_id = ${companyId}
          AND id.insurance_name IS NOT NULL
          AND TRIM(id.insurance_name) <> ''
        GROUP BY TRIM(id.insurance_name)
        ORDER BY count DESC, insurance_name ASC
      `);
      return NextResponse.json({
        data: fallback.map((r) => ({ name: r.insurance_name, count: r.count })),
      });
    } catch {
      // insurance_data table may not exist
    }
  }

  return NextResponse.json({
    data: rows.map((r) => ({ name: r.insurance_name, count: r.count })),
  });
}
