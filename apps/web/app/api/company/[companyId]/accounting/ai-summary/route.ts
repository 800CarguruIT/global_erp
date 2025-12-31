import { NextRequest, NextResponse } from "next/server";
import { Accounting, canUseAi, getOpenAIClient, getSql } from "@repo/ai-core";
import { buildScopeContextFromRoute, requirePermission } from "../../../../../../lib/auth/permissions";

type Params = { params: Promise<{ companyId: string }> };

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  const perm = await requirePermission(req, "accounting.view", buildScopeContextFromRoute({ companyId }, "company"));
  if (perm) return perm;

  try {
    const allowed = await canUseAi("ai.accounting.summary", { companyId }).catch(() => true);
    const hasKey = Boolean(process.env.OPENAI_API_KEY);
    if (!allowed || !hasKey) {
      return NextResponse.json({
        suggestions: [],
        appreciation: null,
        meta: { aiUsed: false, reason: allowed ? "missing-key" : "disabled" },
      });
    }

    const sql = getSql();
    const entityId = await Accounting.resolveEntityId("company", companyId);

    const balances = await sql`
      SELECT a.code, a.name, COALESCE(SUM(jl.debit - jl.credit),0)::numeric AS balance
      FROM accounting_accounts a
      LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id AND jl.entity_id = ${entityId}
      WHERE a.entity_id = ${entityId} AND a.code IN ('1000','1100','1200','2000')
      GROUP BY a.code, a.name
    `;
    const byCode = Object.fromEntries(
      (balances as any[]).map((r) => [r.code, { name: r.name, balance: Number(r.balance ?? 0) }])
    );

    const totalsRes = await sql`
      SELECT
        COALESCE(SUM(jl.debit),0)::numeric AS total_debit,
        COALESCE(SUM(jl.credit),0)::numeric AS total_credit,
        COUNT(DISTINCT j.id) AS journal_count
      FROM accounting_journal_lines jl
      INNER JOIN accounting_journals j ON j.id = jl.journal_id
      WHERE jl.entity_id = ${entityId}
    `;
    const totals = totalsRes?.[0] ?? { total_debit: 0, total_credit: 0, journal_count: 0 };

    const [entityRow] = await sql<{ base_currency?: string }[]>`
      SELECT base_currency
      FROM accounting_entities
      WHERE id = ${entityId}
      LIMIT 1
    `;

    const cash = Number(byCode["1000"]?.balance ?? 0);
    const bank = Number(byCode["1100"]?.balance ?? 0);
    const ar = Number(byCode["1200"]?.balance ?? 0);
    const ap = Number(byCode["2000"]?.balance ?? 0);
    const available = cash + bank;
    const currency = entityRow?.base_currency ?? "USD";

    const client = getOpenAIClient();
    const prompt = `
You are an AI accountant for a company ledger. Using the metrics below, propose 2-4 short recommended actions and 1 appreciation.
Metrics:
- Available cash/bank (${currency}): ${available}
- Accounts Receivable (1200): ${ar}
- Accounts Payable (2000): ${ap}
- Total debit: ${Number(totals.total_debit ?? 0)}
- Total credit: ${Number(totals.total_credit ?? 0)}
- Journal count: ${Number(totals.journal_count ?? 0)}
Return strict JSON: { "actions": ["..."], "appreciation": "..." }
Keep sentences concise.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { actions?: string[]; appreciation?: string | null } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      suggestions: parsed.actions ?? [],
      appreciation: parsed.appreciation ?? null,
      meta: { aiUsed: true },
    });
  } catch (err) {
    console.error("GET /api/company/[companyId]/accounting/ai-summary error", err);
    return NextResponse.json({ suggestions: [], appreciation: null, meta: { aiUsed: false, reason: "error" } });
  }
}
