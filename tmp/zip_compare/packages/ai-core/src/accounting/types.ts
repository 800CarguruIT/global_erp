export type AccountingEntityScope = "global" | "company";

export interface StandardAccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string | null;
  normal_balance: "debit" | "credit" | string;
  is_leaf: boolean;
  parent_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountingEntityRow {
  id: string;
  scope: AccountingEntityScope;
  company_id: string | null;
  name: string;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  entity_id: string;
  standard_id: string | null;
  code: string;
  name: string;
  type: string;
  sub_type: string | null;
  normal_balance: "debit" | "credit" | string;
  parent_id: string | null;
  is_leaf: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalRow {
  id: string;
  entity_id: string;
  journal_no: string;
  journal_type: string;
  date: string;
  description: string | null;
  reference: string | null;
  currency: string;
  created_by_user_id: string | null;
  is_posted: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalLineRow {
  id: string;
  journal_id: string;
  entity_id: string;
  line_no: number;
  account_id: string;
  description: string | null;
  debit: number;
  credit: number;
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;
  employee_id: string | null;
  project_id: string | null;
  cost_center: string | null;
  created_at: string;
  updated_at: string;
}

export type JournalDimension = {
  companyId?: string | null;
  branchId?: string | null;
  vendorId?: string | null;
  employeeId?: string | null;
  projectId?: string | null;
  costCenter?: string | null;
};

export type CreateAccountInput = {
  entityId: string;
  code: string;
  name: string;
  type: string;
  subType?: string | null;
  normalBalance: "debit" | "credit";
  parentId?: string | null;
  standardId?: string | null;
};

export type JournalLineInput = {
  accountId: string;
  description?: string | null;
  debit?: number;
  credit?: number;
  dimensions?: JournalDimension;
};

export type CreateJournalInput = {
  entityId: string;
  journalType: string;
  date: string;
  description?: string | null;
  reference?: string | null;
  currency?: string | null;
  lines: JournalLineInput[];
};

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
};

export type FinancialStatementRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
};
