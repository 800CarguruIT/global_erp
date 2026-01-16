-- Add branch management permissions
INSERT INTO permissions (key, description)
VALUES
  ('branches.view', 'View branches'),
  ('branches.create', 'Create branches'),
  ('branches.edit', 'Edit branches'),
  ('branches.delete', 'Delete branches'),
  ('branch.admin', 'Branch administrator')
ON CONFLICT (key) DO NOTHING;

-- Grant to system roles
DO $$
DECLARE
  rid uuid;
BEGIN
  SELECT id INTO rid FROM roles WHERE key = 'global_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions
    WHERE key IN (
      'branches.view',
      'branches.create',
      'branches.edit',
      'branches.delete',
      'branch.admin'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO rid FROM roles WHERE key = 'company_admin';
  IF rid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT rid, id FROM permissions
    WHERE key IN (
      'branches.view',
      'branches.create',
      'branches.edit',
      'branches.delete',
      'branch.admin'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
