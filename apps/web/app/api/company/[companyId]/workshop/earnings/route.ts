import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(_req.url);
  const branchId = searchParams.get("branchId")?.trim() || null;
  const from = searchParams.get("from")?.trim() || null;
  const to = searchParams.get("to")?.trim() || null;
  const sql = getSql();

  const rows = await sql/* sql */ `
    SELECT
      ie.id,
      ie.inspection_id,
      ie.branch_id,
      ie.currency,
      ie.gross_amount,
      ie.fine_amount,
      ie.net_before_vat,
      ie.vat_rate,
      ie.vat_amount,
      ie.total_payable,
      ie.verified_at,
      i.start_at,
      i.complete_at,
      c.plate_number,
      c.make,
      c.model,
      c.model_year,
      b.display_name AS branch_display_name,
      b.name AS branch_name,
      b.code AS branch_code
    FROM inspection_earnings ie
    INNER JOIN inspections i
      ON i.company_id = ie.company_id
      AND i.id = ie.inspection_id
    LEFT JOIN cars c ON c.id = i.car_id
    LEFT JOIN branches b ON b.id = ie.branch_id
    WHERE ie.company_id = ${companyId}
      AND COALESCE(b.ownership_type, '') = 'third_party'
      AND (${branchId}::text IS NULL OR ie.branch_id = ${branchId})
      AND (${from}::timestamptz IS NULL OR i.complete_at >= ${from}::timestamptz)
      AND (${to}::timestamptz IS NULL OR i.complete_at <= ${to}::timestamptz)
    ORDER BY ie.verified_at DESC, ie.created_at DESC
  `;

  return NextResponse.json({ data: rows });
}
