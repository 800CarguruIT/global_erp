import {
  createAccount,
  createEntityForCompany,
  createEntityForGlobal,
  getAccountById,
  getBalanceSheet,
  getCashFlow,
  getEntityByScope,
  getEntityTotals,
  getStandardAccounts,
  getJournalWithLines,
  getProfitAndLoss,
  getTrialBalance,
  importStandardAccountsToEntity,
  insertJournal,
  listAccounts,
  getProfitAndLossAll,
  getBalanceSheetAll,
  getCashFlowAll,
  getTrialBalanceAll,
  listLedgerEntriesAllEntities,
  listLedgerEntries,
  listJournals,
  updateAccountStandard,
  getTotalsAllEntities,
  getBalancesByCodes,
} from "./repository";
import type {
  AccountingEntityRow,
  CreateAccountInput,
  CreateJournalInput,
  FinancialStatementRow,
  JournalLineInput,
  JournalRow,
  TrialBalanceRow,
} from "./types";

async function ensureEntityAccounts(entityId: string) {
  const accounts = await listAccounts(entityId);
  if (accounts.length === 0) {
    await importStandardAccountsToEntity(entityId);
    return listAccounts(entityId);
  }
  return accounts;
}

async function ensureEntityForCompany(companyId: string, name = "Company Books", baseCurrency = "USD"): Promise<AccountingEntityRow> {
  const existing = await getEntityByScope("company", companyId);
  if (existing) return existing;
  return createEntityForCompany(companyId, name, baseCurrency);
}

async function ensureGlobalEntity(name = "Global Books", baseCurrency = "USD"): Promise<AccountingEntityRow> {
  const existing = await getEntityByScope("global", null);
  if (existing) {
    await ensureEntityAccounts(existing.id);
    return existing;
  }
  const created = await createEntityForGlobal(name, baseCurrency);
  await importStandardAccountsToEntity(created.id);
  return created;
}

export async function createOrImportEntityChart(scope: "global" | "company", companyId?: string) {
  const entity =
    scope === "global"
      ? await ensureGlobalEntity()
      : await ensureEntityForCompany(companyId!, "Company Books", "USD");
  return ensureEntityAccounts(entity!.id);
}

export async function createAccountForEntity(input: CreateAccountInput) {
  return createAccount(input);
}

export async function listStandardAccounts() {
  return getStandardAccounts();
}

export async function mapAccountToStandard(accountId: string, standardId: string | null) {
  return updateAccountStandard(accountId, standardId);
}

export async function postJournal(input: CreateJournalInput & { createdByUserId?: string; skipAccountValidation?: boolean }) {
  const accounts = await listAccounts(input.entityId);
  const accountIds = new Set(accounts.map((a) => a.id));
  for (const line of input.lines) {
    if (!input.skipAccountValidation && !accountIds.has(line.accountId)) {
      throw new Error(`Account ${line.accountId} not in entity`);
    }
  }
  const totalDebit = input.lines.reduce((s, l) => s + (Number(l.debit ?? 0)), 0);
  const totalCredit = input.lines.reduce((s, l) => s + (Number(l.credit ?? 0)), 0);
  if (Number(totalDebit.toFixed(4)) !== Number(totalCredit.toFixed(4))) {
    throw new Error("Journal not balanced (debits != credits)");
  }
  return insertJournal(input, input.createdByUserId);
}

export async function getEntityTrialBalance(params: {
  entityId: string;
  dateTo: string;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<TrialBalanceRow[]> {
  return getTrialBalance(params);
}

export async function getEntityProfitAndLoss(params: {
  entityId: string;
  dateFrom: string;
  dateTo: string;
  branchId?: string | null;
  vendorId?: string | null;
}): Promise<FinancialStatementRow[]> {
  return getProfitAndLoss(params);
}

export async function getEntityBalanceSheet(params: {
  entityId: string;
  dateAsOf: string;
  branchId?: string | null;
}): Promise<FinancialStatementRow[]> {
  return getBalanceSheet(params);
}

export async function getEntityCashFlow(params: {
  entityId: string;
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  return getCashFlow(params);
}

export async function getGlobalProfitAndLoss(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  const rows = await getProfitAndLossAll(params);
  return rows.map((r) => ({
    accountId: (r as any).accountId ?? (r as any).accountid ?? null,
    accountCode: (r as any).accountCode ?? (r as any).accountcode ?? "",
    accountName: (r as any).accountName ?? (r as any).accountname ?? "",
    amount: Number(r.amount ?? 0),
  }));
}

export async function getGlobalBalanceSheet(params: {
  dateAsOf: string;
}): Promise<FinancialStatementRow[]> {
  const rows = await getBalanceSheetAll(params);
  return rows.map((r) => ({
    accountId: (r as any).accountId ?? (r as any).accountid ?? null,
    accountCode: (r as any).accountCode ?? (r as any).accountcode ?? "",
    accountName: (r as any).accountName ?? (r as any).accountname ?? "",
    amount: Number(r.amount ?? 0),
  }));
}

export async function getGlobalCashFlow(params: {
  dateFrom: string;
  dateTo: string;
}): Promise<FinancialStatementRow[]> {
  const rows = await getCashFlowAll(params);
  return rows.map((r) => ({
    accountId: (r as any).accountId ?? (r as any).accountid ?? null,
    accountCode: (r as any).accountCode ?? (r as any).accountcode ?? "",
    accountName: (r as any).accountName ?? (r as any).accountname ?? "",
    amount: Number(r.amount ?? 0),
  }));
}

export async function getGlobalTrialBalance(params: {
  dateTo: string;
}): Promise<TrialBalanceRow[]> {
  const rows = await getTrialBalanceAll(params);
  return rows.map((r) => ({
    accountId: (r as any).accountId ?? (r as any).accountid ?? null,
    accountCode: (r as any).accountCode ?? (r as any).accountcode ?? "",
    accountName: (r as any).accountName ?? (r as any).accountname ?? "",
    debit: Number(r.debit ?? 0),
    credit: Number(r.credit ?? 0),
    balance: Number(r.balance ?? 0),
  }));
}

export async function resolveEntityId(scope: "global" | "company", companyId?: string | null) {
  if (scope === "global") {
    const entity = await ensureGlobalEntity();
    return entity.id;
  }
  const entity = await getEntityByScope("company", companyId ?? null);
  if (entity) {
    await ensureEntityAccounts(entity.id);
    return entity.id;
  }
  const created = await ensureEntityForCompany(companyId!, "Company Books", "USD");
  await ensureEntityAccounts(created.id);
  return created.id;
}

export async function listEntityJournals(params: {
  scope: "global" | "company";
  companyId?: string | null;
  dateFrom?: string;
  dateTo?: string;
}): Promise<JournalRow[]> {
  const entityId = await resolveEntityId(params.scope, params.companyId ?? null);
  return listJournals(entityId, params.dateFrom, params.dateTo);
}

export async function listGlobalLedgerEntries(params?: { limit?: number }) {
  const limit = Math.max(1, params?.limit ?? 50);
  return listLedgerEntriesAllEntities(limit);
}

export async function getGlobalSummary() {
  const entity = await ensureGlobalEntity();
  const totals = await getTotalsAllEntities();
  const balance = Number((totals.totalDebit - totals.totalCredit).toFixed(2));
  const keyCodes = ["1000", "1100", "1200", "2000"];
  const codeBalances = await getBalancesByCodes(keyCodes);
  const find = (code: string) => codeBalances.find((c) => c.code === code)?.balance ?? 0;
  const cash = find("1000");
  const bank = find("1100");
  const ar = find("1200");
  const ap = find("2000");
  const available = cash + bank;

  return [
    {
      key: "balance",
      label: "Balance",
      value: balance,
      detail: entity.base_currency,
    },
    {
      key: "totalDebit",
      label: "Total Debit",
      value: Number(totals.totalDebit.toFixed(2)),
      detail: entity.base_currency,
    },
    {
      key: "totalCredit",
      label: "Total Credit",
      value: Number(totals.totalCredit.toFixed(2)),
      detail: entity.base_currency,
    },
    {
      key: "journalCount",
      label: "Journals",
      value: totals.journalCount,
      detail: "Posted journals",
    },
    {
      key: "accountsReceivable",
      label: "Accounts Receivable",
      value: Number(ar.toFixed(2)),
      detail: entity.base_currency,
    },
    {
      key: "accountsPayable",
      label: "Accounts Payable",
      value: Number(ap.toFixed(2)),
      detail: entity.base_currency,
    },
    {
      key: "availableCash",
      label: "Available Balance",
      value: Number(available.toFixed(2)),
      detail: entity.base_currency,
    },
  ];
}

export { getJournalWithLines };
