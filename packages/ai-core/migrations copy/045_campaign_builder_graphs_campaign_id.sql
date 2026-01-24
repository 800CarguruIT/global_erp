ALTER TABLE campaign_builder_graphs
  ADD COLUMN IF NOT EXISTS campaign_id UUID NULL;

DROP INDEX IF EXISTS campaign_builder_graphs_scope_company_idx;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_builder_graphs_scope_company_campaign_idx
  ON campaign_builder_graphs (
    scope,
    COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
