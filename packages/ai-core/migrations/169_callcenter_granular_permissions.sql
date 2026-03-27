-- 169_callcenter_granular_permissions.sql
-- Add granular per-page permissions for Call Center sub-items.
-- callcenter.view is repurposed to "Overview only".

INSERT INTO permissions (key, description)
VALUES
  ('callcenter.dashboard.view',   'View call center dashboard'),
  ('callcenter.outbound.view',    'View outbound dialer'),
  ('callcenter.customers.view',   'View call center customers list'),
  ('callcenter.datacenter.view',  'View data center'),
  ('callcenter.extensions.view',  'View user extensions / dialer settings')
ON CONFLICT (key) DO NOTHING;

-- Update description of the existing overview permission for clarity
UPDATE permissions SET description = 'View call center overview' WHERE key = 'callcenter.view';

-- Re-sync global_admin with new permissions
DO $$
DECLARE gid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, p.id FROM permissions p
    WHERE p.key IN (
      'callcenter.dashboard.view',
      'callcenter.outbound.view',
      'callcenter.customers.view',
      'callcenter.datacenter.view',
      'callcenter.extensions.view'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Re-sync company_admin with new permissions
DO $$
DECLARE cid uuid;
BEGIN
  FOR cid IN SELECT id FROM roles WHERE key = 'company_admin' LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, p.id FROM permissions p
    WHERE p.key IN (
      'callcenter.dashboard.view',
      'callcenter.outbound.view',
      'callcenter.customers.view',
      'callcenter.datacenter.view',
      'callcenter.extensions.view'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;
