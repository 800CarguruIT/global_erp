-- Add home_page to roles: lets company/branch admins configure where
-- users with that role land after login.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS home_page TEXT NULL;
