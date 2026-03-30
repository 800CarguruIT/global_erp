-- 180_customers_insurance_name.sql
-- Add insurance_name column to customers table for per-insurance-company assignment tracking

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS insurance_name text NULL;

CREATE INDEX IF NOT EXISTS idx_customers_company_insurance_name
  ON customers(company_id, insurance_name)
  WHERE insurance_name IS NOT NULL;

-- Populate insurance_name from insurance_data by matching on phone
UPDATE customers c
SET insurance_name = sub.insurance_name
FROM (
  SELECT DISTINCT ON (id.phone)
    id.phone,
    id.insurance_name,
    id.company_id
  FROM insurance_data id
  WHERE id.insurance_name IS NOT NULL AND TRIM(id.insurance_name) <> ''
  ORDER BY id.phone, id.id DESC
) sub
WHERE c.company_id = sub.company_id
  AND c.insurance_name IS NULL
  AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')
  AND TRIM(COALESCE(c.phone, '')) <> ''
  AND TRIM(c.phone) = TRIM(sub.phone);

-- Also match by name for customers without phone match
UPDATE customers c
SET insurance_name = sub.insurance_name
FROM (
  SELECT DISTINCT ON (UPPER(TRIM(id.insured_name)))
    UPPER(TRIM(id.insured_name)) AS match_name,
    id.insurance_name,
    id.company_id
  FROM insurance_data id
  WHERE id.insurance_name IS NOT NULL AND TRIM(id.insurance_name) <> ''
    AND TRIM(id.insured_name) <> ''
  ORDER BY UPPER(TRIM(id.insured_name)), id.id DESC
) sub
WHERE c.company_id = sub.company_id
  AND c.insurance_name IS NULL
  AND UPPER(TRIM(COALESCE(c.customer_type, ''))) IN ('INSURANCE', 'INSURANCE CUSTOMER', 'INSURANCE CUSTOMERS')
  AND UPPER(TRIM(c.name)) = sub.match_name;
