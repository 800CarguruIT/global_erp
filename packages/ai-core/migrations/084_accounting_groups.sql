-- 084_accounting_groups.sql

CREATE TABLE IF NOT EXISTS accounting_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading_id uuid NOT NULL REFERENCES accounting_headings(id) ON DELETE CASCADE,
  subheading_id uuid NOT NULL REFERENCES accounting_subheadings(id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_groups_subheading_code
ON accounting_groups (subheading_id, group_code);

CREATE INDEX IF NOT EXISTS idx_accounting_groups_company
ON accounting_groups (company_id);

CREATE OR REPLACE FUNCTION touch_accounting_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_accounting_groups_updated_at ON accounting_groups;
CREATE TRIGGER trg_touch_accounting_groups_updated_at
BEFORE UPDATE ON accounting_groups
FOR EACH ROW EXECUTE FUNCTION touch_accounting_groups_updated_at();
