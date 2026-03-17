-- 010_auth_users.sql
-- Ensure users table has auth fields (email/password_hash/is_active)

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS password_hash text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE;

-- Remove defaults now that columns exist to avoid forcing blank values on future inserts
ALTER TABLE IF EXISTS users
  ALTER COLUMN email DROP DEFAULT,
  ALTER COLUMN password_hash DROP DEFAULT;

-- Ensure email uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
