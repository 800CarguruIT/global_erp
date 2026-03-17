-- AI feature toggles to allow/deny AI capabilities by scope
CREATE TABLE IF NOT EXISTS ai_feature_toggles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'global', -- global | company | branch | vendor
  scope_id UUID NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_feature_toggles_feature_scope_uq
  ON ai_feature_toggles (feature_key, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS ai_feature_toggles_feature_idx ON ai_feature_toggles (feature_key);
