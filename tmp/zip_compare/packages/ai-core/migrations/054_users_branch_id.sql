-- 054_users_branch_id.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_users_company_branch ON users (company_id, branch_id);
