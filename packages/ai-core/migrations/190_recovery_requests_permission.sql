-- Add recovery requests permissions
INSERT INTO permissions (key, description) VALUES
  ('ops.recovery_requests.view', 'View Recovery Requests'),
  ('ops.recovery_requests.manage', 'Manage Recovery Requests')
ON CONFLICT (key) DO NOTHING;

-- Assign to all Company Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Company Admin' AND r.scope = 'company'
  AND p.key IN ('ops.recovery_requests.view', 'ops.recovery_requests.manage')
ON CONFLICT DO NOTHING;