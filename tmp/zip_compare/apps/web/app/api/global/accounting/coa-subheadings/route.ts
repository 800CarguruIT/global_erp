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
        subhead_code: string;
        heading_id: string;
        head_code: string;
        heading_name: string;
        company_id: string | null;
        is_active: boolean;
      }>
    >`
      SELECT DISTINCT ON (h.head_code, s.subhead_code)
        s.id, s.name, s.subhead_code, s.heading_id, h.head_code, h.name as heading_name, s.company_id, s.is_active
      FROM accounting_subheadings s
      JOIN accounting_headings h ON h.id = s.heading_id
      WHERE (s.company_id IS NULL OR s.company_id = ${companyId})
      ORDER BY h.head_code, s.subhead_code, (s.company_id IS NULL)
    `;
    const data =
      rows?.map((row) => ({
        id: row.id,
        headCode: row.head_code,
        headingName: row.heading_name,
        subheadCode: row.subhead_code,
        name: row.name,
        companyId: row.company_id,
        enabled: row.is_active,
        isOverride: row.company_id !== null,
      })) ?? [];
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/global/accounting/coa-subheadings error", error);
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
    const { companyId, headCode, subheadCode, enabled } = body ?? {};
    if (!companyId || !headCode || !subheadCode || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const sql = getSql();
    const [headingRow] = await sql<
      Array<{
        id: string;
        head_code: string;
      }>
    >`
      SELECT DISTINCT ON (head_code) id, head_code
      FROM accounting_headings
      WHERE head_code = ${headCode} AND (company_id IS NULL OR company_id = ${companyId})
      ORDER BY head_code, (company_id IS NULL)
    `;
    if (!headingRow) {
      return NextResponse.json({ error: "Heading not found" }, { status: 404 });
    }

    const [globalSub] = await sql<
      Array<{
        id: string;
        name: string;
        subhead_code: string;
      }>
    >`
      SELECT s.id, s.name, s.subhead_code
      FROM accounting_subheadings s
      JOIN accounting_headings h ON h.id = s.heading_id
      WHERE h.head_code = ${headCode} AND s.subhead_code = ${subheadCode} AND s.company_id IS NULL
      LIMIT 1
    `;
    if (!globalSub) {
      return NextResponse.json({ error: "Global subheading not found" }, { status: 404 });
    }

    const [override] = await sql<
      Array<{
        id: string;
      }>
    >`
      SELECT id
      FROM accounting_subheadings
      WHERE subhead_code = ${subheadCode} AND company_id = ${companyId}
      LIMIT 1
    `;

    if (override) {
      await sql`
        UPDATE accounting_subheadings
        SET is_active = ${enabled}
        WHERE id = ${override.id}
      `;
    } else {
      await sql`
        INSERT INTO accounting_subheadings (heading_id, name, subhead_code, company_id, is_active)
        VALUES (${headingRow.id}, ${globalSub.name}, ${globalSub.subhead_code}, ${companyId}, ${enabled})
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/global/accounting/coa-subheadings error", error);
    return NextResponse.json({ error: "Failed to update subheading" }, { status: 500 });
  }
}
