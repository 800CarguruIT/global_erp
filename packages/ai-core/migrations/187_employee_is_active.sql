ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees (is_active);
