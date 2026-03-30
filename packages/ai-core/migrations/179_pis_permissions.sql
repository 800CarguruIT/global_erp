-- 179_pis_permissions.sql
-- PIS V4.0 granular permissions

INSERT INTO permissions (key, description)
VALUES
  ('pis.dashboard.view',         'View PIS dashboard'),
  ('pis.advisors.view',          'View PIS advisor scores and leaderboard'),
  ('pis.lead_distribution.view', 'View lead distribution queue'),
  ('pis.lead_distribution.manage','Manage lead distribution and routing'),
  ('pis.funnel.view',            'View PIS funnel analytics'),
  ('pis.estimates.view',         'View PIS estimate pipeline'),
  ('pis.wip.view',               'View PIS WIP tracking'),
  ('pis.collections.view',       'View PIS collections and revenue'),
  ('pis.engines.view',           'View PIS AI engines'),
  ('pis.signals.view',           'View PIS signals'),
  ('pis.admin.manage',           'Manage PIS admin configuration')
ON CONFLICT (key) DO NOTHING;

-- Re-sync global_admin
DO $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, p.id FROM permissions p
    WHERE p.key LIKE 'pis.%'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Re-sync company_admin
DO $$
DECLARE cid uuid;
BEGIN
  FOR cid IN SELECT id FROM roles WHERE key = 'company_admin' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, p.id FROM permissions p
    WHERE p.key LIKE 'pis.%'
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;