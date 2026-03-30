-- 173_multi_provider_ai_config.sql
-- Allow multiple AI providers per company (openai + anthropic).
-- Changes PK from (company_id) to UNIQUE(company_id, provider).

BEGIN;

-- Drop the existing PK (company_id only)
ALTER TABLE company_ai_provider_config
  DROP CONSTRAINT IF EXISTS company_ai_provider_config_pkey;

-- Add composite unique constraint
ALTER TABLE company_ai_provider_config
  ADD CONSTRAINT company_ai_provider_config_pkey PRIMARY KEY (company_id, provider);

COMMIT;
