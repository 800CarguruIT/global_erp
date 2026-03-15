-- 160_part_brands.sql
-- Persist vendor-selected part brands for reuse in quote flows.

ALTER TABLE part_quotes
  ADD COLUMN IF NOT EXISTS part_brand text NULL;

CREATE TABLE IF NOT EXISTS part_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_part_brands_company
  ON part_brands (company_id, updated_at DESC);

CREATE OR REPLACE FUNCTION touch_part_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_part_brands_updated_at ON part_brands;
CREATE TRIGGER trg_touch_part_brands_updated_at
BEFORE UPDATE ON part_brands
FOR EACH ROW EXECUTE FUNCTION touch_part_brands_updated_at();

