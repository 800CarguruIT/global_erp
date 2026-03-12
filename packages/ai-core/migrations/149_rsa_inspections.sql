CREATE TABLE IF NOT EXISTS rsa_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  vin TEXT NULL,
  car_make TEXT NULL,
  car_model TEXT NULL,
  car_year TEXT NULL,
  car_plate TEXT NULL,
  tyre_size TEXT NULL,
  mileage INTEGER NULL,
  photo_front_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  photo_left_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  photo_right_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  photo_rear_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  cluster_image_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  video_360_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL,
  health_battery TEXT NULL,
  health_battery_voltage TEXT NULL,
  health_starter TEXT NULL,
  health_obd TEXT NULL,
  health_obd_codes TEXT NULL,
  health_notes TEXT NULL,
  ai_validation JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rsa_inspections_company_lead UNIQUE (company_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_rsa_inspections_company ON rsa_inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_rsa_inspections_lead ON rsa_inspections(lead_id);

