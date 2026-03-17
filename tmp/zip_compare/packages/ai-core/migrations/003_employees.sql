-- HR Employees core tables
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_code text NOT NULL UNIQUE,
  scope text NOT NULL, -- 'global' | 'company' | 'branch' | 'vendor'
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,

  first_name text NOT NULL,
  last_name text NOT NULL,
  full_name text NOT NULL,
  temp_address text NULL,
  perm_address text NULL,

  phone_personal text NULL,
  phone_company text NULL,
  email_personal text NULL,
  email_company text NULL,

  doc_id_number text NULL,
  doc_id_issue date NULL,
  doc_id_expiry date NULL,
  doc_passport_number text NULL,
  doc_passport_issue date NULL,
  doc_passport_expiry date NULL,
  doc_id_file_id uuid NULL,
  doc_passport_file_id uuid NULL,

  nationality text NULL,
  title text NULL,
  division text NULL,
  department text NULL,

  start_date date NULL,
  date_of_birth date NULL,

  basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  pension_amount numeric(14,2) NOT NULL DEFAULT 0,
  gratuity_amount numeric(14,2) NOT NULL DEFAULT 0,

  allowance_total numeric(14,2) NOT NULL DEFAULT 0,
  gov_fee_total numeric(14,2) NOT NULL DEFAULT 0,
  salary_grand_total numeric(14,2) NOT NULL DEFAULT 0,

  visa_required boolean NOT NULL DEFAULT false,
  visa_fee numeric(14,2) NOT NULL DEFAULT 0,
  immigration_fee numeric(14,2) NOT NULL DEFAULT 0,
  work_permit_fee numeric(14,2) NOT NULL DEFAULT 0,
  admin_fee numeric(14,2) NOT NULL DEFAULT 0,
  insurance_fee numeric(14,2) NOT NULL DEFAULT 0,

  employee_type text NOT NULL DEFAULT 'full_time',
  accommodation_type text NOT NULL DEFAULT 'self',
  transport_type text NOT NULL DEFAULT 'self',

  working_days_per_week integer NULL,
  working_hours_per_day numeric(5,2) NULL,
  official_day_off text NULL,

  emergency_name text NULL,
  emergency_phone text NULL,
  emergency_email text NULL,
  emergency_relation text NULL,
  emergency_address text NULL,

  image_file_id uuid NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_scope ON employees (scope, company_id, branch_id, vendor_id);

CREATE TABLE IF NOT EXISTS employee_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NULL,
  amount numeric(14,2) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_employee_allowances_employee_id ON employee_allowances (employee_id);
