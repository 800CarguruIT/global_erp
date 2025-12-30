-- 024_accounting_config.sql

CREATE TABLE IF NOT EXISTS accounting_company_settings (
  company_id uuid PRIMARY KEY,
  ar_control_account_id uuid NULL,
  ap_control_account_id uuid NULL,

  sales_revenue_account_id uuid NULL,
  workshop_revenue_account_id uuid NULL,
  rsa_revenue_account_id uuid NULL,
  recovery_revenue_account_id uuid NULL,

  cogs_account_id uuid NULL,
  labor_cost_account_id uuid NULL,
  inventory_account_id uuid NULL,
  wip_account_id uuid NULL,

  vat_output_account_id uuid NULL,
  vat_input_account_id uuid NULL,

  discount_given_account_id uuid NULL,
  discount_received_account_id uuid NULL,
  rounding_diff_account_id uuid NULL,

  cash_account_id uuid NULL,
  bank_clearing_account_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_accounting_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_accounting_company_settings_updated_at ON accounting_company_settings;
CREATE TRIGGER trg_touch_accounting_company_settings_updated_at
BEFORE UPDATE ON accounting_company_settings
FOR EACH ROW EXECUTE FUNCTION touch_accounting_company_settings_updated_at();
