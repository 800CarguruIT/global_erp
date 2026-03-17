CREATE TABLE IF NOT EXISTS docs_pages (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'root',
  excerpt TEXT,
  content TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'seed',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_pages_section ON docs_pages(section);
CREATE INDEX IF NOT EXISTS idx_docs_pages_updated_at ON docs_pages(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_pages_active ON docs_pages(is_deleted);

CREATE TABLE IF NOT EXISTS docs_action_logs (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'delete')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  details TEXT,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_action_logs_created_at ON docs_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_action_logs_slug ON docs_action_logs(slug);
