-- 078_part_quotes.sql
CREATE TABLE IF NOT EXISTS part_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  estimate_item_id uuid NOT NULL REFERENCES estimate_items(id) ON DELETE CASCADE,
  type text NULL,
  status text NOT NULL DEFAULT 'Pending',
  part_number text NULL,
  part_region text NULL,
  diagram_url text NULL,
  part_pic text NULL,
  oem numeric(14,2) NULL,
  oe numeric(14,2) NULL,
  aftm numeric(14,2) NULL,
  used numeric(14,2) NULL,
  oem_qty numeric(10,2) NULL,
  oe_qty numeric(10,2) NULL,
  aftm_qty numeric(10,2) NULL,
  used_qty numeric(10,2) NULL,
  oem_etd text NULL,
  oe_etd text NULL,
  aftm_etd text NULL,
  used_etd text NULL,
  oem_date date NULL,
  oe_date date NULL,
  aftm_date date NULL,
  used_date date NULL,
  oem_time text NULL,
  oe_time text NULL,
  aftm_time text NULL,
  used_time text NULL,
  remarks text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_part_quotes_company_item ON part_quotes (company_id, estimate_item_id);
CREATE INDEX IF NOT EXISTS idx_part_quotes_vendor_item ON part_quotes (vendor_id, estimate_item_id);
CREATE INDEX IF NOT EXISTS idx_part_quotes_status ON part_quotes (status);

CREATE OR REPLACE FUNCTION touch_part_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_part_quotes_updated_at ON part_quotes;
CREATE TRIGGER trg_touch_part_quotes_updated_at
BEFORE UPDATE ON part_quotes
FOR EACH ROW EXECUTE FUNCTION touch_part_quotes_updated_at();
