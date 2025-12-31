import { NextRequest, NextResponse } from "next/server";
import { Accounting, getSql } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId: rawCompanyId } = await params;
  const companyId = String(rawCompanyId || "").trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const sql = getSql();
    const entityId = await Accounting.resolveEntityId("company", companyId);
    const [entityRow] = await sql<{ id: string; base_currency?: string }[]>`
      SELECT id, base_currency
      FROM accounting_entities
      WHERE id = ${entityId} AND scope = 'company' AND company_id = ${companyId}
      LIMIT 1
    `;

    // If somehow we resolved to a non-company entity, avoid leaking global data.
    if (!entityRow) {
      return NextResponse.json({ metrics: [], entries: [] }, { status: 200 });
    }

    const [totalsRow] = await sql`
      SELECT
        COALESCE(SUM(jl.debit), 0)::numeric AS total_debit,
        COALESCE(SUM(jl.credit), 0)::numeric AS total_credit,
        COUNT(DISTINCT j.id) AS journal_count
      FROM accounting_journal_lines jl
      INNER JOIN accounting_journals j ON j.id = jl.journal_id
      WHERE jl.entity_id = ${entityId} AND jl.company_id = ${companyId}
    `;

    const balances = await sql`
      SELECT a.code, a.name, COALESCE(SUM(jl.debit - jl.credit), 0)::numeric AS balance
      FROM accounting_accounts a
      LEFT JOIN accounting_journal_lines jl
        ON jl.account_id = a.id
       AND jl.entity_id = ${entityId}
       AND jl.company_id = ${companyId}
      WHERE a.entity_id = ${entityId} AND a.code IN ('1000', '1100', '1200', '2000')
      GROUP BY a.code, a.name
    `;
    const byCode = Object.fromEntries(
      (balances as any[]).map((r) => [r.code, { name: r.name, balance: Number(r.balance ?? 0) }])
    );

    const totalDebit = Number(totalsRow?.total_debit ?? 0);
    const totalCredit = Number(totalsRow?.total_credit ?? 0);
    const journalCount = Number(totalsRow?.journal_count ?? 0);
    const cash = Number(byCode["1000"]?.balance ?? 0);
    const bank = Number(byCode["1100"]?.balance ?? 0);
    const ar = Number(byCode["1200"]?.balance ?? 0);
    const ap = Number(byCode["2000"]?.balance ?? 0);
    const available = cash + bank;
    const balance = Number((totalDebit - totalCredit).toFixed(2));
    const currency = entityRow.base_currency ?? "USD";

    const metrics = [
      { key: "balance", label: "Balance", value: balance, detail: currency },
      { key: "totalDebit", label: "Total Debit", value: Number(totalDebit.toFixed(2)), detail: currency },
      { key: "totalCredit", label: "Total Credit", value: Number(totalCredit.toFixed(2)), detail: currency },
      { key: "journalCount", label: "Journals", value: journalCount, detail: "Posted journals" },
      { key: "accountsReceivable", label: "Accounts Receivable", value: Number(ar.toFixed(2)), detail: currency },
      { key: "accountsPayable", label: "Accounts Payable", value: Number(ap.toFixed(2)), detail: currency },
      { key: "availableCash", label: "Available Balance", value: Number(available.toFixed(2)), detail: currency },
    ];

    const ledgerRows = await sql<any[]>`
      SELECT
        jl.id,
        j.date,
        COALESCE(j.description, jl.description) AS description,
        jl.debit,
        jl.credit,
        SUM(jl.debit - jl.credit) OVER (ORDER BY j.date, jl.id) AS balance
      FROM accounting_journal_lines jl
      INNER JOIN accounting_journals j ON j.id = jl.journal_id AND j.entity_id = ${entityId}
      WHERE jl.entity_id = ${entityId} AND jl.company_id = ${companyId}
      ORDER BY j.date DESC, jl.id DESC
      LIMIT 50
    `;

    const entries = (ledgerRows ?? []).map((r) => ({
      id: r.id,
      date: r.date ?? new Date().toISOString(),
      description: r.description ?? "Entry",
      debit: Number(r.debit ?? 0),
      credit: Number(r.credit ?? 0),
      balance: Number(r.balance ?? 0),
    }));

    return NextResponse.json({ metrics, entries });
  } catch (err) {
    console.error("GET /api/company/[companyId]/accounting/summary error", err);
    return NextResponse.json({ metrics: [], entries: [] }, { status: 200 });
  }
}
