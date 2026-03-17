-- 114_inventory_transfer_approval.sql
BEGIN;

ALTER TABLE inventory_transfer_orders
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid NULL;

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname
    INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'inventory_transfer_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%IN%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inventory_transfer_orders DROP CONSTRAINT %I', v_conname);
  END IF;
END$$;

ALTER TABLE inventory_transfer_orders
  ADD CONSTRAINT inventory_transfer_orders_status_check
  CHECK (status IN ('draft', 'approved', 'in_transit', 'completed', 'cancelled'));

COMMIT;
