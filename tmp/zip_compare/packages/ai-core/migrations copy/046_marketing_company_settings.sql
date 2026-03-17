-- Company-level marketing settings (EasyCron)
CREATE TABLE IF NOT EXISTS marketing_company_settings (
  company_id UUID PRIMARY KEY,
  easycron_api_key TEXT NULL,
  easycron_timezone TEXT NULL,
  schedule_launch BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_delay BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION touch_marketing_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_marketing_company_settings_updated_at ON marketing_company_settings;

CREATE TRIGGER trg_touch_marketing_company_settings_updated_at
BEFORE UPDATE ON marketing_company_settings
FOR EACH ROW EXECUTE FUNCTION touch_marketing_company_settings_updated_at();
