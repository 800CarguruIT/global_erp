-- 176_pis_lead_distribution.sql
-- Lead distribution queue with cascade tracking for PIS V4

CREATE TABLE IF NOT EXISTS pis_lead_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','offered','accepted','locked','released','manual','completed','failed')),
  current_tier        int NOT NULL DEFAULT 1,
  cascade_count       int NOT NULL DEFAULT 0,
  max_cascades        int NOT NULL DEFAULT 5,
  offered_to_user_id  uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  offered_at          timestamptz NULL,
  accepted_at         timestamptz NULL,
  locked_until        timestamptz NULL,
  first_call_at       timestamptz NULL,
  released_at         timestamptz NULL,
  pipeline_value      numeric(14,2) NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pis_lead_queue_company ON pis_lead_queue (company_id, status);
CREATE INDEX IF NOT EXISTS idx_pis_lead_queue_offered ON pis_lead_queue (offered_to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pis_lead_queue_lead ON pis_lead_queue (lead_id);

CREATE TABLE IF NOT EXISTS pis_lead_queue_history (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id          uuid NOT NULL REFERENCES pis_lead_queue(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL,
  lead_id           uuid NOT NULL,
  advisor_user_id   uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  action            text NOT NULL CHECK (action IN ('offered','accepted','timeout','penalty','released','manual_escalation','completed','failed')),
  tier_at_action    int NULL,
  penalty_points    numeric(5,2) NULL DEFAULT 0,
  detail            jsonb NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pis_lead_history_queue ON pis_lead_queue_history (queue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pis_lead_history_advisor ON pis_lead_queue_history (advisor_user_id, created_at DESC);