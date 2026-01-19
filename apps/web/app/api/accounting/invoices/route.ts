import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

type InvoiceItemInput = {
  name: string;
  description?: string | null;
  amount: number;
};

function ensureNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function ensureEntity(sql: any, companyId: string | null) {
  const scope = companyId ? "company" : "global";
  const ent = await sql<{ id: string }[]>`
    SELECT id FROM accounting_entities
    WHERE scope = ${scope} ${companyId ? sql`AND company_id = ${companyId}` : sql``}
    LIMIT 1
  `;
  if (ent[0]) return ent[0].id;
  const created = await sql<{ id: string }[]>`
    INSERT INTO accounting_entities (scope, company_id, name, base_currency)
    VALUES (${scope}, ${companyId}, ${scope === "global" ? "Global Books" : "Company Books"}, 'USD')
    RETURNING id
  `;
  return created[0].id;
}

async function ensureAccount(sql: any, entityId: string, code: string, name: string, type: string, normalBalance: string) {
  const found = await sql<{ id: string }[]>`
    SELECT id FROM accounting_accounts WHERE entity_id = ${entityId} AND code = ${code} LIMIT 1
  `;
  if (found[0]) return found[0].id;
  const inserted = await sql<{ id: string }[]>`
    INSERT INTO accounting_accounts (entity_id, code, name, type, normal_balance, is_leaf, is_active)
    VALUES (${entityId}, ${code}, ${name}, ${type}, ${normalBalance}, true, true)
    RETURNING id
  `;
  return inserted[0].id;
}

async function createJournal(sql: any, params: {
  entityId: string;
  journalType: string;
  description?: string | null;
  reference?: string | null;
  currency: string;
  lines: Array<{ accountId: string; debit: number; credit: number; description?: string | null }>;
}) {
  const journalNo = `${params.journalType}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const journal = await sql<{ id: string }[]>`
    INSERT INTO accounting_journals (entity_id, journal_no, journal_type, date, description, reference, currency, is_posted)
    VALUES (${params.entityId}, ${journalNo}, ${params.journalType}, now()::date, ${params.description ?? null}, ${params.reference ?? null}, ${params.currency}, true)
    RETURNING id
  `;
  const journalId = journal[0].id;
  for (let i = 0; i < params.lines.length; i++) {
    const line = params.lines[i];
    await sql`
      INSERT INTO accounting_journal_lines (journal_id, entity_id, line_no, account_id, description, debit, credit)
      VALUES (${journalId}, ${params.entityId}, ${i + 1}, ${line.accountId}, ${line.description ?? null}, ${line.debit}, ${line.credit})
    `;
  }
  return journalId;
}

export async function POST(req: NextRequest) {
  try {
    const sql = getSql();
    const body = await req.json().catch(() => ({}));
    const companyId: string | null = body.companyId ?? null;
    const currency: string = body.currency || "USD";
    const dueDate: string | null = body.dueDate ?? null;
    const reference: string | null = body.reference ?? null;
    const description: string | null = body.description ?? null;
    const items: InvoiceItemInput[] = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }
    const total = items.reduce((acc, it) => acc + ensureNumber(it.amount), 0);

    const invoice = await sql<{ id: string }[]>`
      INSERT INTO billing_invoices (company_id, status, currency, total_amount, due_date, reference, description)
      VALUES (${companyId}, 'pending', ${currency}, ${total}, ${dueDate}, ${reference}, ${description})
      RETURNING id
    `;
    const invoiceId = invoice[0].id;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await sql`
        INSERT INTO billing_invoice_lines (invoice_id, line_no, name, description, amount)
        VALUES (${invoiceId}, ${i + 1}, ${it.name}, ${it.description ?? null}, ${ensureNumber(it.amount)})
      `;
    }

    // Post accounting journal: Dr AR, Cr Revenue
    const entityId = await ensureEntity(sql, companyId);
    const arAccount = await ensureAccount(sql, entityId, "1200", "Accounts Receivable", "asset", "debit");
    const revenueAccount = await ensureAccount(sql, entityId, "4000", "Sales Revenue", "income", "credit");
    await createJournal(sql, {
      entityId,
      journalType: "INVOICE",
      description: description ?? "Invoice",
      reference: invoiceId,
      currency,
      lines: [
        { accountId: arAccount, debit: total, credit: 0, description: "Invoice AR" },
        { accountId: revenueAccount, debit: 0, credit: total, description: "Invoice Revenue" },
      ],
    });

    return NextResponse.json({ data: { id: invoiceId, total } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accounting/invoices error", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");
    const rows = await sql`
      SELECT id, company_id, status, currency, total_amount, due_date, paid_at, reference, description, created_at, updated_at
      FROM billing_invoices
      ${companyId ? sql`WHERE company_id = ${companyId}` : sql``}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("GET /api/accounting/invoices error", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}
