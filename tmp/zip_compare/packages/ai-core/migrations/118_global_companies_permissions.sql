-- 118_global_companies_permissions.sql
-- Add a separate migration that seeds the global companies list permission.

INSERT INTO permissions (key, description)
VALUES
  ('global.companies.list', 'List companies in the global console')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin';
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, id
    FROM permissions
    WHERE key = 'global.companies.list'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
