-- 013_inspections.sql

-- Main inspection header
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  lead_id uuid NULL,
  car_id uuid NULL,
  customer_id uuid NULL,
  inspector_employee_id uuid NULL,
  advisor_employee_id uuid NULL,

  status text NOT NULL DEFAULT 'draft', -- draft | in_progress | completed | approved | cancelled

  -- health values 0-100 (nullable means not set)
  health_engine integer NULL,
  health_transmission integer NULL,
  health_brakes integer NULL,
  health_suspension integer NULL,
  health_electrical integer NULL,
  overall_health integer NULL,

  customer_remark text NULL,
  agent_remark text NULL,
  inspector_remark text NULL,

  -- raw + layman AI text (we'll fill later)
  inspector_remark_layman text NULL,
  ai_summary_markdown text NULL,
  ai_summary_plain text NULL,

  -- autosave JSON blob for in-progress editing (line items etc.)
  draft_payload jsonb NULL,

  -- media summary (just counts + notes; actual files live in inspection_media)
  media_summary jsonb NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspections_company_status
  ON inspections (company_id, status);

CREATE INDEX IF NOT EXISTS idx_inspections_lead
  ON inspections (lead_id);

-- Individual inspection items (per finding)
CREATE TABLE IF NOT EXISTS inspection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  line_no integer NOT NULL,

  category text NULL,      -- e.g. "brakes", "suspension"
  part_name text NOT NULL, -- e.g. "front brake pads"
  severity text NULL,      -- e.g. minor | moderate | critical
  required_action text NULL, -- e.g. replace / adjust / monitor

  tech_reason text NULL,     -- why inspector added it (technical)
  layman_reason text NULL,   -- AI translated explanation

  photo_refs jsonb NULL,     -- array of file ids/urls

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection
  ON inspection_items (inspection_id, line_no);

-- Media: photos / video / audio captured at check-in / inspection
CREATE TABLE IF NOT EXISTS inspection_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  media_type text NOT NULL,  -- photo | video | audio
  angle text NULL,           -- front | rear | left | right | 360 | damage
  label text NULL,           -- free-text
  file_ref text NOT NULL,    -- file id / url (we'll map to storage later)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspection_media_inspection
  ON inspection_media (inspection_id);

-- Versioned PDF drafts of inspection reports
CREATE TABLE IF NOT EXISTS inspection_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  pdf_file_ref text NOT NULL,        -- file id / url of PDF
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inspection_versions_unique
  ON inspection_versions (inspection_id, version_no);

-- trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_inspections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_inspections_updated_at ON inspections;
CREATE TRIGGER trg_touch_inspections_updated_at
BEFORE UPDATE ON inspections
FOR EACH ROW EXECUTE FUNCTION touch_inspections_updated_at();
