import { NextRequest, NextResponse } from "next/server";
import { Accounting, getSql } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const url = new URL(req.url);
    const dateFrom = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("to") ?? dateFrom;
    const entityId = await Accounting.resolveEntityId("company", companyId);
    const sql = getSql();
    const includeDrafts = url.searchParams.get("includeDrafts") === "true";
    const postedFilter = includeDrafts
      ? sql``
      : sql`AND (j.is_posted = TRUE OR jl.journal_id IS NULL)`;
    const rows = await sql<
      Array<{
        headingName: string;
        subheadingName: string;
        groupName: string;
        accountId: string;
        accountCode: string;
        accountName: string;
        debit: number | null;
        credit: number | null;
        balance: number | null;
      }>
    >`
      SELECT
        h.name as "headingName",
        s.name as "subheadingName",
        g.name as "groupName",
        a.id as "accountId",
        a.account_code as "accountCode",
        a.account_name as "accountName",
        COALESCE(SUM(jl.debit), 0) as debit,
        COALESCE(SUM(jl.credit), 0) as credit,
        COALESCE(SUM(jl.debit - jl.credit), 0) as balance
      FROM accounting_accounts a
      JOIN accounting_groups g ON g.id = a.group_id
      JOIN accounting_subheadings s ON s.id = a.subheading_id
      JOIN accounting_headings h ON h.id = a.heading_id
      LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
        AND jl.entity_id = ${entityId}
        AND jl.created_at::date >= ${dateFrom}
        AND jl.created_at::date <= ${dateTo}
      LEFT JOIN accounting_journals j ON j.id = jl.journal_id
      WHERE a.company_id = ${companyId}
        AND (
          a.account_code LIKE '4%' OR
          a.account_code LIKE '5%'
        )
        ${postedFilter}
      GROUP BY
        h.name,
        s.name,
        g.name,
        a.id,
        a.account_code,
        a.account_name
      ORDER BY h.name, s.name, g.name, a.account_code
    `;
    const [company] = await sql<{ display_name: string | null; legal_name: string | null }[]>`
      SELECT display_name, legal_name
      FROM companies
      WHERE id = ${companyId}
      LIMIT 1
    `;
    const companyName = company?.display_name || company?.legal_name || null;
    return NextResponse.json({ data: rows ?? [], companyName });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/pnl error", error);
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
