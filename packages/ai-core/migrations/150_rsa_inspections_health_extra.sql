ALTER TABLE rsa_inspections
ADD COLUMN IF NOT EXISTS health_extra JSONB NULL;

