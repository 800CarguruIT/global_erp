import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const sql = getSql();
    const rows = await sql`
      WITH global_invoices AS (
        SELECT
          i.id,
          i.estimate_id,
          i.invoice_number,
          i.invoice_date,
          i.status,
          i.payment_method,
          CASE
            WHEN i.paid_at IS NOT NULL OR LOWER(COALESCE(i.status, '')) IN ('paid', 'completed')
              THEN 'paid'
            ELSE 'unpaid'
          END AS payment_status,
          i.grand_total,
          i.paid_at,
          i.created_at,
          i.updated_at,
          c.plate_number AS car_plate,
          NULL::text AS advisor_name,
          'global_erp'::text AS source,
          '/api/company/' || i.company_id::text || '/workshop/invoices/' || i.id::text || '/print' AS print_url,
          '/company/' || i.company_id::text || '/workshop/invoices/' || i.id::text AS action_url
        FROM invoices i
        LEFT JOIN cars c ON c.id = i.car_id
        WHERE i.company_id = ${companyId}
          AND i.customer_id = ${id}
      ),
      legacy_invoiced_estimates AS (
        SELECT
          e.id,
          e.id AS estimate_id,
          COALESCE(
            NULLIF(e.meta->>'legacy_invoice_number', ''),
            CASE
              WHEN NULLIF(e.meta->>'legacy_estimate_id', '') IS NOT NULL
                THEN 'CG-INV-' || LPAD(e.meta->>'legacy_estimate_id', 9, '0')
              ELSE NULL
            END,
            'LEGACY-' || LEFT(e.id::text, 8)
          ) AS invoice_number,
          e.invoice_date AS invoice_date,
          COALESCE(NULLIF(e.invoice_status, ''), e.status, 'invoiced') AS status,
          e.payment_method,
          CASE
            WHEN LOWER(COALESCE(e.payment_status, '')) = 'paid'
              OR LOWER(COALESCE(e.meta->>'legacy_invoice_status', '')) = 'paid'
              THEN 'paid'
            ELSE 'unpaid'
          END AS payment_status,
          e.grand_total,
          e.invoice_date AS paid_at,
          e.created_at,
          e.updated_at,
          c.plate_number AS car_plate,
          NULL::text AS advisor_name,
          'carguru2_estimate'::text AS source,
          '/api/company/' || e.company_id::text || '/workshop/estimates/' || e.id::text || '/invoice' AS print_url,
          '/company/' || e.company_id::text || '/estimates/' || e.id::text AS action_url
        FROM estimates e
        LEFT JOIN cars c ON c.id = e.car_id
        LEFT JOIN invoices i
          ON i.company_id = e.company_id
         AND i.estimate_id = e.id
        WHERE e.company_id = ${companyId}
          AND e.customer_id = ${id}
          AND COALESCE(e.meta->>'legacy_source', '') = 'carguru2.estimates'
          AND (
            LOWER(COALESCE(e.invoice_status, '')) = 'invoiced'
            OR LOWER(COALESCE(e.status, '')) = 'invoiced'
          )
          AND i.id IS NULL
      )
      SELECT *
      FROM (
        SELECT * FROM global_invoices
        UNION ALL
        SELECT * FROM legacy_invoiced_estimates
      ) merged
      ORDER BY merged.invoice_date DESC NULLS LAST, merged.created_at DESC
      LIMIT 1000
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/customers/[id]/invoices error:", error);
    return NextResponse.json({ error: "Failed to load customer invoices" }, { status: 500 });
  }
}
