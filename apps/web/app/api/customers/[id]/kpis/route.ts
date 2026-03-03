import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "@/lib/auth/permissions";

type ParamsCtx = { params: { id: string } } | { params: Promise<{ id: string }> };

const OPEN_STATUSES = [
  "open",
  "processing",
  "pending",
  "car_in",
  "accepted",
  "inprocess",
  "assigned",
  "onboarding",
];

const COMPLETED_STATUSES = ["completed", "done", "closed_won", "closed"];

export async function GET(req: NextRequest, routeCtx: ParamsCtx) {
  try {
    const { id: customerId } = await routeCtx.params;
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId") ?? undefined;
    if (!companyId) return NextResponse.json({ error: "companyId is required" }, { status: 400 });

    const scopeCtx = buildScopeContextFromRoute({ companyId }, "company");
    const permResp = await requirePermission(req, "crm.customers.view", scopeCtx);
    if (permResp) return permResp;

    const sql = getSql();

    const rows = await sql/* sql */ `
      WITH lead_stats AS (
        SELECT
          COUNT(*)::int AS total_leads,
          COUNT(*) FILTER (WHERE lead_status = ANY(${OPEN_STATUSES}::text[]))::int AS open_leads,
          COUNT(*) FILTER (WHERE lead_status = ANY(${COMPLETED_STATUSES}::text[]))::int AS completed_leads,
          MAX(updated_at) AS last_lead_activity
        FROM leads
        WHERE company_id = ${companyId}
          AND customer_id = ${customerId}
      ),
      estimate_stats AS (
        SELECT
          COUNT(*)::int AS total_estimates,
          COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_estimates,
          COUNT(*) FILTER (WHERE status = 'finalized')::int AS finalized_estimates,
          MAX(updated_at) AS last_estimate_activity
        FROM estimates
        WHERE company_id = ${companyId}
          AND customer_id = ${customerId}
          AND (
            COALESCE(meta->>'legacy_source', '') <> 'carguru2.estimates'
            OR COALESCE(
              NULLIF(regexp_replace(COALESCE(meta->>'legacy_account_id', ''), '[^0-9-]', '', 'g'), ''),
              '0'
            )::bigint > 0
          )
      ),
      car_stats AS (
        SELECT COUNT(DISTINCT car_id)::int AS cars_linked
        FROM customer_car_links
        WHERE company_id = ${companyId}
          AND customer_id = ${customerId}
          AND is_active = true
      ),
      customer_row AS (
        SELECT wallet_amount, updated_at
        FROM customers
        WHERE id = ${customerId}
          AND company_id = ${companyId}
        LIMIT 1
      )
      SELECT
        ls.total_leads,
        ls.open_leads,
        ls.completed_leads,
        es.total_estimates,
        es.draft_estimates,
        es.finalized_estimates,
        cs.cars_linked,
        COALESCE(cr.wallet_amount, 0)::numeric(14,2) AS wallet_amount,
        GREATEST(
          COALESCE(ls.last_lead_activity, to_timestamp(0)),
          COALESCE(es.last_estimate_activity, to_timestamp(0)),
          COALESCE(cr.updated_at, to_timestamp(0))
        ) AS last_activity_at
      FROM lead_stats ls
      CROSS JOIN estimate_stats es
      CROSS JOIN car_stats cs
      CROSS JOIN customer_row cr
    `;

    const row = (rows as any)?.[0];
    if (!row) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const totalLeads = Number(row.total_leads ?? 0);
    const completedLeads = Number(row.completed_leads ?? 0);
    const completedRate = totalLeads > 0 ? Number(((completedLeads * 100) / totalLeads).toFixed(1)) : 0;

    return NextResponse.json({
      data: {
        totalLeads,
        openLeads: Number(row.open_leads ?? 0),
        completedRate,
        totalEstimates: Number(row.total_estimates ?? 0),
        draftEstimates: Number(row.draft_estimates ?? 0),
        finalizedEstimates: Number(row.finalized_estimates ?? 0),
        carsLinked: Number(row.cars_linked ?? 0),
        walletAmount: Number(row.wallet_amount ?? 0),
        lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
      },
    });
  } catch (error) {
    console.error("GET /api/customers/[id]/kpis error:", error);
    return NextResponse.json({ error: "Failed to load customer KPIs" }, { status: 500 });
  }
}
