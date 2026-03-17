-- 152_vin_catalog_lookup_tables.sql
-- Stores temporary VIN lookup snapshots from external parts catalog.

CREATE TABLE IF NOT EXISTS vin_catalog_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vin text NOT NULL,
  source_car_id text NOT NULL,
  title text,
  name text,
  make text,
  model text,
  year integer,
  description text,
  engine text,
  drive text,
  dest text,
  grade text,
  trans text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vin, source_car_id)
);

CREATE INDEX IF NOT EXISTS idx_vin_catalog_cars_vin
  ON vin_catalog_cars (vin);

CREATE TABLE IF NOT EXISTS vin_catalog_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_ref_id uuid NOT NULL REFERENCES vin_catalog_cars(id) ON DELETE CASCADE,
  car_vin text NOT NULL,
  part_number text NOT NULL,
  part_name text,
  source_index integer NOT NULL DEFAULT 0,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (car_ref_id, part_number, source_index)
);

CREATE INDEX IF NOT EXISTS idx_vin_catalog_parts_car_vin
  ON vin_catalog_parts (car_vin);

CREATE INDEX IF NOT EXISTS idx_vin_catalog_parts_part_number
  ON vin_catalog_parts (part_number);

CREATE TABLE IF NOT EXISTS vin_catalog_part_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_ref_id uuid NOT NULL REFERENCES vin_catalog_parts(id) ON DELETE CASCADE,
  group_source_id text,
  group_level integer,
  group_name text,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (part_ref_id, group_source_id, group_level, group_name)
);

CREATE INDEX IF NOT EXISTS idx_vin_catalog_part_groups_name
  ON vin_catalog_part_groups (group_name);
