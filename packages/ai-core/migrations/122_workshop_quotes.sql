CREATE TABLE IF NOT EXISTS workshop_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  job_card_id uuid NULL REFERENCES job_cards(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  currency text NULL,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  eta_preset text NULL,
  eta_hours integer NULL,
  remarks text NULL,
  negotiated_amount numeric(14,2) NULL,
  meta jsonb NULL,
  created_by uuid NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workshop_quotes_status_check'
      AND conrelid = 'workshop_quotes'::regclass
  ) THEN
    ALTER TABLE workshop_quotes
      ADD CONSTRAINT workshop_quotes_status_check
      CHECK (status IN ('pending', 'accepted', 'negotiation', 'rejected', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workshop_quotes_company_status
  ON workshop_quotes (company_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workshop_quotes_estimate
  ON workshop_quotes (estimate_id, branch_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workshop_quotes_job_card
  ON workshop_quotes (job_card_id);

CREATE OR REPLACE FUNCTION touch_workshop_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_workshop_quotes_updated_at ON workshop_quotes;
CREATE TRIGGER trg_touch_workshop_quotes_updated_at
BEFORE UPDATE ON workshop_quotes
FOR EACH ROW EXECUTE FUNCTION touch_workshop_quotes_updated_at();
