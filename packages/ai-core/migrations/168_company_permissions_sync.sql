-- 168_company_permissions_sync.sql
-- Add missing company-scope permissions and re-sync system roles so that
-- global_admin and company_admin always hold every permission.
--
-- Background: migration 004 assigned all permissions to both system roles,
-- but only as a one-time snapshot.  Migrations 055/053 added many new
-- permissions without re-assigning them, leaving company_admin blind to
-- most company-scope features.  Migration 148 fixed its own batch; this
-- migration fixes the rest and establishes a catch-all for future runs.

-- 1. Add new permissions -------------------------------------------------
INSERT INTO permissions (key, description)
VALUES
  ('quotes.parts.view', 'View parts quotes'),
  ('sales.view',        'Access sales section')
ON CONFLICT (key) DO NOTHING;

-- 2. Re-sync global_admin: grant every permission -----------------------
DO $$
DECLARE
  gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, p.id FROM permissions p
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- 3. Re-sync company_admin: grant all non-global permissions ------------
DO $$
DECLARE
  cid uuid;
BEGIN
  SELECT id INTO cid FROM roles WHERE key = 'company_admin' LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, p.id FROM permissions p
    WHERE p.key NOT LIKE 'global.%'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
