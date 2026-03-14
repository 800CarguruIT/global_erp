import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { resolveRsaAccess, rsaErrorFromUnknown, rsaSuccess } from "../../utils";

function toLimit(value: string | null, fallback = 200): number {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 1000);
}

export async function GET(req: NextRequest) {
  try {
    const { companyId } = await resolveRsaAccess(req);
    const sql = getSql();
    const from = req.nextUrl.searchParams.get("from")?.trim() || null;
    const to = req.nextUrl.searchParams.get("to")?.trim() || null;
    const limit = toLimit(req.nextUrl.searchParams.get("limit"), 200);

    const rows = await sql /* sql */ `
      WITH rsa_quotes AS (
        SELECT
          pq.id,
          pq.vendor_id,
          v.name AS vendor_name,
          pq.status,
          pq.updated_at,
          CASE
            WHEN LOWER(COALESCE(li.approved_type, '')) = 'oem' THEN COALESCE(pq.oem, 0)
            WHEN LOWER(COALESCE(li.approved_type, '')) = 'oe' THEN COALESCE(pq.oe, 0)
            WHEN LOWER(COALESCE(li.approved_type, '')) = 'aftm' THEN COALESCE(pq.aftm, 0)
            WHEN LOWER(COALESCE(li.approved_type, '')) = 'used' THEN COALESCE(pq.used, 0)
            ELSE COALESCE(pq.oem, pq.oe, pq.aftm, pq.used, 0)
          END AS quote_amount
        FROM part_quotes pq
        LEFT JOIN line_items li ON li.id = pq.line_item_id
        LEFT JOIN estimates est ON est.id = pq.estimate_id
        LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
        LEFT JOIN leads lead_ref
          ON lead_ref.id = COALESCE(est.lead_id, li_inspection.lead_id)
          AND lead_ref.company_id = pq.company_id
        LEFT JOIN vendors v ON v.id = pq.vendor_id
        WHERE pq.company_id = ${companyId}
          AND LOWER(COALESCE(lead_ref.lead_type, '')) = 'rsa'
          AND (${from}::timestamptz IS NULL OR pq.updated_at >= ${from}::timestamptz)
          AND (${to}::timestamptz IS NULL OR pq.updated_at <= ${to}::timestamptz)
      )
      SELECT
        vendor_id,
        COALESCE(vendor_name, 'Unknown Vendor') AS vendor_name,
        COUNT(*)::int AS quote_count,
        ROUND(COALESCE(SUM(quote_amount), 0)::numeric, 2) AS total_quoted_amount,
        ROUND(
          COALESCE(
            SUM(
              CASE
                WHEN LOWER(COALESCE(status, '')) IN ('ordered', 'received', 'completed')
                THEN quote_amount
                ELSE 0
              END
            ),
            0
          )::numeric,
          2
        ) AS realized_amount,
        MAX(updated_at) AS last_quoted_at
      FROM rsa_quotes
      GROUP BY vendor_id, vendor_name
      ORDER BY total_quoted_amount DESC, quote_count DESC
      LIMIT ${limit}
    `;

    const summary = rows.reduce(
      (
        acc: {
          vendors: number;
          quoteCount: number;
          totalQuotedAmount: number;
          realizedAmount: number;
        },
        row: any,
      ) => {
        acc.vendors += 1;
        acc.quoteCount += Number(row.quote_count ?? 0);
        acc.totalQuotedAmount += Number(row.total_quoted_amount ?? 0);
        acc.realizedAmount += Number(row.realized_amount ?? 0);
        return acc;
      },
      { vendors: 0, quoteCount: 0, totalQuotedAmount: 0, realizedAmount: 0 },
    );

    return rsaSuccess({
      rows: rows.map((row: any) => ({
        vendorId: row.vendor_id ?? null,
        vendorName: row.vendor_name ?? "Unknown Vendor",
        quoteCount: Number(row.quote_count ?? 0),
        totalQuotedAmount: Number(row.total_quoted_amount ?? 0),
        realizedAmount: Number(row.realized_amount ?? 0),
        lastQuotedAt: row.last_quoted_at ?? null,
      })),
      summary,
    });
  } catch (error) {
    return rsaErrorFromUnknown(error);
  }
}
