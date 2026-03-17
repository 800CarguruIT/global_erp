-- Extend users table if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employee_id') THEN
    ALTER TABLE users ADD COLUMN employee_id uuid NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_active') THEN
    ALTER TABLE users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_at') THEN
    ALTER TABLE users ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'updated_at') THEN
    ALTER TABLE users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  scope text NOT NULL, -- 'global' | 'company' | 'branch' | 'vendor'
  company_id uuid NULL,
  branch_id uuid NULL,
  vendor_id uuid NULL,
  description text NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_scope_company_branch_vendor
  ON roles (scope, company_id, branch_id, vendor_id);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions (role_id);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);

-- Seed permissions
INSERT INTO permissions (key, description)
VALUES
  ('global.admin', 'Global platform administrator'),
  ('company.admin', 'Company administrator'),
  ('hr.employees.view', 'View employees'),
  ('hr.employees.edit', 'Edit employees'),
  ('hr.employees.manage_salary', 'Manage employee salaries'),
  ('integrations.manage', 'Manage integrations'),
  ('integrations.dialer.use', 'Use dialer integrations'),
  ('integrations.channel.use', 'Use channel integrations')
ON CONFLICT (key) DO NOTHING;

-- Seed roles
WITH perm AS (
  SELECT key, id FROM permissions
)
INSERT INTO roles (name, key, scope, is_system)
VALUES
  ('Global Admin', 'global_admin', 'global', true),
  ('Company Admin', 'company_admin', 'company', true),
  ('HR Manager', 'hr_manager', 'company', false)
ON CONFLICT (key) DO NOTHING;

-- Attach permissions to system roles
DO $$
DECLARE
  gid uuid;
  cid uuid;
  hid uuid;
BEGIN
  SELECT id INTO gid FROM roles WHERE key = 'global_admin';
  SELECT id INTO cid FROM roles WHERE key = 'company_admin';
  SELECT id INTO hid FROM roles WHERE key = 'hr_manager';

  IF gid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT gid, id FROM permissions
    ON CONFLICT DO NOTHING;
  END IF;

  IF cid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT cid, id FROM permissions
    ON CONFLICT DO NOTHING;
  END IF;

  IF hid IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT hid, id FROM permissions WHERE key LIKE 'hr.employees.%'
    ON CONFLICT DO NOTHING;
  END IF;
END$$;
