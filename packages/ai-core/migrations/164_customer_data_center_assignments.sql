-- 164_customer_data_center_assignments.sql
-- Customer ownership, supervisor-agent allocation, and assignment audit trail for call-center/sales data center.

CREATE TABLE IF NOT EXISTS customer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  supervisor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  agent_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  segment text NOT NULL DEFAULT 'unknown'
    CHECK (segment IN ('chsc', 'non_chsc', 'insurance', 'warranty', 'unknown')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'unassigned', 'reassigned')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_assignments_company_status
  ON customer_assignments(company_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_supervisor
  ON customer_assignments(company_id, supervisor_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_agent
  ON customer_assignments(company_id, agent_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignments_segment
  ON customer_assignments(company_id, segment);

CREATE TABLE IF NOT EXISTS customer_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assignment_id uuid NULL REFERENCES customer_assignments(id) ON DELETE SET NULL,
  old_supervisor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  new_supervisor_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  old_agent_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  new_agent_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  old_segment text NULL,
  new_segment text NULL,
  action text NOT NULL
    CHECK (action IN ('assign', 'reassign', 'unassign', 'bulk_assign', 'update')),
  reason text NULL,
  changed_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_assignment_history_company_customer
  ON customer_assignment_history(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_assignment_history_changed_at
  ON customer_assignment_history(company_id, changed_at DESC);
