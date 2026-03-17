CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS docs_versions (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES docs_pages(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('major', 'minor', 'patch')),
  title TEXT NOT NULL,
  section TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  changelog TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_versions_page_version_no
  ON docs_versions(page_id, version_no);
CREATE INDEX IF NOT EXISTS idx_docs_versions_page_created_at
  ON docs_versions(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_versions_published
  ON docs_versions(is_published, created_at DESC);

ALTER TABLE docs_pages
  ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES docs_versions(id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Backfill initial published version for existing pages.
INSERT INTO docs_versions (
  id,
  page_id,
  version_no,
  version_label,
  change_type,
  title,
  section,
  excerpt,
  content,
  changelog,
  created_by,
  is_published,
  published_at
)
SELECT
  gen_random_uuid(),
  p.id,
  1,
  '1.0.0',
  'major',
  p.title,
  p.section,
  p.excerpt,
  p.content,
  'Initial version migration',
  'system',
  TRUE,
  now()
FROM docs_pages p
WHERE NOT EXISTS (
  SELECT 1 FROM docs_versions v WHERE v.page_id = p.id
);

UPDATE docs_pages p
SET current_version_id = v.id
FROM docs_versions v
WHERE p.id = v.page_id
  AND v.is_published = TRUE
  AND (p.current_version_id IS NULL);

-- Extend action types for version lifecycle operations.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'docs_action_logs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%action%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE docs_action_logs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE docs_action_logs
  ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES docs_versions(id),
  ADD COLUMN IF NOT EXISTS actor_id TEXT;

ALTER TABLE docs_action_logs
  ADD CONSTRAINT docs_action_logs_action_check
  CHECK (action IN ('create', 'edit', 'delete', 'draft', 'publish', 'revert'));
