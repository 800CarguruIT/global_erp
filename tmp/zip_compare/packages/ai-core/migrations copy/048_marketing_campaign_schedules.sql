-- Campaign schedule tracking for cron jobs (EasyCron)
CREATE TABLE IF NOT EXISTS marketing_campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_key TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | scheduled | running | completed | failed | cancelled
  easycron_job_id TEXT NULL,
  easycron_payload JSONB NULL,
  last_run_at TIMESTAMPTZ NULL,
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_campaign_schedules_campaign_idx
  ON marketing_campaign_schedules (campaign_id);

CREATE INDEX IF NOT EXISTS marketing_campaign_schedules_status_idx
  ON marketing_campaign_schedules (status);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_campaign_schedules_unique_idx
  ON marketing_campaign_schedules (campaign_id, node_id, run_at);
