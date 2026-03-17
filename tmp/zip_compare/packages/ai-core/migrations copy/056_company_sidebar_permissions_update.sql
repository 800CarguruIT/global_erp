-- 056_company_sidebar_permissions_update.sql
-- Ensure company sidebar permissions exist (non-destructive).
INSERT INTO permissions (key, description)
VALUES
  ('branches.view', 'View branches'),
  ('branches.create', 'Create branches'),
  ('fleet.cars.view', 'View cars'),
  ('integrations.dialer.use', 'Use dialer integrations'),
  ('accounting.view', 'View accounting'),
  ('accounting.manage_chart', 'Manage accounting chart'),
  ('accounting.post', 'Post accounting journals'),
  ('crm.customers.view', 'View customers'),
  ('crm.customers.edit', 'Edit customers'),
  ('hr.employees.view', 'View employees')
ON CONFLICT (key) DO NOTHING;
