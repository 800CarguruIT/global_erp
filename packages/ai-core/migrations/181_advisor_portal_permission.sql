-- 181_advisor_portal_permission.sql
-- Add advisor portal permission

INSERT INTO permissions (key, description)
VALUES
  ('pis.advisor_portal.view', 'Access advisor portal')
ON CONFLICT (key) DO NOTHING;

-- Sync to global_admin
DO $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, p.id FROM permissions p
    WHERE p.key = 'pis.advisor_portal.view'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Sync to all company_admin roles
DO $$
DECLARE cid uuid;
BEGIN
  FOR cid IN SELECT id FROM roles WHERE key LIKE 'company_admin%' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, p.id FROM permissions p
    WHERE p.key = 'pis.advisor_portal.view'
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;
