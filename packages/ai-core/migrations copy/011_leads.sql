-- 011_leads.sql

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  car_id uuid REFERENCES cars(id) ON DELETE SET NULL,
  agent_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,

  lead_type text NOT NULL CHECK (lead_type IN ('rsa', 'recovery', 'workshop')),
  lead_status text NOT NULL CHECK (lead_status IN ('open', 'processing', 'closed_won', 'lost')),
  lead_stage text NOT NULL,
  source text,

  sla_minutes integer,
  first_response_at timestamptz,
  last_activity_at timestamptz,
  closed_at timestamptz,

  health_score integer,
  sentiment_score integer,
  customer_feedback text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_agent_employee_id ON leads(agent_employee_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type);

CREATE TABLE IF NOT EXISTS lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,

  event_type text NOT NULL,
  event_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_company_id ON lead_events(company_id);
