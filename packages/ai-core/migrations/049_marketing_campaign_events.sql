-- Channel-specific campaign event tracking (email, whatsapp, sms, push)

CREATE TABLE IF NOT EXISTS marketing_email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_id TEXT NULL,
  recipient TEXT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT NULL,
  metadata JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_email_events_campaign_idx
  ON marketing_email_events (campaign_id);
CREATE INDEX IF NOT EXISTS marketing_email_events_type_idx
  ON marketing_email_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_email_events_company_time_idx
  ON marketing_email_events (company_id, occurred_at);

CREATE TABLE IF NOT EXISTS marketing_whatsapp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_id TEXT NULL,
  recipient TEXT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT NULL,
  metadata JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_whatsapp_events_campaign_idx
  ON marketing_whatsapp_events (campaign_id);
CREATE INDEX IF NOT EXISTS marketing_whatsapp_events_type_idx
  ON marketing_whatsapp_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_whatsapp_events_company_time_idx
  ON marketing_whatsapp_events (company_id, occurred_at);

CREATE TABLE IF NOT EXISTS marketing_sms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_id TEXT NULL,
  recipient TEXT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT NULL,
  metadata JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_sms_events_campaign_idx
  ON marketing_sms_events (campaign_id);
CREATE INDEX IF NOT EXISTS marketing_sms_events_type_idx
  ON marketing_sms_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_sms_events_company_time_idx
  ON marketing_sms_events (company_id, occurred_at);

CREATE TABLE IF NOT EXISTS marketing_push_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_id TEXT NULL,
  recipient TEXT NULL,
  event_type TEXT NOT NULL,
  provider_message_id TEXT NULL,
  metadata JSONB NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_push_events_campaign_idx
  ON marketing_push_events (campaign_id);
CREATE INDEX IF NOT EXISTS marketing_push_events_type_idx
  ON marketing_push_events (campaign_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_push_events_company_time_idx
  ON marketing_push_events (company_id, occurred_at);
