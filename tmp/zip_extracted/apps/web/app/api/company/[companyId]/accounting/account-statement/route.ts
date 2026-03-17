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
    const accountCode = url.searchParams.get("accountCode") ?? "";
    const dateFrom = url.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const dateTo = url.searchParams.get("to") ?? dateFrom;
    if (!accountCode) {
      return NextResponse.json({ data: [], account: null, openingBalance: 0 }, { status: 200 });
    }

    const entityId = await Accounting.resolveEntityId("company", companyId);
    const sql = getSql();
    const [account] = await sql<
      Array<{
        id: string;
        account_code: string;
        account_name: string;
      }>
    >`
      SELECT id, account_code, account_name
      FROM accounting_accounts
      WHERE company_id = ${companyId} AND account_code = ${accountCode}
      LIMIT 1
    `;
    if (!account) {
      return NextResponse.json({ data: [], account: null, openingBalance: 0 }, { status: 200 });
    }

    const [openingRow] = await sql<{ opening: number }[]>`
      SELECT COALESCE(SUM(jl.debit - jl.credit), 0) AS opening
      FROM accounting_journal_lines jl
      INNER JOIN accounting_journals j ON j.id = jl.journal_id
      WHERE jl.account_id = ${account.id}
        AND jl.entity_id = ${entityId}
        AND j.date::date < ${dateFrom}
    `;
    const openingBalance = Number(openingRow?.opening ?? 0);

    const rows = await sql<
      Array<{
        id: string;
        journal_type: string | null;
        description: string | null;
        debit: number | null;
        credit: number | null;
        date: string | null;
        balance: number | null;
      }>
    >`
      SELECT
        jl.id,
        j.journal_type,
        COALESCE(j.description, jl.description) AS description,
        jl.debit,
        jl.credit,
        j.date,
        (${openingBalance}) + SUM(jl.debit - jl.credit) OVER (ORDER BY j.date, jl.id) AS balance
      FROM accounting_journal_lines jl
      INNER JOIN accounting_journals j ON j.id = jl.journal_id
      WHERE jl.account_id = ${account.id}
        AND jl.entity_id = ${entityId}
        AND j.date::date >= ${dateFrom}
        AND j.date::date <= ${dateTo}
      ORDER BY j.date, jl.id
    `;

    const [company] = await sql<{ display_name: string | null; legal_name: string | null }[]>`
      SELECT display_name, legal_name
      FROM companies
      WHERE id = ${companyId}
      LIMIT 1
    `;
    const companyName = company?.display_name || company?.legal_name || null;

    return NextResponse.json({
      account: { code: account.account_code, name: account.account_name },
      companyName,
      openingBalance,
      data: rows.map((r) => ({
        id: r.id,
        type: r.journal_type ?? "-",
        description: r.description ?? "-",
        debit: Number(r.debit ?? 0),
        credit: Number(r.credit ?? 0),
        balance: Number(r.balance ?? 0),
        date: r.date ?? new Date().toISOString().slice(0, 10),
      })),
    });
  } catch (error) {
    console.error("GET /api/company/[companyId]/accounting/account-statement error", error);
    return NextResponse.json({ data: [], account: null, openingBalance: 0 }, { status: 200 });
  }
}
