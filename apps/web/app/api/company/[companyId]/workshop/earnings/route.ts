import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const { searchParams } = new URL(_req.url);
  const branchId = searchParams.get("branchId")?.trim() || null;
  const from = searchParams.get("from")?.trim() || null;
  const to = searchParams.get("to")?.trim() || null;
  const sourceParam = searchParams.get("source")?.trim().toLowerCase() || null;
  const source = sourceParam === "inspection" || sourceParam === "job_card" ? sourceParam : null;
  const sql = getSql();

  const rows = await sql/* sql */ `
    SELECT *
    FROM (
      SELECT
        ie.id,
        'inspection'::text AS earning_source,
        ie.inspection_id,
        NULL::uuid AS job_card_id,
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

      UNION ALL

      SELECT
        we.id,
        'job_card'::text AS earning_source,
        NULL::uuid AS inspection_id,
        we.job_card_id,
        we.branch_id,
        we.currency,
        we.amount AS gross_amount,
        we.fine_amount,
        we.amount AS net_before_vat,
        we.vat_rate,
        we.vat_amount,
        we.net_amount AS total_payable,
        we.verified_at,
        jc.start_at,
        jc.complete_at,
        c.plate_number,
        c.make,
        c.model,
        c.model_year,
        b.display_name AS branch_display_name,
        b.name AS branch_name,
        b.code AS branch_code
      FROM workshops_earnings we
      LEFT JOIN job_cards jc
        ON jc.id = we.job_card_id
      LEFT JOIN leads l
        ON l.id = COALESCE(we.lead_id, jc.lead_id)
        AND l.company_id = we.company_id
      LEFT JOIN cars c ON c.id = l.car_id
      LEFT JOIN branches b ON b.id = we.branch_id
      WHERE we.company_id = ${companyId}
        AND COALESCE(b.ownership_type, '') = 'third_party'
        AND (${branchId}::text IS NULL OR we.branch_id = ${branchId})
        AND (${from}::timestamptz IS NULL OR COALESCE(jc.complete_at, we.verified_at) >= ${from}::timestamptz)
        AND (${to}::timestamptz IS NULL OR COALESCE(jc.complete_at, we.verified_at) <= ${to}::timestamptz)
    ) earnings
    WHERE (${source}::text IS NULL OR earnings.earning_source = ${source})
    ORDER BY earnings.verified_at DESC NULLS LAST
  `;

  return NextResponse.json({ data: rows });
}
