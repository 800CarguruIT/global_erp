import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";

async function getInvoice(sql: any, id: string) {
  const rows = await sql`
    SELECT id, company_id, status, currency, total_amount, due_date, paid_at, payment_ref, reference, description, created_at, updated_at
    FROM billing_invoices
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function resolveId(params: any): Promise<string | null> {
  const resolved = await Promise.resolve(params);
  const id = Array.isArray(resolved?.id) ? resolved.id[0] : resolved?.id;
  return id ?? null;
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const sql = getSql();
    const id = await resolveId(params);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const invoice = await getInvoice(sql, id);
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const company =
      invoice.company_id &&
      (
        await sql`
          SELECT
            id,
            display_name,
            legal_name,
            company_email,
            company_phone,
            address_line1,
            address_line2,
            city,
            state_region,
            postal_code,
            country,
            vat_number,
            owner_name,
            owner_email,
            owner_phone
          FROM companies
          WHERE id = ${invoice.company_id}
          LIMIT 1
        `
      )[0];
    const orgProfile =
      (
        await sql`
          SELECT id, name, address, email, phone, tax_id, website, currency
          FROM billing_org_profile
          LIMIT 1
        `
      )[0] ?? null;
    const lines = await sql`
      SELECT line_no, name, description, amount
      FROM billing_invoice_lines
      WHERE invoice_id = ${id}
      ORDER BY line_no
    `;
    return NextResponse.json({ data: { invoice, lines, company, orgProfile } });
  } catch (error) {
    console.error("GET /api/accounting/invoices/:id error", error);
    return NextResponse.json({ error: "Failed to load invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const sql = getSql();
    const body = await req.json().catch(() => ({}));
    const status = body.status as string | undefined;
    const paymentRef = body.paymentRef ?? null;
    const id = await resolveId(params);
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const invoice = await getInvoice(sql, id);
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (status === "paid" && invoice.status !== "paid") {
      await sql`
        UPDATE billing_invoices
        SET status = 'paid', paid_at = now(), payment_ref = ${paymentRef}
        WHERE id = ${id}
      `;

      // Post payment journal: Dr Cash (1100), Cr AR (1200)
      const entityId = await ensureEntity(sql, invoice.company_id);
      const cashAccount = await ensureAccount(sql, entityId, "1100", "Bank", "asset", "debit");
      const arAccount = await ensureAccount(sql, entityId, "1200", "Accounts Receivable", "asset", "debit");
      await createJournal(sql, {
        entityId,
        journalType: "PAYMENT",
        description: "Invoice payment",
        reference: id,
        currency: invoice.currency,
        lines: [
          { accountId: cashAccount, debit: Number(invoice.total_amount ?? 0), credit: 0, description: "Payment received" },
          { accountId: arAccount, debit: 0, credit: Number(invoice.total_amount ?? 0), description: "Clear AR" },
        ],
      });
    } else if (status === "canceled") {
      await sql`UPDATE billing_invoices SET status = 'canceled' WHERE id = ${id}`;
    }

    const updated = await getInvoice(sql, id);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/accounting/invoices/:id error", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}
