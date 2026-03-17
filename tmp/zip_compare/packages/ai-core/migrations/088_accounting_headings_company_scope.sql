-- 088_accounting_headings_company_scope.sql

ALTER TABLE IF EXISTS accounting_headings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_accounting_headings_company
ON accounting_headings (company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_headings_code_company
ON accounting_headings (head_code, company_id);

ALTER TABLE IF EXISTS accounting_subheadings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_accounting_subheadings_company
ON accounting_subheadings (company_id);
