-- Standard chart of accounts (template)
CREATE TABLE IF NOT EXISTS accounting_standard_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL, -- asset | liability | equity | income | expense
  sub_type text NULL,
  normal_balance text NOT NULL, -- debit | credit
  is_leaf boolean NOT NULL DEFAULT true,
  parent_id uuid NULL REFERENCES accounting_standard_accounts(id),
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

-- Accounting entities (global / per company)
CREATE TABLE IF NOT EXISTS accounting_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL, -- global | company
  company_id uuid NULL,
  name text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Accounts per entity
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES accounting_entities(id),
  standard_id uuid NULL REFERENCES accounting_standard_accounts(id),
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  sub_type text NULL,
  normal_balance text NOT NULL,
  parent_id uuid NULL REFERENCES accounting_accounts(id),
  is_leaf boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code)
);

-- Journals
CREATE TABLE IF NOT EXISTS accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES accounting_entities(id),
  journal_no text NOT NULL,
  journal_type text NOT NULL,
  date date NOT NULL,
  description text NULL,
  reference text NULL,
  currency text NOT NULL,
  created_by_user_id uuid NULL,
  is_posted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, journal_no)
);

-- Journal lines
CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES accounting_journals(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  line_no integer NOT NULL,
  account_id uuid NOT NULL REFERENCES accounting_accounts(id),
  description text NULL,
  debit numeric(18,4) NOT NULL DEFAULT 0,
  credit numeric(18,4) NOT NULL DEFAULT 0,
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,
  employee_id uuid NULL,
  project_id uuid NULL,
  cost_center text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON accounting_journal_lines (journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entity ON accounting_journal_lines (entity_id);

CREATE INDEX IF NOT EXISTS idx_entities_scope_company ON accounting_entities (scope, company_id);

-- Seed global accounting entity
INSERT INTO accounting_entities (id, scope, company_id, name, base_currency)
VALUES (gen_random_uuid(), 'global', NULL, 'Global Books', 'USD')
ON CONFLICT DO NOTHING;

-- Seed a minimal standard chart
INSERT INTO accounting_standard_accounts (code, name, type, sub_type, normal_balance, is_leaf)
VALUES
  ('1000', 'Cash', 'asset', 'cash', 'debit', true),
  ('1100', 'Bank', 'asset', 'bank', 'debit', true),
  ('1200', 'Accounts Receivable', 'asset', 'current_asset', 'debit', true),
  ('2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', true),
  ('3000', 'Equity', 'equity', 'equity', 'credit', true),
  ('4000', 'Sales Revenue', 'income', 'sales', 'credit', true),
  ('5000', 'Cost of Goods Sold', 'expense', 'cogs', 'debit', true),
  ('6000', 'Operating Expenses', 'expense', 'opex', 'debit', true)
ON CONFLICT (code) DO NOTHING;

-- Add accounting permissions
INSERT INTO permissions (key, description)
VALUES
  ('accounting.view', 'View accounting data'),
  ('accounting.post', 'Post accounting journals'),
  ('accounting.manage_chart', 'Manage chart of accounts')
ON CONFLICT (key) DO NOTHING;

-- Grant to system roles
DO $$
DECLARE
  rid uuid;
BEGIN
  SELECT id INTO rid FROM roles WHERE key = 'global_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('accounting.view','accounting.post','accounting.manage_chart')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO rid FROM roles WHERE key = 'company_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('accounting.view','accounting.post','accounting.manage_chart')
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
