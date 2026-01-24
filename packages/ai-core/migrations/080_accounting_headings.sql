-- 080_accounting_headings.sql

CREATE TABLE IF NOT EXISTS accounting_headings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  head_code text NOT NULL,
  financial_stmt text NOT NULL, -- Balance Sheet | Profit & Loss
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_headings_head_code
ON accounting_headings (head_code);

CREATE OR REPLACE FUNCTION touch_accounting_headings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_accounting_headings_updated_at ON accounting_headings;
CREATE TRIGGER trg_touch_accounting_headings_updated_at
BEFORE UPDATE ON accounting_headings
FOR EACH ROW EXECUTE FUNCTION touch_accounting_headings_updated_at();
