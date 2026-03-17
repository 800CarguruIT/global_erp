-- Improve customer list performance for large company datasets.
-- Supports:
-- 1) company/status paging ordered by created_at
-- 2) ILIKE search on code/name/email/phone

CREATE INDEX IF NOT EXISTS idx_customers_company_active_created_id
  ON customers(company_id, is_active, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_customers_company_created_id
  ON customers(company_id, created_at DESC, id DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_code_trgm
  ON customers USING gin (LOWER(code) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (LOWER(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
  ON customers USING gin (LOWER(email) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
  ON customers USING gin (LOWER(phone) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customer_car_links_company_customer_active
  ON customer_car_links(company_id, customer_id, is_active);
