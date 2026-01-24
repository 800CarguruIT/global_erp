-- 082_accounting_subheadings.sql

CREATE TABLE IF NOT EXISTS accounting_subheadings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heading_id uuid NOT NULL REFERENCES accounting_headings(id) ON DELETE CASCADE,
  name text NOT NULL,
  subhead_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_subheadings_heading_code
ON accounting_subheadings (heading_id, subhead_code);

CREATE OR REPLACE FUNCTION touch_accounting_subheadings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_accounting_subheadings_updated_at ON accounting_subheadings;
CREATE TRIGGER trg_touch_accounting_subheadings_updated_at
BEFORE UPDATE ON accounting_subheadings
FOR EACH ROW EXECUTE FUNCTION touch_accounting_subheadings_updated_at();
