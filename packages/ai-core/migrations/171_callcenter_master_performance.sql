-- 171_callcenter_master_performance.sql
-- Add permission for the Master Performance dashboard under Call Center.

INSERT INTO permissions (key, description)
VALUES ('callcenter.master_performance.view', 'View master performance dashboard')
ON CONFLICT (key) DO NOTHING;

-- Grant to global_admin
DO $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, p.id FROM permissions p
    WHERE p.key = 'callcenter.master_performance.view'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Grant to all company_admin roles
DO $$
DECLARE cid uuid;
BEGIN
  FOR cid IN SELECT id FROM roles WHERE key = 'company_admin' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, p.id FROM permissions p
    WHERE p.key = 'callcenter.master_performance.view'
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;
