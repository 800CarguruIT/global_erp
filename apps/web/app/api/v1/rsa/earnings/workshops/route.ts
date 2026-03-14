import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { resolveRsaAccess, rsaErrorFromUnknown, rsaSuccess } from "../../utils";

function toLimit(value: string | null, fallback = 200): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 1000);
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await resolveRsaAccess(req);
    const sql = getSql();
    const from = req.nextUrl.searchParams.get("from")?.trim() || null;
    const to = req.nextUrl.searchParams.get("to")?.trim() || null;
    const limit = toLimit(req.nextUrl.searchParams.get("limit"), 200);

    const rows = await sql /* sql */ `
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
          ie.vat_amount,
          ie.total_payable,
          ie.verified_at,
          i.complete_at,
          l.id AS lead_id,
          l.lead_status,
          l.lead_stage,
          COALESCE(c.name, CONCAT_WS(' ', c.first_name, c.last_name), c.legal_name) AS customer_name,
          car.plate_number,
          car.make,
          car.model,
          b.display_name AS branch_display_name,
          b.name AS branch_name,
          b.code AS branch_code
        FROM inspection_earnings ie
        INNER JOIN inspections i
          ON i.company_id = ie.company_id
          AND i.id = ie.inspection_id
        INNER JOIN leads l
          ON l.company_id = ie.company_id
          AND l.id = i.lead_id
          AND LOWER(COALESCE(l.lead_type, '')) = 'rsa'
        LEFT JOIN customers c ON c.id = l.customer_id
        LEFT JOIN cars car ON car.id = l.car_id
        LEFT JOIN branches b ON b.id = ie.branch_id
        WHERE ie.company_id = ${companyId}
          AND (${from}::timestamptz IS NULL OR COALESCE(i.complete_at, ie.verified_at) >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR COALESCE(i.complete_at, ie.verified_at) <= ${to}::timestamptz)

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
          we.vat_amount,
          we.net_amount AS total_payable,
          we.verified_at,
          jc.complete_at,
          l.id AS lead_id,
          l.lead_status,
          l.lead_stage,
          COALESCE(c.name, CONCAT_WS(' ', c.first_name, c.last_name), c.legal_name) AS customer_name,
          car.plate_number,
          car.make,
          car.model,
          b.display_name AS branch_display_name,
          b.name AS branch_name,
          b.code AS branch_code
        FROM workshops_earnings we
        LEFT JOIN job_cards jc ON jc.id = we.job_card_id
        INNER JOIN leads l
          ON l.company_id = we.company_id
          AND l.id = COALESCE(we.lead_id, jc.lead_id)
          AND LOWER(COALESCE(l.lead_type, '')) = 'rsa'
        LEFT JOIN customers c ON c.id = l.customer_id
        LEFT JOIN cars car ON car.id = l.car_id
        LEFT JOIN branches b ON b.id = we.branch_id
        WHERE we.company_id = ${companyId}
          AND (${from}::timestamptz IS NULL OR COALESCE(jc.complete_at, we.verified_at) >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR COALESCE(jc.complete_at, we.verified_at) <= ${to}::timestamptz)
      ) rows
      ORDER BY COALESCE(rows.complete_at, rows.verified_at) DESC NULLS LAST
      LIMIT ${limit}
    `;

    const summary = rows.reduce(
      (
        acc: { gross: number; fines: number; vat: number; net: number },
        row: any,
      ) => {
        acc.gross += toNumber(row.gross_amount);
        acc.fines += toNumber(row.fine_amount);
        acc.vat += toNumber(row.vat_amount);
        acc.net += toNumber(row.total_payable);
        return acc;
      },
      { gross: 0, fines: 0, vat: 0, net: 0 },
    );

    return rsaSuccess({
      rows,
      summary,
    });
  } catch (error) {
    return rsaErrorFromUnknown(error);
  }
}
