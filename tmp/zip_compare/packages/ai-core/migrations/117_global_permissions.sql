-- 117_global_permissions.sql
-- Add new global permissions for users, roles, and settings management.

INSERT INTO permissions (key, description)
VALUES
  ('global.users.list', 'List users from the global admin panel'),
  ('global.users.create', 'Create new global users'),
  ('global.users.edit', 'Edit global user profiles'),
  ('global.users.status', 'Change the status for global users'),
  ('global.users.delete', 'Delete global users'),
  ('global.roles.list', 'List global roles'),
  ('global.roles.create', 'Create new global roles'),
  ('global.roles.edit', 'Edit global roles'),
  ('global.roles.status', 'Change the status for global roles'),
  ('global.roles.delete', 'Delete global roles'),
  ('global.settings.manage', 'Manage global settings')
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
      WHERE key IN (
        'global.users.list',
        'global.users.create',
        'global.users.edit',
        'global.users.status',
        'global.users.delete',
        'global.roles.list',
        'global.roles.create',
        'global.roles.edit',
        'global.roles.status',
        'global.roles.delete',
        'global.settings.manage',
        'global.companies.list'
        'global.companies.list'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
