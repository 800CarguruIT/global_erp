import { NextRequest, NextResponse } from "next/server";
import { getSql, Monitoring } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../lib/auth/permissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get("scope") ?? "global") as "global" | "company" | "branch" | "vendor";
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 100;

    const permResp = await requirePermission(
      req,
      "monitoring.view",
      buildScopeContextFromRoute({ companyId, branchId, vendorId }, scope)
    );
    if (permResp) return permResp;

    const sql = getSql();
    const rows = await sql<{
      id: string;
      email: string;
      employee_company_id: string | null;
      employee_branch_id: string | null;
      employee_vendor_id: string | null;
      risk_level: string | null;
      overall_risk_score: number | null;
      last_login_at: string | null;
    }[]>`
      SELECT
        u.id,
        u.email,
        e.company_id as employee_company_id,
        NULL::uuid as employee_branch_id,
        NULL::uuid as employee_vendor_id,
        r.risk_level,
        r.overall_risk_score,
        r.last_login_at
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      LEFT JOIN user_risk_profiles r ON r.user_id = u.id
      WHERE
        (${scope} = 'global')
        OR (${scope} = 'company' AND e.company_id = ${companyId ?? null})
        OR (${scope} = 'branch' AND e.company_id = ${companyId ?? null} AND e.branch_id = ${branchId ?? null})
        OR (${scope} = 'vendor' AND e.company_id = ${companyId ?? null} AND e.vendor_id = ${vendorId ?? null})
      ORDER BY u.email
      LIMIT ${limit}
    `;

    return NextResponse.json({
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        risk_level: r.risk_level,
        risk_score: r.overall_risk_score,
        last_login_at: r.last_login_at,
      })),
    });
  } catch (error) {
    console.error("GET /api/monitoring/users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}
