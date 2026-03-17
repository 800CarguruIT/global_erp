-- 032_ai_config.sql
-- Add AI global configuration and modules registry

CREATE TABLE IF NOT EXISTS ai_global_config (
  id serial PRIMARY KEY,
  master_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_modules (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text NULL,
  global_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed a single global config row if none exists
INSERT INTO ai_global_config (master_enabled)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM ai_global_config);

-- Seed common AI modules if they are missing
INSERT INTO ai_modules (key, label, category, description, global_enabled)
VALUES
  ('translator', 'AI Translator', 'communication', 'Translate content across languages for SMS, email, and chat.', true),
  ('dialer', 'Dialer AI', 'call-center', 'Call assistant, transcripts, and summaries for inbound/outbound calls.', true),
  ('documents', 'Document AI', 'productivity', 'Summaries, drafting, and compliance checks for documents.', true)
ON CONFLICT (key) DO NOTHING;
