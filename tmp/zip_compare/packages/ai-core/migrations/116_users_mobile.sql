-- 116_users_mobile.sql
-- Add a mobile phone number column for users (used by the global user form).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mobile text NULL;

