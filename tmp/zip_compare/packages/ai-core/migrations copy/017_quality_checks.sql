-- 017_quality_checks.sql

CREATE TABLE IF NOT EXISTS quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  estimate_id uuid NULL REFERENCES estimates(id),
  inspection_id uuid NULL REFERENCES inspections(id),
  lead_id uuid NULL,
  car_id uuid NULL,
  customer_id uuid NULL,
  status text NOT NULL DEFAULT 'queue',
  test_drive_done boolean NOT NULL DEFAULT false,
  wash_done boolean NOT NULL DEFAULT false,
  qc_remarks text NULL,
  qc_video_ref text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_checks_company_status ON quality_checks(company_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quality_checks_work_order ON quality_checks(work_order_id);

CREATE TABLE IF NOT EXISTS quality_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_check_id uuid NOT NULL REFERENCES quality_checks(id) ON DELETE CASCADE,
  work_order_item_id uuid NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  qc_status text NOT NULL DEFAULT 'pending',
  qc_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_check_items_qc ON quality_check_items(quality_check_id, line_no);

CREATE OR REPLACE FUNCTION touch_quality_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_quality_checks_updated_at ON quality_checks;
CREATE TRIGGER trg_touch_quality_checks_updated_at
BEFORE UPDATE ON quality_checks
FOR EACH ROW EXECUTE FUNCTION touch_quality_checks_updated_at();
