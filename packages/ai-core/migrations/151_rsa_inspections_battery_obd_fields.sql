ALTER TABLE rsa_inspections
ADD COLUMN IF NOT EXISTS health_battery_size TEXT NULL;

ALTER TABLE rsa_inspections
ADD COLUMN IF NOT EXISTS health_battery_photo_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL;

ALTER TABLE rsa_inspections
ADD COLUMN IF NOT EXISTS health_obd_report_photo_file_id UUID NULL REFERENCES files(id) ON DELETE SET NULL;

