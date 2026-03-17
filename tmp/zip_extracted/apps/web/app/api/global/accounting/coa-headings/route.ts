import { NextRequest, NextResponse } from "next/server";
import { getSql, Rbac } from "@repo/ai-core";
import { buildScopeContextFromRoute } from "@/lib/auth/permissions";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const context = buildScopeContextFromRoute({}, "global");
    const allowed =
      (await Rbac.checkPermission(userId, "global.admin", context)) ||
      (await Rbac.checkPermission(userId, "accounting.manage_chart", context));
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sql = getSql();
    const rows = await sql<
      Array<{
        id: string;
        name: string;
        head_code: string;
        financial_stmt: string;
        company_id: string | null;
        is_active: boolean;
      }>
    >`
      SELECT DISTINCT ON (head_code)
        id, name, head_code, financial_stmt, company_id, is_active
      FROM accounting_headings
      WHERE company_id IS NULL OR company_id = ${companyId}
      ORDER BY head_code, (company_id IS NULL)
    `;
    const data =
      rows?.map((row) => ({
        id: row.id,
        name: row.name,
        headCode: row.head_code,
        financialStmt: row.financial_stmt,
        companyId: row.company_id,
        enabled: row.is_active,
        isOverride: row.company_id !== null,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/global/accounting/coa-headings error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const context = buildScopeContextFromRoute({}, "global");
    const allowed =
      (await Rbac.checkPermission(userId, "global.admin", context)) ||
      (await Rbac.checkPermission(userId, "accounting.manage_chart", context));
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { companyId, headCode, enabled } = body ?? {};
    if (!companyId || !headCode || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const sql = getSql();
    const [globalRow] = await sql<
      Array<{
        id: string;
        name: string;
        head_code: string;
        financial_stmt: string;
      }>
    >`
      SELECT id, name, head_code, financial_stmt
      FROM accounting_headings
      WHERE head_code = ${headCode} AND company_id IS NULL
      LIMIT 1
    `;
    if (!globalRow) {
      return NextResponse.json({ error: "Global heading not found" }, { status: 404 });
    }

    const [override] = await sql<
      Array<{
        id: string;
      }>
    >`
      SELECT id
      FROM accounting_headings
      WHERE head_code = ${headCode} AND company_id = ${companyId}
      LIMIT 1
    `;

    if (override) {
      await sql`
        UPDATE accounting_headings
        SET is_active = ${enabled}
        WHERE id = ${override.id}
      `;
    } else {
      await sql`
        INSERT INTO accounting_headings (name, head_code, financial_stmt, company_id, is_active)
        VALUES (${globalRow.name}, ${globalRow.head_code}, ${globalRow.financial_stmt}, ${companyId}, ${enabled})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/global/accounting/coa-headings error", error);
    return NextResponse.json({ error: "Failed to update heading" }, { status: 500 });
  }
}
