-- 148_company_nav_permissions.sql
-- Add granular company navigation permissions (non-destructive).

INSERT INTO permissions (key, description)
VALUES
  ('leads.rsa.view', 'View RSA leads list'),
  ('leads.rsa.assigned.view', 'View assigned RSA leads list'),
  ('jobs.rsa.view', 'View RSA jobs'),
  ('jobs.recovery.view', 'View recovery jobs'),
  ('jobs.workshop.view', 'View workshop jobs'),
  ('recovery.cc.view', 'View recovery call center page'),
  ('recovery.requests.view', 'View recovery requests page'),
  ('workshop.jobcards.view', 'View workshop job cards page'),
  ('workshop.earnings.view', 'View workshop earnings page'),
  ('ai.config.view', 'View AI configuration page'),
  ('ai.inquiries.view', 'View AI inquiries page')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  global_admin_id uuid;
BEGIN
  SELECT id INTO global_admin_id FROM roles WHERE key = 'global_admin' LIMIT 1;
  IF global_admin_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT global_admin_id, p.id
    FROM permissions p
    WHERE p.key IN (
      'leads.rsa.view',
      'leads.rsa.assigned.view',
      'jobs.rsa.view',
      'jobs.recovery.view',
      'jobs.workshop.view',
      'recovery.cc.view',
      'recovery.requests.view',
      'workshop.jobcards.view',
      'workshop.earnings.view',
      'ai.config.view',
      'ai.inquiries.view'
    )
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

DO $$
BEGIN
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM roles r
  JOIN permissions p
    ON p.key IN (
      'leads.rsa.view',
      'leads.rsa.assigned.view',
      'jobs.rsa.view',
      'jobs.recovery.view',
      'jobs.workshop.view',
      'recovery.cc.view',
      'recovery.requests.view',
      'workshop.jobcards.view',
      'workshop.earnings.view',
      'ai.config.view',
      'ai.inquiries.view'
    )
  WHERE r.key = 'company_admin'
  ON CONFLICT DO NOTHING;
END$$;

