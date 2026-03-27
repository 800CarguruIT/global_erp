-- 171_car_specific_part_definitions.sql
-- Track which make/model combos have been AI-seeded so we don't re-call AI

CREATE TABLE IF NOT EXISTS inspection_part_ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  car_make TEXT NOT NULL,
  car_model TEXT NULL,
  car_body_type TEXT NULL,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parts_added INTEGER NOT NULL DEFAULT 0,
  UNIQUE(company_id, car_make, car_model)
);
CREATE INDEX IF NOT EXISTS idx_ipac_make_model ON inspection_part_ai_cache (car_make, car_model);
