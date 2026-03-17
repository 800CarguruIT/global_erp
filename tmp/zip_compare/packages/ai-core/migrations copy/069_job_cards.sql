CREATE TABLE IF NOT EXISTS job_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  done_by uuid NULL,
  start_at timestamptz NULL,
  complete_at timestamptz NULL,
  estimate_id uuid NULL REFERENCES estimates(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Pending',
  remarks text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_cards_status_check'
  ) THEN
    ALTER TABLE job_cards
      ADD CONSTRAINT job_cards_status_check
      CHECK (status IN ('Pending', 'Completed', 'Cancelled', 'Re-Assigned'));
  END IF;
END $$;

ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS job_card_id uuid NULL REFERENCES job_cards(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION touch_job_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_job_cards_updated_at ON job_cards;
CREATE TRIGGER trg_touch_job_cards_updated_at
BEFORE UPDATE ON job_cards
FOR EACH ROW EXECUTE FUNCTION touch_job_cards_updated_at();
