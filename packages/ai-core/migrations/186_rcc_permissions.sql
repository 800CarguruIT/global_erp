INSERT INTO permissions (key, description)
VALUES
  ('rcc.dashboard.view', 'View Revenue Command Center dashboard'),
  ('rcc.marketing_spend.manage', 'Manage marketing spend data for Revenue Command Center')
ON CONFLICT DO NOTHING;
