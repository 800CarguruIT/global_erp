-- 168_inspection_part_categories.sql
-- Three-level part hierarchy for guided inspection part selection

-- Level 1: Main categories (e.g., Engine, Brakes)
CREATE TABLE IF NOT EXISTS inspection_part_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NULL,
  name TEXT NOT NULL,
  icon TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ipc_company ON inspection_part_categories (company_id);

-- Level 2: Sub-categories (e.g., Brake Pads, Brake Discs)
CREATE TABLE IF NOT EXISTS inspection_part_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES inspection_part_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ipsc_category ON inspection_part_subcategories (category_id);

-- Level 3: Part definitions (e.g., Front Brake Pad Set)
CREATE TABLE IF NOT EXISTS inspection_part_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES inspection_part_subcategories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  applicable_makes TEXT[] NULL,
  applicable_body_types TEXT[] NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ipd_subcategory ON inspection_part_definitions (subcategory_id);

-- ============================================================
-- SEED DATA: Universal automotive part categories
-- ============================================================

-- Helper: insert categories and capture IDs via CTEs
DO $$
DECLARE
  -- Category IDs
  cat_engine UUID;
  cat_transmission UUID;
  cat_brakes UUID;
  cat_suspension UUID;
  cat_steering UUID;
  cat_electrical UUID;
  cat_ac UUID;
  cat_body UUID;
  cat_interior UUID;
  cat_exhaust UUID;
  cat_fuel UUID;
  cat_tyres UUID;
  -- Sub-category IDs (reused per block)
  sub UUID;
BEGIN

-- ===================== 1. ENGINE =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Engine', 'engine', 1) RETURNING id INTO cat_engine;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Engine Block & Internals', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Engine Assembly', 1), (sub, 'Cylinder Head', 2), (sub, 'Cylinder Head Gasket', 3),
  (sub, 'Piston Set', 4), (sub, 'Piston Rings', 5), (sub, 'Connecting Rod', 6),
  (sub, 'Crankshaft', 7), (sub, 'Camshaft', 8), (sub, 'Engine Block', 9),
  (sub, 'Valve Cover Gasket', 10), (sub, 'Oil Pan', 11), (sub, 'Oil Pan Gasket', 12);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Timing System', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Timing Belt', 1), (sub, 'Timing Chain', 2), (sub, 'Timing Chain Tensioner', 3),
  (sub, 'Timing Belt Kit', 4), (sub, 'Timing Cover', 5), (sub, 'Timing Chain Guide', 6);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Belts & Pulleys', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Serpentine Belt', 1), (sub, 'Drive Belt', 2), (sub, 'Belt Tensioner', 3),
  (sub, 'Idler Pulley', 4), (sub, 'Crankshaft Pulley', 5), (sub, 'Alternator Belt', 6);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Gaskets & Seals', 4) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Head Gasket Set', 1), (sub, 'Intake Manifold Gasket', 2), (sub, 'Exhaust Manifold Gasket', 3),
  (sub, 'Valve Stem Seal Set', 4), (sub, 'Rear Main Seal', 5), (sub, 'Front Crankshaft Seal', 6),
  (sub, 'Oil Cooler Gasket', 7);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Cooling System', 5) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Radiator', 1), (sub, 'Water Pump', 2), (sub, 'Thermostat', 3),
  (sub, 'Radiator Hose (Upper)', 4), (sub, 'Radiator Hose (Lower)', 5), (sub, 'Coolant Reservoir', 6),
  (sub, 'Radiator Fan', 7), (sub, 'Radiator Fan Motor', 8), (sub, 'Coolant Temperature Sensor', 9);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Lubrication', 6) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Oil Filter', 1), (sub, 'Oil Pump', 2), (sub, 'Oil Pressure Sensor', 3),
  (sub, 'Oil Cooler', 4), (sub, 'Oil Dipstick', 5);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Turbo & Supercharger', 7) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Turbocharger', 1), (sub, 'Turbo Wastegate', 2), (sub, 'Intercooler', 3),
  (sub, 'Turbo Intake Hose', 4), (sub, 'Boost Pressure Sensor', 5), (sub, 'Supercharger', 6);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_engine, 'Engine Mounts', 8) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Engine Mount', 1), (sub, 'Rear Engine Mount', 2), (sub, 'Left Engine Mount', 3),
  (sub, 'Right Engine Mount', 4), (sub, 'Transmission Mount', 5);

-- ===================== 2. TRANSMISSION =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Transmission', 'transmission', 2) RETURNING id INTO cat_transmission;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_transmission, 'Gearbox', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Transmission Assembly (Auto)', 1), (sub, 'Transmission Assembly (Manual)', 2),
  (sub, 'Torque Converter', 3), (sub, 'Clutch Kit', 4), (sub, 'Clutch Disc', 5),
  (sub, 'Pressure Plate', 6), (sub, 'Flywheel', 7), (sub, 'Dual Mass Flywheel', 8),
  (sub, 'Release Bearing', 9), (sub, 'Clutch Master Cylinder', 10), (sub, 'Clutch Slave Cylinder', 11);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_transmission, 'Drivetrain', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'CV Axle (Left)', 1), (sub, 'CV Axle (Right)', 2), (sub, 'CV Joint Boot', 3),
  (sub, 'Driveshaft', 4), (sub, 'U-Joint', 5), (sub, 'Differential', 6),
  (sub, 'Transfer Case', 7), (sub, 'Axle Bearing', 8), (sub, 'Propeller Shaft', 9);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_transmission, 'Transmission Control', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Shift Cable', 1), (sub, 'Shift Linkage', 2), (sub, 'Transmission Control Module', 3),
  (sub, 'Speed Sensor', 4), (sub, 'Transmission Filter', 5), (sub, 'Valve Body', 6);

-- ===================== 3. BRAKES =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Brakes', 'brakes', 3) RETURNING id INTO cat_brakes;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_brakes, 'Front Brakes', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Brake Pad Set', 1), (sub, 'Front Brake Disc (Left)', 2), (sub, 'Front Brake Disc (Right)', 3),
  (sub, 'Front Brake Caliper (Left)', 4), (sub, 'Front Brake Caliper (Right)', 5),
  (sub, 'Front Brake Hose', 6), (sub, 'Front Brake Wear Sensor', 7);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_brakes, 'Rear Brakes', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Rear Brake Pad Set', 1), (sub, 'Rear Brake Disc (Left)', 2), (sub, 'Rear Brake Disc (Right)', 3),
  (sub, 'Rear Brake Caliper (Left)', 4), (sub, 'Rear Brake Caliper (Right)', 5),
  (sub, 'Rear Brake Hose', 6), (sub, 'Rear Brake Shoe Set', 7), (sub, 'Rear Brake Drum', 8);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_brakes, 'Brake System', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Brake Master Cylinder', 1), (sub, 'Brake Booster', 2), (sub, 'ABS Module', 3),
  (sub, 'ABS Sensor (Front Left)', 4), (sub, 'ABS Sensor (Front Right)', 5),
  (sub, 'ABS Sensor (Rear Left)', 6), (sub, 'ABS Sensor (Rear Right)', 7),
  (sub, 'Brake Fluid Reservoir', 8), (sub, 'Parking Brake Cable', 9),
  (sub, 'Parking Brake Shoe Set', 10), (sub, 'Brake Light Switch', 11);

-- ===================== 4. SUSPENSION =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Suspension', 'suspension', 4) RETURNING id INTO cat_suspension;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_suspension, 'Front Suspension', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Shock Absorber (Left)', 1), (sub, 'Front Shock Absorber (Right)', 2),
  (sub, 'Front Coil Spring (Left)', 3), (sub, 'Front Coil Spring (Right)', 4),
  (sub, 'Front Strut Assembly (Left)', 5), (sub, 'Front Strut Assembly (Right)', 6),
  (sub, 'Front Strut Mount (Left)', 7), (sub, 'Front Strut Mount (Right)', 8),
  (sub, 'Front Lower Control Arm (Left)', 9), (sub, 'Front Lower Control Arm (Right)', 10),
  (sub, 'Front Upper Control Arm (Left)', 11), (sub, 'Front Upper Control Arm (Right)', 12),
  (sub, 'Front Sway Bar Link (Left)', 13), (sub, 'Front Sway Bar Link (Right)', 14),
  (sub, 'Front Sway Bar Bush', 15);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_suspension, 'Rear Suspension', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Rear Shock Absorber (Left)', 1), (sub, 'Rear Shock Absorber (Right)', 2),
  (sub, 'Rear Coil Spring (Left)', 3), (sub, 'Rear Coil Spring (Right)', 4),
  (sub, 'Rear Strut Assembly (Left)', 5), (sub, 'Rear Strut Assembly (Right)', 6),
  (sub, 'Rear Lower Control Arm (Left)', 7), (sub, 'Rear Lower Control Arm (Right)', 8),
  (sub, 'Rear Sway Bar Link (Left)', 9), (sub, 'Rear Sway Bar Link (Right)', 10),
  (sub, 'Rear Trailing Arm (Left)', 11), (sub, 'Rear Trailing Arm (Right)', 12);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_suspension, 'Bushings & Joints', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Lower Ball Joint (Left)', 1), (sub, 'Front Lower Ball Joint (Right)', 2),
  (sub, 'Front Upper Ball Joint (Left)', 3), (sub, 'Front Upper Ball Joint (Right)', 4),
  (sub, 'Control Arm Bush Kit (Front)', 5), (sub, 'Control Arm Bush Kit (Rear)', 6),
  (sub, 'Subframe Bush Set', 7);

-- ===================== 5. STEERING =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Steering', 'steering', 5) RETURNING id INTO cat_steering;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_steering, 'Steering Components', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Steering Rack', 1), (sub, 'Power Steering Pump', 2), (sub, 'Power Steering Hose', 3),
  (sub, 'Steering Column', 4), (sub, 'Tie Rod End (Inner Left)', 5), (sub, 'Tie Rod End (Inner Right)', 6),
  (sub, 'Tie Rod End (Outer Left)', 7), (sub, 'Tie Rod End (Outer Right)', 8),
  (sub, 'Steering Wheel', 9), (sub, 'Steering Knuckle (Left)', 10), (sub, 'Steering Knuckle (Right)', 11);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_steering, 'Wheel Bearings', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Wheel Bearing (Left)', 1), (sub, 'Front Wheel Bearing (Right)', 2),
  (sub, 'Rear Wheel Bearing (Left)', 3), (sub, 'Rear Wheel Bearing (Right)', 4),
  (sub, 'Wheel Hub Assembly (Front Left)', 5), (sub, 'Wheel Hub Assembly (Front Right)', 6);

-- ===================== 6. ELECTRICAL =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Electrical', 'electrical', 6) RETURNING id INTO cat_electrical;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_electrical, 'Starting & Charging', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Battery', 1), (sub, 'Alternator', 2), (sub, 'Starter Motor', 3),
  (sub, 'Voltage Regulator', 4), (sub, 'Battery Terminal', 5), (sub, 'Battery Cable', 6);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_electrical, 'Lighting', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Headlight Assembly (Left)', 1), (sub, 'Headlight Assembly (Right)', 2),
  (sub, 'Headlight Bulb (Left)', 3), (sub, 'Headlight Bulb (Right)', 4),
  (sub, 'Tail Light Assembly (Left)', 5), (sub, 'Tail Light Assembly (Right)', 6),
  (sub, 'Fog Light (Left)', 7), (sub, 'Fog Light (Right)', 8),
  (sub, 'Brake Light Bulb', 9), (sub, 'Turn Signal Bulb', 10);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_electrical, 'Sensors & Modules', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Oxygen Sensor (Bank 1)', 1), (sub, 'Oxygen Sensor (Bank 2)', 2),
  (sub, 'Mass Air Flow Sensor', 3), (sub, 'MAP Sensor', 4), (sub, 'Throttle Position Sensor', 5),
  (sub, 'Crankshaft Position Sensor', 6), (sub, 'Camshaft Position Sensor', 7),
  (sub, 'Knock Sensor', 8), (sub, 'ECU / Engine Control Module', 9),
  (sub, 'Ignition Coil', 10), (sub, 'Spark Plug Set', 11);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_electrical, 'Wiper & Washer', 4) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Wiper Blade (Front Left)', 1), (sub, 'Wiper Blade (Front Right)', 2),
  (sub, 'Rear Wiper Blade', 3), (sub, 'Wiper Motor (Front)', 4), (sub, 'Wiper Motor (Rear)', 5),
  (sub, 'Windshield Washer Pump', 6), (sub, 'Washer Fluid Reservoir', 7);

-- ===================== 7. A/C & COOLING =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'A/C & Cooling', 'ac', 7) RETURNING id INTO cat_ac;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_ac, 'A/C Components', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'A/C Compressor', 1), (sub, 'A/C Condenser', 2), (sub, 'A/C Evaporator', 3),
  (sub, 'A/C Expansion Valve', 4), (sub, 'A/C Receiver Drier', 5), (sub, 'A/C Compressor Clutch', 6),
  (sub, 'A/C High Pressure Hose', 7), (sub, 'A/C Low Pressure Hose', 8),
  (sub, 'Cabin Air Filter', 9), (sub, 'Blower Motor', 10), (sub, 'Blower Motor Resistor', 11),
  (sub, 'A/C Control Panel', 12);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_ac, 'Heater', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Heater Core', 1), (sub, 'Heater Hose', 2), (sub, 'Heater Control Valve', 3);

-- ===================== 8. BODY & EXTERIOR =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Body & Exterior', 'body', 8) RETURNING id INTO cat_body;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_body, 'Bumpers & Fenders', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Bumper', 1), (sub, 'Rear Bumper', 2), (sub, 'Front Fender (Left)', 3),
  (sub, 'Front Fender (Right)', 4), (sub, 'Rear Quarter Panel (Left)', 5),
  (sub, 'Rear Quarter Panel (Right)', 6), (sub, 'Hood', 7), (sub, 'Trunk Lid', 8);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_body, 'Doors', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Door (Left)', 1), (sub, 'Front Door (Right)', 2),
  (sub, 'Rear Door (Left)', 3), (sub, 'Rear Door (Right)', 4),
  (sub, 'Door Handle (Exterior)', 5), (sub, 'Door Lock Actuator', 6),
  (sub, 'Door Hinge', 7), (sub, 'Window Regulator (Front Left)', 8),
  (sub, 'Window Regulator (Front Right)', 9);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_body, 'Glass & Mirrors', 3) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Windshield', 1), (sub, 'Rear Window', 2),
  (sub, 'Side Mirror (Left)', 3), (sub, 'Side Mirror (Right)', 4),
  (sub, 'Side Window (Front Left)', 5), (sub, 'Side Window (Front Right)', 6),
  (sub, 'Side Window (Rear Left)', 7), (sub, 'Side Window (Rear Right)', 8);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_body, 'Grille & Trim', 4) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Front Grille', 1), (sub, 'Radiator Support', 2), (sub, 'Splash Guard (Left)', 3),
  (sub, 'Splash Guard (Right)', 4), (sub, 'Rocker Panel (Left)', 5), (sub, 'Rocker Panel (Right)', 6);

-- ===================== 9. INTERIOR =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Interior', 'interior', 9) RETURNING id INTO cat_interior;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_interior, 'Seats & Trim', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Driver Seat', 1), (sub, 'Passenger Seat', 2), (sub, 'Rear Seat', 3),
  (sub, 'Seat Belt (Driver)', 4), (sub, 'Seat Belt (Passenger)', 5),
  (sub, 'Seat Belt (Rear)', 6), (sub, 'Dashboard', 7), (sub, 'Center Console', 8);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_interior, 'Instruments & Controls', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Instrument Cluster', 1), (sub, 'Infotainment Screen', 2), (sub, 'Clock Spring', 3),
  (sub, 'Horn', 4), (sub, 'Airbag (Driver)', 5), (sub, 'Airbag (Passenger)', 6),
  (sub, 'Airbag (Side)', 7);

-- ===================== 10. EXHAUST =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Exhaust', 'exhaust', 10) RETURNING id INTO cat_exhaust;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_exhaust, 'Exhaust System', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Exhaust Manifold', 1), (sub, 'Catalytic Converter', 2), (sub, 'DPF (Diesel Particulate Filter)', 3),
  (sub, 'Muffler / Silencer', 4), (sub, 'Exhaust Pipe (Front)', 5), (sub, 'Exhaust Pipe (Rear)', 6),
  (sub, 'Exhaust Gasket', 7), (sub, 'Exhaust Hanger', 8), (sub, 'EGR Valve', 9),
  (sub, 'Lambda Sensor (Pre-Cat)', 10), (sub, 'Lambda Sensor (Post-Cat)', 11);

-- ===================== 11. FUEL SYSTEM =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Fuel System', 'fuel', 11) RETURNING id INTO cat_fuel;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_fuel, 'Fuel Delivery', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Fuel Pump', 1), (sub, 'Fuel Filter', 2), (sub, 'Fuel Injector Set', 3),
  (sub, 'Fuel Pressure Regulator', 4), (sub, 'Fuel Tank', 5), (sub, 'Fuel Filler Cap', 6),
  (sub, 'Fuel Line', 7), (sub, 'Fuel Rail', 8);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_fuel, 'Air Intake', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Air Filter', 1), (sub, 'Throttle Body', 2), (sub, 'Intake Manifold', 3),
  (sub, 'Air Intake Hose', 4), (sub, 'PCV Valve', 5);

-- ===================== 12. TYRES & WHEELS =====================
INSERT INTO inspection_part_categories (id, name, icon, display_order) VALUES (gen_random_uuid(), 'Tyres & Wheels', 'tyres', 12) RETURNING id INTO cat_tyres;

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_tyres, 'Tyres', 1) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Tyre (Front Left)', 1), (sub, 'Tyre (Front Right)', 2),
  (sub, 'Tyre (Rear Left)', 3), (sub, 'Tyre (Rear Right)', 4), (sub, 'Spare Tyre', 5);

INSERT INTO inspection_part_subcategories (id, category_id, name, display_order) VALUES (gen_random_uuid(), cat_tyres, 'Wheels & Hardware', 2) RETURNING id INTO sub;
INSERT INTO inspection_part_definitions (subcategory_id, name, display_order) VALUES
  (sub, 'Alloy Wheel (Front Left)', 1), (sub, 'Alloy Wheel (Front Right)', 2),
  (sub, 'Alloy Wheel (Rear Left)', 3), (sub, 'Alloy Wheel (Rear Right)', 4),
  (sub, 'Wheel Nut Set', 5), (sub, 'Wheel Stud', 6),
  (sub, 'TPMS Sensor (Front Left)', 7), (sub, 'TPMS Sensor (Front Right)', 8),
  (sub, 'TPMS Sensor (Rear Left)', 9), (sub, 'TPMS Sensor (Rear Right)', 10);

END $$;
