CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'global',
  company_id uuid NULL,
  uploaded_by uuid NULL,
  kind text NOT NULL,
  mime_type text NOT NULL,
  original_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint NOT NULL,
  width int NULL,
  height int NULL,
  duration_seconds numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_company ON files(company_id);
CREATE INDEX IF NOT EXISTS idx_files_kind ON files(kind);
