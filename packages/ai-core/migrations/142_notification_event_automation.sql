-- 142_notification_event_automation.sql
-- Event-driven outbound notifications (email/sms/whatsapp)

CREATE TABLE IF NOT EXISTS notification_event_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  event_key text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'whatsapp')),
  integration_id uuid NULL REFERENCES integration_channels(id) ON DELETE SET NULL,
  recipient_path text NOT NULL,
  subject_template text NULL,
  body_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_event_rules_name_key UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_notification_event_rules_lookup
  ON notification_event_rules (company_id, event_key, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_notification_event_rules_integration
  ON notification_event_rules (integration_id);

CREATE TABLE IF NOT EXISTS notification_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry', 'processed', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NULL,
  processed_at timestamptz NULL,
  dedupe_key text NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_event_outbox_dedupe
  ON notification_event_outbox (company_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_event_outbox_pick
  ON notification_event_outbox (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_notification_event_outbox_company_event
  ON notification_event_outbox (company_id, event_key, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_event_id uuid NOT NULL REFERENCES notification_event_outbox(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES notification_event_rules(id),
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'sms', 'whatsapp')),
  integration_id uuid NULL REFERENCES integration_channels(id) ON DELETE SET NULL,
  recipient text NULL,
  subject text NULL,
  body text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'success', 'failed', 'skipped')),
  attempt_count integer NOT NULL DEFAULT 0,
  provider_message_id text NULL,
  error text NULL,
  response jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_event_delivery_rule UNIQUE (outbox_event_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_event_deliveries_outbox
  ON notification_event_deliveries (outbox_event_id, status);
