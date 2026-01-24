-- Ledger tables tied to accounting_entities
CREATE TABLE IF NOT EXISTS accounting_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','company')),
  company_id uuid NULL REFERENCES companies(id),
  name text NOT NULL,
  base_currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES accounting_entities(id) ON DELETE CASCADE,
  journal_no text NOT NULL,
  journal_type text NOT NULL,
  date date NOT NULL,
  description text NULL,
  reference text NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_by_user_id uuid NULL REFERENCES users(id),
  is_posted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, journal_no)
);

CREATE TABLE IF NOT EXISTS accounting_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES accounting_journals(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES accounting_entities(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  account_id uuid NOT NULL REFERENCES accounting_accounts(id),
  description text NULL,
  debit numeric(18,4) NOT NULL DEFAULT 0,
  credit numeric(18,4) NOT NULL DEFAULT 0,
  company_id uuid NULL REFERENCES companies(id),
  branch_id uuid NULL,
  vendor_id uuid NULL,
  employee_id uuid NULL,
  project_id uuid NULL,
  cost_center text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_journals_entity ON accounting_journals (entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_journal ON accounting_journal_lines (journal_id);
CREATE INDEX IF NOT EXISTS idx_accounting_journal_lines_entity ON accounting_journal_lines (entity_id);

-- Seed default global entity
INSERT INTO accounting_entities (scope, company_id, name)
VALUES ('global', NULL, 'Global Books')
ON CONFLICT (scope, company_id) DO NOTHING;
