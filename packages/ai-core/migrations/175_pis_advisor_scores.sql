-- 175_pis_advisor_scores.sql
-- Materialized advisor composite scores for PIS V4 lead distribution

CREATE TABLE IF NOT EXISTS pis_advisor_scores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  advisor_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  composite_score   numeric(6,2) NOT NULL DEFAULT 0,
  conversion_rate   numeric(6,2) NOT NULL DEFAULT 0,
  gp_pct            numeric(6,2) NOT NULL DEFAULT 0,
  revenue           numeric(14,2) NOT NULL DEFAULT 0,
  paid_pct          numeric(6,2) NOT NULL DEFAULT 0,
  foc_pct           numeric(6,2) NOT NULL DEFAULT 0,
  sla_compliance    numeric(6,2) NOT NULL DEFAULT 0,
  call_quality      numeric(6,2) NOT NULL DEFAULT 0,
  customer_sat      numeric(6,2) NOT NULL DEFAULT 0,
  tier              text NOT NULL DEFAULT 'STANDARD' CHECK (tier IN ('ELITE','STANDARD')),
  rank              integer NULL,
  score_breakdown   jsonb NOT NULL DEFAULT '{}'::jsonb,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  computed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, advisor_user_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pis_advisor_scores_company ON pis_advisor_scores (company_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pis_advisor_scores_tier ON pis_advisor_scores (company_id, tier, composite_score DESC);