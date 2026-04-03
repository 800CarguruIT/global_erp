-- Refactor permissions to match current sidebar structure.
-- Old permissions are kept in DB (role_permissions links still reference them)
-- but new clean permissions are added for the current UI.

-- Sales section
INSERT INTO permissions (key, description) VALUES
  ('sales.call_history.view',  'View Call History'),
  ('sales.inquiry.view',       'View AI Inquiries'),
  ('sales.leads.view',         'View Leads'),
  ('sales.leads.create',       'Create Leads'),
  ('sales.booking.view',       'View Booking'),
  ('sales.booking.manage',     'Manage Booking'),
  ('sales.rsa_leads.view',     'View RSA Leads'),
  ('sales.estimates.view',     'View Estimates'),
  ('sales.estimates.create',   'Create Estimates')
ON CONFLICT (key) DO NOTHING;

-- Service Center section
INSERT INTO permissions (key, description) VALUES
  ('service.advisor_portal.view',  'View Advisor Portal'),
  ('service.car_in_dashboard.view','View Car In Dashboard')
ON CONFLICT (key) DO NOTHING;

-- Operations
INSERT INTO permissions (key, description) VALUES
  ('ops.dashboard.view',  'View Operations Dashboard')
ON CONFLICT (key) DO NOTHING;

-- Parts
INSERT INTO permissions (key, description) VALUES
  ('parts.quotes.view',    'View Parts Quotes'),
  ('parts.quotes.create',  'Create Parts Quotes')
ON CONFLICT (key) DO NOTHING;

-- My RSA Jobs (technician)
INSERT INTO permissions (key, description) VALUES
  ('tech.rsa_jobs.view',   'View My RSA Jobs'),
  ('tech.rsa_jobs.manage', 'Manage RSA Jobs (accept, update status)')
ON CONFLICT (key) DO NOTHING;

-- People management
INSERT INTO permissions (key, description) VALUES
  ('people.employees.view',   'View Employees'),
  ('people.employees.manage', 'Manage Employees'),
  ('people.users.view',       'View Users'),
  ('people.users.manage',     'Manage Users'),
  ('people.roles.view',       'View Roles & Permissions'),
  ('people.roles.manage',     'Manage Roles & Permissions')
ON CONFLICT (key) DO NOTHING;
