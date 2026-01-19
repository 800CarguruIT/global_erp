-- 029_users_company_id.sql
-- Add company_id to users so we can associate users with a company

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON users(company_id);
