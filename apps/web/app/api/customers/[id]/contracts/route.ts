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
        sc.id,
        sc.status,
        sc.contract_type,
        sc.minor_quota,
        sc.major_quota,
        sc.package_price,
        sc.final_amount,
        sc.sold_at,
        sc.payment_mode,
        sc.advisor_name,
        COALESCE(car.plate_number, sc.car_plate) AS car_plate,
        sc.notes,
        sc.created_at,
        p.name  AS package_name,
        p.code  AS package_code,
        p.plan_type,
        p.cylinder,
        p.mileage_limit,
        p.minor_count,
        p.major_count,
        COUNT(e.id) FILTER (WHERE e.service_kind = 'minor' AND e.status = 'done')::int AS minor_used,
        COUNT(e.id) FILTER (WHERE e.service_kind = 'major' AND e.status = 'done')::int AS major_used,
        COALESCE(
          json_agg(
            json_build_object(
              'id',               e.id,
              'service_kind',     e.service_kind,
              'sequence_no',      e.sequence_no,
              'status',           e.status,
              'planned_mileage',  e.planned_mileage,
              'planned_date',     e.planned_date,
              'consumed_mileage', e.consumed_mileage,
              'consumed_at',      e.consumed_at
            ) ORDER BY e.service_kind, e.sequence_no
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) AS entitlements
      FROM service_contracts sc
      LEFT JOIN service_contract_packages p ON p.id = sc.package_id
      LEFT JOIN cars car ON car.id = sc.car_id
      LEFT JOIN service_contract_entitlements e ON e.contract_id = sc.id
      WHERE sc.company_id = ${companyId}
        AND sc.customer_id = ${id}
      GROUP BY sc.id, p.name, p.code, p.plan_type, p.cylinder, p.mileage_limit, p.minor_count, p.major_count, car.plate_number
      ORDER BY sc.created_at DESC
      LIMIT 200
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/customers/[id]/contracts error:", error);
    return NextResponse.json({ error: "Failed to load customer contracts" }, { status: 500 });
  }
}
