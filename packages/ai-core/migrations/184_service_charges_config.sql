-- 184_service_charges_config.sql
-- Add default service charges config for invoice conversion

INSERT INTO pis_config (company_id, config_key, config_value, updated_at)
SELECT c.id, 'service_charges', '{"inspection_fee": 150, "recovery_pickup_fee": 200, "recovery_dropoff_fee": 200, "currency": "AED"}'::jsonb, now()
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM pis_config pc WHERE pc.company_id = c.id AND pc.config_key = 'service_charges'
);
