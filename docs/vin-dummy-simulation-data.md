# VIN Dummy Data for Simulation

This project now includes a simulation seed for VIN catalog cache tables:

- `vin_catalog_cars`
- `vin_catalog_parts`
- `vin_catalog_part_groups`

## Seed File

- `scripts/simulation/vin-catalog-dummy-seed.sql`

## Apply Seed

```bash
psql "$DATABASE_URL" -f scripts/simulation/vin-catalog-dummy-seed.sql
```

## Included Simulation VINs

- `SIMVIN2026CAMRY01` (2 cars for car-selection simulation)
- `SIMVIN2026PRADO01` (single car)
- `SIMVIN2026TESLA01` (single car)

## Quick Check Queries

```sql
SELECT vin, source_car_id, make, model, year
FROM vin_catalog_cars
WHERE vin IN ('SIMVIN2026CAMRY01','SIMVIN2026PRADO01','SIMVIN2026TESLA01')
ORDER BY vin, source_car_id;
```

```sql
SELECT car_vin, part_number, part_name, source_index
FROM vin_catalog_parts
WHERE car_vin IN ('SIMVIN2026CAMRY01','SIMVIN2026PRADO01','SIMVIN2026TESLA01')
ORDER BY car_vin, source_index;
```

```sql
SELECT p.car_vin, p.part_number, g.group_name, g.group_level
FROM vin_catalog_parts p
LEFT JOIN vin_catalog_part_groups g ON g.part_ref_id = p.id
WHERE p.car_vin IN ('SIMVIN2026CAMRY01','SIMVIN2026PRADO01','SIMVIN2026TESLA01')
ORDER BY p.car_vin, p.source_index, g.group_level;
```

## API Simulation Notes

- Tiny API endpoint (no DB required):
  - `GET /api/public/vin-dummy`
  - `GET /api/public/vin-dummy?vin=SIMVIN2026CAMRY01`
  - `GET /api/public/vin-dummy?vin=SIMVIN2026CAMRY01&carId=SIM-CAR-TOY-001`

- For multi-car selection flow, call VIN lookup with `SIMVIN2026CAMRY01`.
- Then pass returned `carId` to fetch selected snapshot.
- VIN parts endpoint can be tested for estimate-linked VIN resolution once an estimate contains one of the above VIN values.
