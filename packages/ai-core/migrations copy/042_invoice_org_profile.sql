-- Organization profile for invoices / settings
CREATE TABLE IF NOT EXISTS billing_org_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Global ERP',
  address text NULL,
  email text NULL,
  phone text NULL,
  tax_id text NULL,
  website text NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO billing_org_profile (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM billing_org_profile);
