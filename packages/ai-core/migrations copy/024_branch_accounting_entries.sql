-- Branch-level accounting entries between company and branch
CREATE TABLE IF NOT EXISTS branch_accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('receivable','payable')),
  entry_type TEXT NOT NULL, -- inspection, job, stock, fine, other
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- open, partial, paid, disputed
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_accounting_entries_company_branch ON branch_accounting_entries(company_id, branch_id);
