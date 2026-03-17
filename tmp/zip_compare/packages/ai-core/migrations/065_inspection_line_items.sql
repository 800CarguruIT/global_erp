-- 065_inspection_line_items.sql

CREATE TABLE IF NOT EXISTS line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NULL,
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  product_id integer NULL,
  product_name text NULL,
  description text NULL,
  quantity integer NOT NULL DEFAULT 1,
  reason text NULL,
  status text NOT NULL DEFAULT 'Pending',
  media_file_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_company ON line_items (company_id);
CREATE INDEX IF NOT EXISTS idx_line_items_lead ON line_items (lead_id);
CREATE INDEX IF NOT EXISTS idx_line_items_inspection ON line_items (inspection_id);

CREATE OR REPLACE FUNCTION touch_line_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_line_items_updated_at ON line_items;
CREATE TRIGGER trg_touch_line_items_updated_at
BEFORE UPDATE ON line_items
FOR EACH ROW EXECUTE FUNCTION touch_line_items_updated_at();
