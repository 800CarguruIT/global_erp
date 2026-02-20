-- 099_workshop_import_staging.sql
-- Staging tables that mirror the legacy CG2 dump (C:\Users\DELL\Downloads\carguru2.sql) so the import
-- path can normalize its data before it flows into the primary workshop modules.

CREATE TABLE IF NOT EXISTS workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id integer NOT NULL UNIQUE,
  engagement_type text NOT NULL DEFAULT 'company' CHECK (engagement_type IN ('independent','company')),
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  contact_name text NOT NULL,
  speciality text,
  phone text NOT NULL,
  phone_secondary text,
  email text NOT NULL,
  iban text,
  bank_name text,
  trn text,
  lifts integer NOT NULL DEFAULT 0,
  trade_license text,
  password_hash text,
  token text,
  address text,
  emirate text,
  pin_location_text text,
  pin_location_geo jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  has_vat boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workshop_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id integer NOT NULL UNIQUE,
  workshop_legacy_id integer NOT NULL,
  workshop_id uuid REFERENCES workshops(id) ON DELETE SET NULL,
  estimate_id integer,
  is_car_in boolean NOT NULL DEFAULT false,
  amount numeric(16,2) NOT NULL DEFAULT 0,
  additional_amount numeric(16,2) NOT NULL DEFAULT 0,
  accepted_amount numeric(16,2),
  etd text,
  status text,
  job_start timestamptz,
  job_end timestamptz,
  car_front text,
  car_right text,
  car_left text,
  car_rear text,
  car_in_media text,
  car_out_media text,
  work_video_url text,
  car_in_video text,
  car_mileage integer,
  final_check boolean NOT NULL DEFAULT false,
  remarks text,
  scrap_received boolean NOT NULL DEFAULT false,
  fine text,
  fine_reason text,
  scrap_reason text,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workshop_quotes_workshop_legacy_fk FOREIGN KEY (workshop_legacy_id)
    REFERENCES workshops(legacy_id)
);

-- If workshop_quotes already exists from newer ERP schema, ensure legacy import column exists.
ALTER TABLE workshop_quotes
  ADD COLUMN IF NOT EXISTS workshop_legacy_id integer;

CREATE OR REPLACE FUNCTION carguru_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workshops_touch_updated_at ON workshops;
CREATE TRIGGER trg_workshops_touch_updated_at
  BEFORE INSERT OR UPDATE ON workshops
  FOR EACH ROW EXECUTE FUNCTION carguru_touch_updated_at();

DROP TRIGGER IF EXISTS trg_workshop_quotes_touch_updated_at ON workshop_quotes;
CREATE TRIGGER trg_workshop_quotes_touch_updated_at
  BEFORE INSERT OR UPDATE ON workshop_quotes
  FOR EACH ROW EXECUTE FUNCTION carguru_touch_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS idx_workshops_phone ON workshops (phone);
CREATE INDEX IF NOT EXISTS idx_workshops_name_lower ON workshops (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_workshops_pin_geo ON workshops USING gin (pin_location_geo);
CREATE INDEX IF NOT EXISTS idx_workshops_company_id ON workshops (company_id);

CREATE INDEX IF NOT EXISTS idx_workshop_quotes_workshop_legacy_id
  ON workshop_quotes (workshop_legacy_id);
CREATE INDEX IF NOT EXISTS idx_workshop_quotes_status ON workshop_quotes (status);
CREATE INDEX IF NOT EXISTS idx_workshop_quotes_created_at ON workshop_quotes (created_at);
