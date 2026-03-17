-- VIN catalog simulation seed data
-- Purpose: populate vin_catalog_cars, vin_catalog_parts, and vin_catalog_part_groups
-- Usage:
--   psql "$DATABASE_URL" -f scripts/simulation/vin-catalog-dummy-seed.sql

BEGIN;

-- Keep this script rerunnable: remove only the simulation VINs below.
DELETE FROM vin_catalog_cars
WHERE vin IN (
  'SIMVIN2026CAMRY01',
  'SIMVIN2026PRADO01',
  'SIMVIN2026TESLA01'
);

WITH upserted_cars AS (
  INSERT INTO vin_catalog_cars (
    vin,
    source_car_id,
    title,
    name,
    make,
    model,
    year,
    description,
    engine,
    drive,
    dest,
    grade,
    trans,
    raw_json,
    updated_at
  )
  VALUES
    (
      'SIMVIN2026CAMRY01',
      'SIM-CAR-TOY-001',
      'TOYOTA CAMRY 2.5L GCC',
      'Camry',
      'Toyota',
      'Camry',
      2023,
      'ENGINE:2.5L; DRIVE:FWD; DEST:GCC; GRADE:LE; TRANS:AT',
      '2.5L',
      'FWD',
      'GCC',
      'LE',
      'AT',
      '{"car":{"id":"SIM-CAR-TOY-001","make":"Toyota","model":"Camry","year":"2023"},"partsBrand":"Aisin"}'::jsonb,
      now()
    ),
    (
      'SIMVIN2026CAMRY01',
      'SIM-CAR-TOY-002',
      'TOYOTA CAMRY 3.5L SPORT',
      'Camry',
      'Toyota',
      'Camry',
      2023,
      'ENGINE:3.5L; DRIVE:FWD; DEST:GCC; GRADE:SE; TRANS:AT',
      '3.5L',
      'FWD',
      'GCC',
      'SE',
      'AT',
      '{"car":{"id":"SIM-CAR-TOY-002","make":"Toyota","model":"Camry","year":"2023"},"partsBrand":"Denso"}'::jsonb,
      now()
    ),
    (
      'SIMVIN2026PRADO01',
      'SIM-CAR-TOY-003',
      'TOYOTA PRADO 2.8D TXL',
      'Prado',
      'Toyota',
      'Prado',
      2022,
      'ENGINE:2.8D; DRIVE:4WD; DEST:GCC; GRADE:TXL; TRANS:AT',
      '2.8D',
      '4WD',
      'GCC',
      'TXL',
      'AT',
      '{"car":{"id":"SIM-CAR-TOY-003","make":"Toyota","model":"Prado","year":"2022"},"partsBrand":"Toyota Genuine"}'::jsonb,
      now()
    ),
    (
      'SIMVIN2026TESLA01',
      'SIM-CAR-TSL-001',
      'TESLA MODEL 3 LONG RANGE',
      'Model 3',
      'Tesla',
      'Model 3',
      2024,
      'ENGINE:EV; DRIVE:AWD; DEST:GCC; GRADE:LONG_RANGE; TRANS:1-SPEED',
      'EV',
      'AWD',
      'GCC',
      'LONG_RANGE',
      '1-SPEED',
      '{"car":{"id":"SIM-CAR-TSL-001","make":"Tesla","model":"Model 3","year":"2024"},"partsBrand":"Tesla"}'::jsonb,
      now()
    )
  ON CONFLICT (vin, source_car_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    name = EXCLUDED.name,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    year = EXCLUDED.year,
    description = EXCLUDED.description,
    engine = EXCLUDED.engine,
    drive = EXCLUDED.drive,
    dest = EXCLUDED.dest,
    grade = EXCLUDED.grade,
    trans = EXCLUDED.trans,
    raw_json = EXCLUDED.raw_json,
    updated_at = now()
  RETURNING id, vin, source_car_id
), deleted_parts AS (
  DELETE FROM vin_catalog_parts
  WHERE car_ref_id IN (SELECT id FROM upserted_cars)
), upserted_parts AS (
  INSERT INTO vin_catalog_parts (
    car_ref_id,
    car_vin,
    part_number,
    part_name,
    source_index,
    raw_json,
    updated_at
  )
  SELECT
    c.id,
    d.vin,
    d.part_number,
    d.part_name,
    d.source_index,
    d.raw_json,
    now()
  FROM (
    VALUES
      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','04465-0D140','Front Brake Pad Set',0,'{"code":"04465-0D140","name":"Front Brake Pad Set"}'::jsonb),
      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','90915-YZZE1','Oil Filter Element',1,'{"code":"90915-YZZE1","name":"Oil Filter Element"}'::jsonb),
      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','17801-0D060','Air Filter',2,'{"code":"17801-0D060","name":"Air Filter"}'::jsonb),

      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','04465-06140','Front Brake Pad Performance',0,'{"code":"04465-06140","name":"Front Brake Pad Performance"}'::jsonb),
      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','17801-F0010','High Flow Air Filter',1,'{"code":"17801-F0010","name":"High Flow Air Filter"}'::jsonb),
      ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','90916-03146','Spark Plug Iridium',2,'{"code":"90916-03146","name":"Spark Plug Iridium"}'::jsonb),

      ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','23390-0L070','Fuel Filter',0,'{"code":"23390-0L070","name":"Fuel Filter"}'::jsonb),
      ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','48510-6A460','Front Shock Absorber',1,'{"code":"48510-6A460","name":"Front Shock Absorber"}'::jsonb),
      ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','90915-YZZD3','Oil Filter Diesel',2,'{"code":"90915-YZZD3","name":"Oil Filter Diesel"}'::jsonb),

      ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1108801-00-B','Cabin Air Filter HEPA',0,'{"code":"1108801-00-B","name":"Cabin Air Filter HEPA"}'::jsonb),
      ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1188363-00-A','Front Lower Control Arm',1,'{"code":"1188363-00-A","name":"Front Lower Control Arm"}'::jsonb),
      ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1492617-00-A','Charge Port Assembly',2,'{"code":"1492617-00-A","name":"Charge Port Assembly"}'::jsonb)
  ) AS d(vin, source_car_id, part_number, part_name, source_index, raw_json)
  INNER JOIN upserted_cars c
    ON c.vin = d.vin
   AND c.source_car_id = d.source_car_id
  ON CONFLICT (car_ref_id, part_number, source_index)
  DO UPDATE SET
    part_name = EXCLUDED.part_name,
    raw_json = EXCLUDED.raw_json,
    updated_at = now()
  RETURNING id, car_vin, car_ref_id, part_number, source_index
)
INSERT INTO vin_catalog_part_groups (
  part_ref_id,
  group_source_id,
  group_level,
  group_name,
  raw_json,
  updated_at
)
SELECT
  p.id,
  g.group_source_id,
  g.group_level,
  g.group_name,
  g.raw_json,
  now()
FROM (
  VALUES
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','04465-0D140',0,'GRP-BRK',1,'Brake System','{"id":"GRP-BRK","level":1,"name":"Brake System"}'::jsonb),
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','04465-0D140',0,'GRP-FT',2,'Front Axle','{"id":"GRP-FT","level":2,"name":"Front Axle"}'::jsonb),
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','90915-YZZE1',1,'GRP-ENG',1,'Engine Service','{"id":"GRP-ENG","level":1,"name":"Engine Service"}'::jsonb),
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-001','17801-0D060',2,'GRP-INT',1,'Intake System','{"id":"GRP-INT","level":1,"name":"Intake System"}'::jsonb),

    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','04465-06140',0,'GRP-BRK',1,'Brake System','{"id":"GRP-BRK","level":1,"name":"Brake System"}'::jsonb),
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','17801-F0010',1,'GRP-INT',1,'Intake System','{"id":"GRP-INT","level":1,"name":"Intake System"}'::jsonb),
    ('SIMVIN2026CAMRY01','SIM-CAR-TOY-002','90916-03146',2,'GRP-IGN',1,'Ignition System','{"id":"GRP-IGN","level":1,"name":"Ignition System"}'::jsonb),

    ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','23390-0L070',0,'GRP-FUEL',1,'Fuel System','{"id":"GRP-FUEL","level":1,"name":"Fuel System"}'::jsonb),
    ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','48510-6A460',1,'GRP-SUS',1,'Suspension','{"id":"GRP-SUS","level":1,"name":"Suspension"}'::jsonb),
    ('SIMVIN2026PRADO01','SIM-CAR-TOY-003','90915-YZZD3',2,'GRP-ENG',1,'Engine Service','{"id":"GRP-ENG","level":1,"name":"Engine Service"}'::jsonb),

    ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1108801-00-B',0,'GRP-HVAC',1,'Cabin HVAC','{"id":"GRP-HVAC","level":1,"name":"Cabin HVAC"}'::jsonb),
    ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1188363-00-A',1,'GRP-SUS',1,'Suspension','{"id":"GRP-SUS","level":1,"name":"Suspension"}'::jsonb),
    ('SIMVIN2026TESLA01','SIM-CAR-TSL-001','1492617-00-A',2,'GRP-ELEC',1,'Electrical Charging','{"id":"GRP-ELEC","level":1,"name":"Electrical Charging"}'::jsonb)
) AS g(vin, source_car_id, part_number, source_index, group_source_id, group_level, group_name, raw_json)
INNER JOIN upserted_parts p
  ON p.car_vin = g.vin
 AND p.part_number = g.part_number
 AND p.source_index = g.source_index
ON CONFLICT (part_ref_id, group_source_id, group_level, group_name)
DO UPDATE SET
  raw_json = EXCLUDED.raw_json,
  updated_at = now();

COMMIT;
