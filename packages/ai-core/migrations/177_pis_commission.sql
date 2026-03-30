-- 177_pis_commission.sql
-- Commission calculations per advisor per period

CREATE TABLE IF NOT EXISTS pis_commission_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  advisor_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month          date NOT NULL,
  base_commission_pct   numeric(5,2) NOT NULL DEFAULT 3.0,
  performance_pct       numeric(5,2) NOT NULL DEFAULT 0,
  effective_pct         numeric(5,2) NOT NULL DEFAULT 3.0,
  revenue_base          numeric(14,2) NOT NULL DEFAULT 0,
  gp_base               numeric(14,2) NOT NULL DEFAULT 0,
  foc_deduction         numeric(14,2) NOT NULL DEFAULT 0,
  commission_amount     numeric(14,2) NOT NULL DEFAULT 0,
  detail                jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, advisor_user_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_pis_commission_company ON pis_commission_records (company_id, period_month);