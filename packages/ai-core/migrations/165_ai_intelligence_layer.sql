-- AI Intelligence Layer: per-company engine configuration and signal audit log

CREATE TABLE IF NOT EXISTS ai_intelligence_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engine_key            text NOT NULL,
  enabled               boolean NOT NULL DEFAULT true,
  refresh_interval_min  int NOT NULL DEFAULT 5,
  thresholds            jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_override       text NULL,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, engine_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_intelligence_config_company
  ON ai_intelligence_config (company_id);

CREATE TABLE IF NOT EXISTS ai_signal_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL,
  branch_id         uuid NULL,
  engine_key        text NOT NULL,
  triggered_at      timestamptz NOT NULL DEFAULT now(),
  payload_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals_count     int NOT NULL DEFAULT 0,
  high_urgency      int NOT NULL DEFAULT 0,
  med_urgency       int NOT NULL DEFAULT 0,
  low_urgency       int NOT NULL DEFAULT 0,
  model_used        text NOT NULL DEFAULT 'claude-sonnet-4-6',
  prompt_tokens     int NULL,
  completion_tokens int NULL,
  latency_ms        int NULL,
  error             text NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_signal_log_company_engine
  ON ai_signal_log (company_id, engine_key, triggered_at DESC);
