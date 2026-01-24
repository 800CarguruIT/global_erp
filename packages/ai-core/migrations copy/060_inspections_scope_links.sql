-- 060_inspections_scope_links.sql
-- Ensure inspections are scoped to company/branch/lead with indexes.

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL;

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS lead_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_inspections_company
  ON inspections (company_id);

CREATE INDEX IF NOT EXISTS idx_inspections_company_branch
  ON inspections (company_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_inspections_company_lead
  ON inspections (company_id, lead_id);
