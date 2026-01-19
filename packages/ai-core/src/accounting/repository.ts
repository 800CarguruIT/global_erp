import { getSql } from "../db";
import type {
  AccountingEntityRow,
  AccountRow,
  CreateAccountInput,
  CreateJournalInput,
  FinancialStatementRow,
  JournalLineRow,
  JournalRow,
  StandardAccountRow,
  TrialBalanceRow,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getStandardAccounts(): Promise<StandardAccountRow[]> {
  const sql = getSql();
  const result = await sql<StandardAccountRow[]>`
    SELECT * FROM accounting_standard_accounts
    WHERE is_active = TRUE
    ORDER BY code
  `;
  return rowsFrom(result);
}

export async function getStandardAccountById(id: string): Promise<StandardAccountRow | null> {
  const sql = getSql();
  const result = await sql<StandardAccountRow[]>`
    SELECT * FROM accounting_standard_accounts WHERE id = ${id} LIMIT 1
  `;
  return rowsFrom(result)[0] ?? null;
}

export async function getEntityByScope(
  scope: "global" | "company",
  companyId?: string | null
): Promise<AccountingEntityRow | null> {
  const sql = getSql();
  if (scope === "global") {
    const result = await sql<AccountingEntityRow[]>`
      SELECT * FROM accounting_entities WHERE scope = 'global' AND company_id IS NULL LIMIT 1
    `;
    return (rowsFrom(result)[0] as AccountingEntityRow | undefined) ?? null;
  }
  const result = await sql<AccountingEntityRow[]>`
    SELECT * FROM accounting_entities WHERE scope = 'company' AND company_id = ${companyId ?? null} LIMIT 1
  `;
  return (rowsFrom(result)[0] as AccountingEntityRow | undefined) ?? null;
}

export async function createEntityForCompany(
  companyId: string,
  name: string,
  baseCurrency: string
): Promise<AccountingEntityRow> {
  const sql = getSql();
  const result = await sql<AccountingEntityRow[]>`
    INSERT INTO accounting_entities (scope, company_id, name, base_currency)
    VALUES ('company', ${companyId}, ${name}, ${baseCurrency})
    RETURNING *
  `;
  return rowsFrom(result)[0] as AccountingEntityRow;
}

export async function createEntityForGlobal(
  name: string,
  baseCurrency: string
): Promise<AccountingEntityRow> {
  const sql = getSql();
  const result = await sql<AccountingEntityRow[]>`
    INSERT INTO accounting_entities (scope, company_id, name, base_currency)
    VALUES ('global', NULL, ${name}, ${baseCurrency})
    RETURNING *
  `;
  return rowsFrom(result)[0] as AccountingEntityRow;
}

export async function listAccounts(entityId: string): Promise<AccountRow[]> {
  const sql = getSql();
  const result = await sql<AccountRow[]>`
    SELECT * FROM accounting_accounts
    WHERE entity_id = ${entityId}
    ORDER BY code
  `;
  return rowsFrom(result) as AccountRow[];
}

export async function getAccountById(id: string): Promise<AccountRow | null> {
  const sql = getSql();
  const result = await sql<AccountRow[]>`
    SELECT * FROM accounting_accounts WHERE id = ${id} LIMIT 1
  `;
  return (rowsFrom(result)[0] as AccountRow | undefined) ?? null;
}

export async function createAccount(input: CreateAccountInput): Promise<AccountRow> {
  const sql = getSql();
  const result = await sql<AccountRow[]>`
    INSERT INTO accounting_accounts (
      entity_id, standard_id, code, name, type, sub_type, normal_balance, parent_id, is_leaf
    ) VALUES (
      ${input.entityId},
      ${input.standardId ?? null},
      ${input.code},
      ${input.name},
      ${input.type},
      ${input.subType ?? null},
      ${input.normalBalance},
      ${input.parentId ?? null},
      true
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as AccountRow;
}

export async function updateAccountStandard(
  accountId: string,
  standardId: string | null
): Promise<AccountRow | null> {
  const sql = getSql();
  const standard = standardId ? await getStandardAccountById(standardId) : null;
  const result = await sql<AccountRow[]>`
    UPDATE accounting_accounts
    SET
      standard_id = ${standardId},
      type = COALESCE(${standard?.type ?? null}, type),
      sub_type = COALESCE(${standard?.sub_type ?? null}, sub_type),
      normal_balance = COALESCE(${standard?.normal_balance ?? null}, normal_balance)
    WHERE id = ${accountId}
    RETURNING *
  `;
  return (rowsFrom(result)[0] as AccountRow | undefined) ?? null;
}

export async function importStandardAccountsToEntity(entityId: string): Promise<void> {
  const sql = getSql();
  const standards = await getStandardAccounts();
  for (const sa of standards) {
    await sql`
      INSERT INTO accounting_accounts (
        entity_id, standard_id, code, name, type, sub_type, normal_balance, parent_id, is_leaf
      ) VALUES (
        ${entityId},
        ${sa.id},
        ${sa.code},
        ${sa.name},
        ${sa.type},
        ${sa.sub_type},
        ${sa.normal_balance},
        NULL,
        ${sa.is_leaf}
      )
      ON CONFLICT (entity_id, code) DO NOTHING
    `;
  }
}

export async function insertJournal(
  input: CreateJournalInput,
  createdByUserId?: string
): Promise<JournalRow & { lines: JournalLineRow[] }> {
  const sql = getSql();
  const journalNo = input.reference
    ? input.reference
    : `JV-${new Date(input.date).getFullYear()}-${Date.now()}`;

  const jRes = await sql<JournalRow[]>`
    INSERT INTO accounting_journals (
      entity_id, journal_no, journal_type, date, description, reference, currency, created_by_user_id
    ) VALUES (
      ${input.entityId},
      ${journalNo},
      ${input.journalType},
      ${input.date},
      ${input.description ?? null},
      ${input.reference ?? null},
      ${input.currency ?? "USD"},
      ${createdByUserId ?? null}
    )
    RETURNING *
  `;
  const journal = rowsFrom(jRes)[0] as JournalRow | undefined;
  if (!journal) throw new Error("Failed to insert journal");

  const lines: JournalLineRow[] = [];
  let lineNo = 1;
  for (const line of input.lines) {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    const dims = line.dimensions ?? {};
    const lRes = await sql<JournalLineRow[]>`
      INSERT INTO accounting_journal_lines (
        journal_id, entity_id, line_no, account_id, description, debit, credit,
        company_id, branch_id, vendor_id, employee_id, project_id, cost_center
      ) VALUES (
        ${journal.id},
        ${input.entityId},
        ${lineNo},
        ${line.accountId},
        ${line.description ?? null},
        ${debit},
        ${credit},
        ${dims.companyId ?? null},
        ${dims.branchId ?? null},
        ${dims.vendorId ?? null},
        ${dims.employeeId ?? null},
        ${dims.projectId ?? null},
        ${dims.costCenter ?? null}
      )
      RETURNING *
    `;
    lines.push(rowsFrom(lRes)[0] as JournalLineRow);
    lineNo += 1;
  }
  return { ...(journal as JournalRow), lines };
}

export async function listJournals(
  entityId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<JournalRow[]> {
  const sql = getSql();
  const conditions = [sql`entity_id = ${entityId}`];
  if (dateFrom) {
    conditions.push(sql`date >= ${dateFrom}`);
  }
  if (dateTo) {
    conditions.push(sql`date <= ${dateTo}`);
  }
  const where = conditions.reduce((acc, clause, idx) => {
    if (idx === 0) return clause;
    return sql`${acc} AND ${clause}`;
  });
  const result = await sql<JournalRow[]>`
    SELECT *
    FROM accounting_journals
    WHERE ${where}
    ORDER BY date DESC, journal_no DESC
  `;
  return rowsFrom(result) as JournalRow[];
}

export async function listLedgerEntries(
  entityId: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    date: string;
    description: string | null;
    debit: number;
    credit: number;
    balance: number;
  }>
> {
  const sql = getSql();
  const res = await sql<any[]>`
    SELECT
      jl.id,
      j.date,
      COALESCE(j.description, jl.description) as description,
      jl.debit,
      jl.credit,
      SUM(jl.debit - jl.credit) OVER (ORDER BY j.date, jl.id) as balance
    FROM accounting_journal_lines jl
    INNER JOIN accounting_journals j ON j.id = jl.journal_id
    WHERE jl.entity_id = ${entityId}
    ORDER BY j.date DESC, jl.id DESC
    LIMIT ${limit}
  `;
  return rowsFrom(res).map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    balance: Number(r.balance ?? 0),
  }));
}

export async function listLedgerEntriesAllEntities(limit = 50): Promise<
  Array<{
    id: string;
    date: string;
    description: string | null;
    debit: number;
    credit: number;
    balance: number;
  }>
> {
  const sql = getSql();
  const res = await sql<any[]>`
    SELECT
      jl.id,
      j.date,
      COALESCE(j.description, jl.description) as description,
      jl.debit,
      jl.credit,
      SUM(jl.debit - jl.credit) OVER (ORDER BY j.date, jl.id) as balance
    FROM accounting_journal_lines jl
    INNER JOIN accounting_journals j ON j.id = jl.journal_id
    ORDER BY j.date DESC, jl.id DESC
    LIMIT ${limit}
  `;
  return rowsFrom(res).map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    balance: Number(r.balance ?? 0),
  }));
}

export async function getEntityTotals(entityId: string): Promise<{
  totalDebit: number;
  totalCredit: number;
  journalCount: number;
}> {
  const sql = getSql();
  const res = await sql<any[]>`
    SELECT
      COALESCE(SUM(jl.debit), 0) AS total_debit,
      COALESCE(SUM(jl.credit), 0) AS total_credit,
      COUNT(DISTINCT j.id) AS journal_count
    FROM accounting_journal_lines jl
    INNER JOIN accounting_journals j ON j.id = jl.journal_id
    WHERE jl.entity_id = ${entityId}
  `;
  const row = rowsFrom(res)[0] ?? { total_debit: 0, total_credit: 0, journal_count: 0 };
  return {
    totalDebit: Number(row.total_debit ?? 0),
    totalCredit: Number(row.total_credit ?? 0),
    journalCount: Number(row.journal_count ?? 0),
  };
}

export async function getTotalsAllEntities(): Promise<{
  totalDebit: number;
  totalCredit: number;
  journalCount: number;
}> {
  const sql = getSql();
  const res = await sql<any[]>`
    SELECT
      COALESCE(SUM(jl.debit), 0) AS total_debit,
      COALESCE(SUM(jl.credit), 0) AS total_credit,
      COUNT(DISTINCT j.id) AS journal_count
    FROM accounting_journal_lines jl
    INNER JOIN accounting_journals j ON j.id = jl.journal_id
  `;
  const row = rowsFrom(res)[0] ?? { total_debit: 0, total_credit: 0, journal_count: 0 };
  return {
    totalDebit: Number(row.total_debit ?? 0),
    totalCredit: Number(row.total_credit ?? 0),
    journalCount: Number(row.journal_count ?? 0),
  };
}

export async function getJournalWithLines(
  id: string
): Promise<JournalRow & { lines: JournalLineRow[] }> {
  const sql = getSql();
  const jRes = await sql<JournalRow[]>`
    SELECT * FROM accounting_journals WHERE id = ${id} LIMIT 1
  `;
  const journal = rowsFrom(jRes)[0] as JournalRow | undefined;
  if (!journal) throw new Error("Journal not found");
  const linesRes = await sql<JournalLineRow[]>`
    SELECT * FROM accounting_journal_lines WHERE journal_id = ${id} ORDER BY line_no
  `;
  return { ...journal, lines: rowsFrom(linesRes) as JournalLineRow[] };
}

export async function getTrialBalance(params: {
  entityId: string;
  dateTo: string;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<TrialBalanceRow[]> {
  const sql = getSql();
  const branchCond = params.branchId ? sql`AND jl.branch_id = ${params.branchId}` : sql``;
  const vendorCond = params.vendorId ? sql`AND jl.vendor_id = ${params.vendorId}` : sql``;
  const res = await sql<TrialBalanceRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      COALESCE(SUM(jl.debit), 0) as debit,
      COALESCE(SUM(jl.credit), 0) as credit,
      COALESCE(SUM(jl.debit - jl.credit), 0) as balance
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.entity_id = ${params.entityId}
      AND jl.created_at::date <= ${params.dateTo}
      ${branchCond}
      ${vendorCond}
    WHERE a.entity_id = ${params.entityId}
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getProfitAndLoss(params: {
  entityId: string;
  dateFrom: string;
  dateTo: string;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const branchCond = params.branchId ? sql`AND jl.branch_id = ${params.branchId}` : sql``;
  const vendorCond = params.vendorId ? sql`AND jl.vendor_id = ${params.vendorId}` : sql``;
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.entity_id = ${params.entityId}
      AND jl.created_at::date >= ${params.dateFrom}
      AND jl.created_at::date <= ${params.dateTo}
      ${branchCond}
      ${vendorCond}
    WHERE a.entity_id = ${params.entityId}
      AND a.type IN ('income','expense')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getBalanceSheet(params: {
  entityId: string;
  dateAsOf: string;
  branchId?: string | null;
}): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const branchCond = params.branchId ? sql`AND jl.branch_id = ${params.branchId}` : sql``;
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.entity_id = ${params.entityId}
      AND jl.created_at::date <= ${params.dateAsOf}
      ${branchCond}
    WHERE a.entity_id = ${params.entityId}
      AND a.type IN ('asset','liability','equity')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getBalancesByCodes(codes: string[]): Promise<Array<{ code: string; name: string; balance: number }>> {
  const sql = getSql();
  if (!codes || codes.length === 0) return [];
  const res = await sql<any[]>`
    SELECT
      a.code,
      a.name,
      COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
    WHERE a.code IN ${sql(codes)}
    GROUP BY a.code, a.name
  `;
  return rowsFrom(res).map((r) => ({
    code: r.code,
    name: r.name,
    balance: Number(r.balance ?? 0),
  }));
}

export async function getCashFlow(params: {
  entityId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.entity_id = ${params.entityId}
      AND jl.created_at::date >= ${params.dateFrom}
      AND jl.created_at::date <= ${params.dateTo}
    WHERE a.entity_id = ${params.entityId}
      AND (a.sub_type = 'cash' OR a.sub_type = 'bank')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getProfitAndLossAll(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.created_at::date >= ${params.dateFrom}
      AND jl.created_at::date <= ${params.dateTo}
    WHERE a.type IN ('income','expense')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getBalanceSheetAll(params: { dateAsOf: string }): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.created_at::date <= ${params.dateAsOf}
    WHERE a.type IN ('asset','liability','equity')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getCashFlowAll(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  const sql = getSql();
  const res = await sql<FinancialStatementRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      SUM(jl.debit - jl.credit) as amount
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.created_at::date >= ${params.dateFrom}
      AND jl.created_at::date <= ${params.dateTo}
    WHERE (a.sub_type = 'cash' OR a.sub_type = 'bank')
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}

export async function getTrialBalanceAll(params: { dateTo: string }): Promise<TrialBalanceRow[]> {
  const sql = getSql();
  const res = await sql<TrialBalanceRow[]>`
    SELECT
      a.id as accountId,
      a.code as accountCode,
      a.name as accountName,
      COALESCE(SUM(jl.debit), 0) as debit,
      COALESCE(SUM(jl.credit), 0) as credit,
      COALESCE(SUM(jl.debit - jl.credit), 0) as balance
    FROM accounting_accounts a
    LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id
      AND jl.created_at::date <= ${params.dateTo}
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `;
  return rowsFrom(res);
}
