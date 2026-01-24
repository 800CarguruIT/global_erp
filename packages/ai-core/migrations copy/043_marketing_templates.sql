-- Marketing templates for company-level messaging (WhatsApp, Email, etc.)

CREATE TABLE IF NOT EXISTS marketing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider_key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_status text NULL,
  provider_template_id text NULL,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_templates_company_id_idx
  ON marketing_templates(company_id);

CREATE INDEX IF NOT EXISTS marketing_templates_company_type_idx
  ON marketing_templates(company_id, type);
