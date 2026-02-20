-- 104_inventory_location_sequences.sql
BEGIN;

CREATE TABLE IF NOT EXISTS inventory_location_sequences (
  company_id uuid NOT NULL,
  prefix text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, prefix)
);

COMMIT;
