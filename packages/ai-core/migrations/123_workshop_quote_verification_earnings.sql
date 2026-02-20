-- Workshop quote verification + earnings snapshot for completed job cards.

ALTER TABLE workshop_quotes
  ADD COLUMN IF NOT EXISTS verified_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workshop_quotes_status_check'
      AND conrelid = 'workshop_quotes'::regclass
  ) THEN
    ALTER TABLE workshop_quotes
      DROP CONSTRAINT workshop_quotes_status_check;
  END IF;
END $$;

ALTER TABLE workshop_quotes
  ADD CONSTRAINT workshop_quotes_status_check
  CHECK (status IN ('pending', 'accepted', 'negotiation', 'rejected', 'cancelled', 'verified'));

CREATE INDEX IF NOT EXISTS idx_workshop_quotes_verified_at
  ON workshop_quotes (verified_at DESC);

CREATE TABLE IF NOT EXISTS workshops_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workshop_quote_id uuid NOT NULL REFERENCES workshop_quotes(id) ON DELETE CASCADE,
  job_card_id uuid NULL REFERENCES job_cards(id) ON DELETE SET NULL,
  estimate_id uuid NULL REFERENCES estimates(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES leads(id) ON DELETE SET NULL,
  branch_id uuid NULL REFERENCES branches(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'USD',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate numeric(6,2) NOT NULL DEFAULT 0,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  fine_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  verified_by uuid NULL REFERENCES users(id),
  verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_workshops_earnings_quote UNIQUE (workshop_quote_id)
);

CREATE INDEX IF NOT EXISTS idx_workshops_earnings_company_branch_verified
  ON workshops_earnings (company_id, branch_id, verified_at DESC);

CREATE INDEX IF NOT EXISTS idx_workshops_earnings_job_card
  ON workshops_earnings (job_card_id);

CREATE OR REPLACE FUNCTION touch_workshops_earnings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_workshops_earnings_updated_at ON workshops_earnings;
CREATE TRIGGER trg_touch_workshops_earnings_updated_at
BEFORE UPDATE ON workshops_earnings
FOR EACH ROW EXECUTE FUNCTION touch_workshops_earnings_updated_at();
