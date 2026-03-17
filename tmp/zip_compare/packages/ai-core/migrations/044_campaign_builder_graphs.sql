-- Campaign builder graphs (Drawflow)
CREATE TABLE IF NOT EXISTS campaign_builder_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  company_id UUID NULL,
  graph JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS campaign_builder_graphs_scope_company_idx
  ON campaign_builder_graphs (scope, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid));
