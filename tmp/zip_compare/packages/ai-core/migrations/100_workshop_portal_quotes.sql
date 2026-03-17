-- 100_workshop_portal_quotes.sql

CREATE TABLE IF NOT EXISTS workshop_portal_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id uuid NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES companies(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  amount numeric(16,2) NOT NULL,
  timeframe text NOT NULL CHECK (timeframe IN ('same_day', 'next_day', 'two_three_days')),
  same_day_hours integer NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workshop_portal_quotes_job_card ON workshop_portal_quotes(job_card_id);
CREATE INDEX IF NOT EXISTS idx_workshop_portal_quotes_company ON workshop_portal_quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_workshop_portal_quotes_user ON workshop_portal_quotes(user_id);

CREATE OR REPLACE FUNCTION touch_workshop_portal_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_workshop_portal_quotes_updated_at ON workshop_portal_quotes;
CREATE TRIGGER trg_touch_workshop_portal_quotes_updated_at
BEFORE INSERT OR UPDATE ON workshop_portal_quotes
FOR EACH ROW EXECUTE FUNCTION touch_workshop_portal_quotes_updated_at();
