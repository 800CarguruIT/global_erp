-- Extend companies table with master data fields
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS logo_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS display_name text NULL,
  ADD COLUMN IF NOT EXISTS legal_name text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_number text NULL,
  ADD COLUMN IF NOT EXISTS trade_license_issue date NULL,
  ADD COLUMN IF NOT EXISTS trade_license_expiry date NULL,
  ADD COLUMN IF NOT EXISTS trade_license_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS has_vat_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_corporate_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_number text NULL,
  ADD COLUMN IF NOT EXISTS vat_certificate_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS corporate_tax_number text NULL,
  ADD COLUMN IF NOT EXISTS corporate_tax_certificate_file_id uuid NULL,
  ADD COLUMN IF NOT EXISTS owner_name text NULL,
  ADD COLUMN IF NOT EXISTS owner_passport_number text NULL,
  ADD COLUMN IF NOT EXISTS owner_passport_issue date NULL,
  ADD COLUMN IF NOT EXISTS owner_passport_expiry date NULL,
  ADD COLUMN IF NOT EXISTS company_domain text NULL,
  ADD COLUMN IF NOT EXISTS company_email text NULL,
  ADD COLUMN IF NOT EXISTS company_phone text NULL,
  ADD COLUMN IF NOT EXISTS address_line1 text NULL,
  ADD COLUMN IF NOT EXISTS address_line2 text NULL,
  ADD COLUMN IF NOT EXISTS city text NULL,
  ADD COLUMN IF NOT EXISTS state_region text NULL,
  ADD COLUMN IF NOT EXISTS postal_code text NULL,
  ADD COLUMN IF NOT EXISTS country text NULL,
  ADD COLUMN IF NOT EXISTS timezone text NULL,
  ADD COLUMN IF NOT EXISTS currency text NULL;

-- Company contacts
CREATE TABLE IF NOT EXISTS company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NULL,
  name text NOT NULL,
  phone text NULL,
  email text NULL,
  address text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_contacts_company ON company_contacts(company_id);

-- Customers (company scoped)
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_type text NOT NULL DEFAULT 'individual',
  code text NOT NULL,
  name text NOT NULL,
  first_name text NULL,
  last_name text NULL,
  date_of_birth date NULL,
  national_id text NULL,
  passport_no text NULL,
  legal_name text NULL,
  trade_license_no text NULL,
  tax_number text NULL,
  email text NULL,
  phone text NULL,
  phone_alt text NULL,
  whatsapp_phone text NULL,
  address text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_company_code ON customers(company_id, code);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id, is_active);

-- Cars (company scoped)
CREATE TABLE IF NOT EXISTS cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  plate_number text NOT NULL,
  vin text NULL,
  make text NULL,
  model text NULL,
  model_year integer NULL,
  color text NULL,
  body_type text NULL,
  mileage numeric(12,2) NULL,
  tyre_size_front text NULL,
  tyre_size_back text NULL,
  registration_expiry date NULL,
  registration_card_file_id uuid NULL,
  is_unregistered boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_company_code ON cars(company_id, code);
CREATE INDEX IF NOT EXISTS idx_cars_company ON cars(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cars_company_plate ON cars(company_id, plate_number);

-- Customer ↔ Car links
CREATE TABLE IF NOT EXISTS customer_car_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  is_primary boolean NOT NULL DEFAULT false,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_car_relation
  ON customer_car_links(customer_id, car_id, relation_type, priority);
CREATE INDEX IF NOT EXISTS idx_customer_car_company ON customer_car_links(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_car_customer ON customer_car_links(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_car_car ON customer_car_links(car_id);

-- Add CRM & Fleet permissions
INSERT INTO permissions (key, description)
VALUES
  ('crm.customers.view', 'View customers'),
  ('crm.customers.edit', 'Edit customers'),
  ('fleet.cars.view', 'View cars'),
  ('fleet.cars.edit', 'Edit cars')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  rid uuid;
BEGIN
  SELECT id INTO rid FROM roles WHERE key = 'global_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('crm.customers.view','crm.customers.edit','fleet.cars.view','fleet.cars.edit')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO rid FROM roles WHERE key = 'company_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions WHERE key IN ('crm.customers.view','crm.customers.edit','fleet.cars.view','fleet.cars.edit')
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
