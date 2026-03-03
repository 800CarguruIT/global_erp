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
      SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.status,
        i.payment_method,
        i.grand_total,
        i.paid_at,
        i.created_at,
        i.updated_at,
        c.plate_number AS car_plate,
        COALESCE(l.advisor, l.agent_name) AS advisor_name
      FROM invoices i
      LEFT JOIN cars c ON c.id = i.car_id
      LEFT JOIN leads l ON l.id = i.lead_id
      WHERE i.company_id = ${companyId}
        AND i.customer_id = ${id}
      ORDER BY i.invoice_date DESC NULLS LAST, i.created_at DESC
      LIMIT 1000
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/customers/[id]/invoices error:", error);
    return NextResponse.json({ error: "Failed to load customer invoices" }, { status: 500 });
  }
}

