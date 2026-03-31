-- Revenue Command Center: marketing spend per source per period
CREATE TABLE IF NOT EXISTS rcc_marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  spend_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AED',
  notes text,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rcc_mktspend_src_period
  ON rcc_marketing_spend(company_id, source, period_start, period_end);
