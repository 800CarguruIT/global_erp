-- 077_users_vendor_id.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vendor_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_vendor ON users (company_id, vendor_id);
