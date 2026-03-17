-- 141_categories_seed_from_csv.sql
-- Create hierarchical categories table and seed from categories_with_parent_id.csv

CREATE TABLE IF NOT EXISTS categories (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  parent_id bigint REFERENCES categories(id) ON DELETE CASCADE,
  level int NOT NULL CHECK (level >= 1),
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);
CREATE INDEX IF NOT EXISTS idx_categories_parent_name ON categories(parent_id, name);

CREATE TEMP TABLE category_seed (
  source_id bigint PRIMARY KEY,
  source_parent_id bigint NULL,
  level int NOT NULL,
  name text NOT NULL
) ON COMMIT DROP;

INSERT INTO category_seed (source_id, source_parent_id, level, name) VALUES
  (1, NULL, 1, 'Accessories and miscellaneous'),
  (2, 1, 2, 'Towing, cargo holder'),
  (3, 1, 2, 'Deflectors, mudguards, moldings'),
  (4, 1, 2, 'Information signs, decals'),
  (5, 4, 3, 'Caution plate'),
  (6, 1, 2, 'Security, anti-theft alarm system'),
  (7, NULL, 1, 'Maintenance parts'),
  (8, 7, 2, 'Filters'),
  (9, 7, 2, 'Lamps'),
  (10, 7, 2, 'Wipers'),
  (11, 7, 2, 'Ignition, glow plugs'),
  (12, 7, 2, 'Brake shoes'),
  (13, 7, 2, 'Brake disc, drum'),
  (14, 7, 2, 'Tools'),
  (15, 14, 3, 'Crescent, box-ended, socket wrenches'),
  (16, 14, 3, 'Pliers'),
  (17, 14, 3, 'Screwdrivers'),
  (18, 14, 3, 'Impact tools'),
  (19, 14, 3, 'Lifting, supporting tools'),
  (20, 14, 3, 'Hydraulic tools'),
  (21, 14, 3, 'Tool storage systems'),
  (22, NULL, 1, 'Engine'),
  (23, 22, 2, 'IC engine assembly'),
  (24, 22, 2, 'Cylinder block, crankcase'),
  (25, 24, 3, 'IC engine unit'),
  (26, 24, 3, 'IC engine cover'),
  (27, 24, 3, 'Flywheel'),
  (28, 27, 4, 'Torque converter, front oil pump & Chain (atm)'),
  (29, 24, 3, 'Oil pan, crankcase'),
  (30, 22, 2, 'Cylinder block head'),
  (31, 30, 3, 'Cylinder head plugs'),
  (32, 22, 2, 'Engine mounting, support'),
  (33, 32, 3, 'Engine mount bracket'),
  (34, 22, 2, 'Gaskets, seals'),
  (35, 34, 3, 'Cylinder head gasket'),
  (36, 35, 4, 'Engine overhaul gasket kit'),
  (37, 34, 3, 'Other IC engine gaskets'),
  (38, 34, 3, 'Cylinder unit seal'),
  (39, 34, 3, 'Engine overhaul gasket kit'),
  (40, 22, 2, 'IC engine drive belt'),
  (41, 22, 2, 'Valvetrain, timing belts, pulleys, HP fuel pump drive'),
  (42, 41, 3, 'Timing belt cover'),
  (43, 22, 2, 'IC engine: ventilation, recirculation system'),
  (44, 43, 3, 'Crankcase ventilation valve'),
  (45, 43, 3, 'IC engine breather hose'),
  (46, 43, 3, 'Gaskets, seals'),
  (47, 22, 2, 'IC engine: lubrication system'),
  (48, 47, 3, 'IC engine: oil pump'),
  (49, 47, 3, 'Oil pan, crankcase'),
  (50, 47, 3, 'IC engine lubrication system gaskets'),
  (51, 47, 3, 'Oil radiator'),
  (52, 47, 3, 'IC engine: oil filter'),
  (53, NULL, 1, 'IC engine cooling'),
  (54, 53, 2, 'Expansion tank'),
  (55, 53, 2, 'IC engine cooler: fan, electric motor'),
  (56, 53, 2, 'IC engine cooling system: pipes, flanges, valves'),
  (57, 56, 3, 'Cooling system pipe'),
  (58, 53, 2, 'IC engine cooling system radiator'),
  (59, NULL, 1, 'Body, car glass'),
  (60, 59, 2, 'Radiator grille'),
  (61, 59, 2, 'Hood'),
  (62, 59, 2, 'Front, rear wing'),
  (63, 62, 3, 'Front wing'),
  (64, 62, 3, 'Rear wing'),
  (65, 64, 4, 'Side member'),
  (66, 59, 2, 'Engine compartment parts'),
  (67, 59, 2, 'Rear-view mirror, components'),
  (68, 59, 2, 'Doors, glass-lifters, handles, locks'),
  (69, 68, 3, 'Front door panel & Glass'),
  (70, 68, 3, 'Lock cylinder set'),
  (71, 68, 3, 'Armrest & Visor'),
  (72, 68, 3, 'Switch & Relay & Computer'),
  (73, 59, 2, 'Car glass'),
  (74, 73, 3, 'Windshield'),
  (75, 73, 3, 'Side glass'),
  (76, 59, 2, 'Passenger and luggage compartments'),
  (77, 76, 3, 'Dashboard'),
  (78, 77, 4, 'Glovebox'),
  (79, 77, 4, 'Instrument panel & Glove compartment'),
  (80, 76, 3, 'Interior, decorative and lining parts for passenger and luggage compartments'),
  (81, 80, 4, 'Instrument panel & Glove compartment'),
  (82, 80, 4, 'Seat & Seat track'),
  (83, 76, 3, 'Seats'),
  (84, 83, 4, 'Seat & Seat track'),
  (85, 59, 2, 'Safety system'),
  (86, 85, 3, 'Instrument panel & Glove compartment'),
  (87, 59, 2, 'Body frame, frame, roof, bottom, side panels'),
  (88, 87, 3, 'Roof, sunroof'),
  (89, 88, 4, 'Sunroof, components'),
  (90, 87, 3, 'Side body parts, dividers, tail gates'),
  (91, 90, 4, 'Side member'),
  (92, 90, 4, 'Wiring & Clamp'),
  (93, 87, 3, 'Spare wheel bottom, floor, well'),
  (94, 87, 3, 'Body frame, frame, longeron'),
  (95, 59, 2, 'Fuel tank cap, components'),
  (96, 59, 2, 'Trunk lid, door'),
  (97, 59, 2, 'Headlight, windshield wiper'),
  (98, 97, 3, 'Windshield washer: sensors, relays, valves, units, switches'),
  (99, 97, 3, 'Wiper drive mechanism'),
  (100, 97, 3, 'Windshield washer tubes, connectors'),
  (101, 97, 3, 'Windshield nozzle'),
  (102, 97, 3, 'Windshield wiper blade'),
  (103, 97, 3, 'Wiper drive motor'),
  (104, 59, 2, 'Exterior lighting system'),
  (105, 104, 3, 'Headlight'),
  (106, 104, 3, 'Fog light'),
  (107, 104, 3, 'Turn signal repeater'),
  (108, 104, 3, 'Lamp'),
  (109, 104, 3, 'Rear light'),
  (110, 59, 2, 'Interior lighting system'),
  (111, 59, 2, 'Moldings, reflectors, plates, spoilers'),
  (112, 111, 3, 'Inside trim board'),
  (113, 59, 2, 'Emblems, signs, information plates'),
  (114, NULL, 1, 'Heating, A/C'),
  (115, 114, 2, 'System sensors, units, valves, controllers'),
  (116, 114, 2, 'A/C compressor'),
  (117, 114, 2, 'A/C evaporator, dehumidifier'),
  (118, 114, 2, 'Interior heater'),
  (119, 114, 2, 'Interior heater radiator'),
  (120, 114, 2, 'Interior filter'),
  (121, 114, 2, 'Air ducts'),
  (122, NULL, 1, 'Suspension, chassis'),
  (123, 122, 2, 'Suspension sensors, units, valves, controllers'),
  (124, 122, 2, 'Front, rear subframe'),
  (125, 122, 2, 'Steering knuckle, hub, trunnion, components'),
  (126, 122, 2, 'Suspension arms, tie rods, components'),
  (127, NULL, 1, 'Transmission, gearbox'),
  (128, 127, 2, 'Transmission sensors, units, valves, controllers'),
  (129, 127, 2, 'A/T, components'),
  (130, 129, 3, 'Automatic transmission'),
  (131, 130, 4, 'Torque converter, front oil pump & Chain (atm)'),
  (132, 129, 3, 'Automatic transmission shaft'),
  (133, 129, 3, 'Automatic transmission bearing, slide bushing'),
  (134, 129, 3, 'Automatic transmission gear, clutch, sprocket'),
  (135, 127, 2, 'M/T, components'),
  (136, 135, 3, 'Manual transmission: bearing, slide bushing'),
  (137, 135, 3, 'Manual transmission: gear, clutch, sprocket'),
  (138, 127, 2, 'Transfer box: components'),
  (139, 127, 2, 'Differential'),
  (140, 127, 2, 'Transmission mounts'),
  (141, 127, 2, 'Gear shift mechanism'),
  (142, 127, 2, 'Transmission gaskets, seals, glands'),
  (143, 142, 3, 'Torque converter, front oil pump & Chain (atm)'),
  (144, 127, 2, 'Transmission repair kits'),
  (145, 127, 2, 'Clutch system'),
  (146, 127, 2, 'Transmission lubrication system'),
  (147, 146, 3, 'Transmission oil pump'),
  (148, 146, 3, 'Transmission oil radiator'),
  (149, 146, 3, 'Oil tube'),
  (150, 146, 3, 'Transmission oil filter'),
  (151, 127, 2, 'Cardan shaft'),
  (152, 127, 2, 'Wheel drive'),
  (153, 127, 2, 'Front and rear axle'),
  (154, NULL, 1, 'Wheels, tyres'),
  (155, 154, 2, 'Wheel, stamped, alloy'),
  (156, 155, 3, 'Disc wheel & Wheel cap'),
  (157, 154, 2, 'Tyres'),
  (158, 157, 3, 'Disc wheel & Wheel cap'),
  (159, NULL, 1, 'Steering'),
  (160, 159, 2, 'Steering sensors, units, valves, controllers'),
  (161, 159, 2, 'Steering wheel'),
  (162, 159, 2, 'Steering column'),
  (163, 159, 2, 'Steering tie rod end'),
  (164, 159, 2, 'Steering gaskets, seals, glands'),
  (165, 159, 2, 'Steering rack'),
  (166, 159, 2, 'Tie rod, idler arm, cross tie rod'),
  (167, NULL, 1, 'Fuel system'),
  (168, 167, 2, 'Fuel tank, components'),
  (169, 168, 3, 'Fuel-filling pipe, fuel tank filler'),
  (170, 167, 2, 'Accelerator pedal, rope'),
  (171, NULL, 1, 'Air system'),
  (172, 171, 2, 'Air supply system: sensors, units, valves, controllers'),
  (173, 171, 2, 'Vacuum system'),
  (174, 171, 2, 'Air supply pipe for IC engine'),
  (175, 171, 2, 'Turbocharger, turbine'),
  (176, 171, 2, 'Air filter'),
  (177, NULL, 1, 'Ignition system'),
  (178, 177, 2, 'Ignition system: sensors, units, controllers'),
  (179, 177, 2, 'Ignition lock'),
  (180, 177, 2, 'Ignition coil'),
  (181, 177, 2, 'Ignition plug'),
  (182, NULL, 1, 'Brake system'),
  (183, 182, 2, 'Brake system: sensors, units, valves, controllers'),
  (184, 183, 3, 'Brake tube & Clamp'),
  (185, 182, 2, 'Disc brakes'),
  (186, 182, 2, 'Disc brake shoes'),
  (187, 182, 2, 'Drum brakes'),
  (188, 182, 2, 'Drum brake shoes'),
  (189, 182, 2, 'Parking brake system'),
  (190, 189, 3, 'Parking brake & Cable'),
  (191, 182, 2, 'Brake caliper'),
  (192, 182, 2, 'Brake pedal'),
  (193, 182, 2, 'Brake master cylinder'),
  (194, 182, 2, 'Brake system hose, tube'),
  (195, 194, 3, 'Brake tube & Clamp'),
  (196, 182, 2, 'Brake boost'),
  (197, 196, 3, 'Vacuum brake booster system'),
  (198, 182, 2, 'Brake system repair kits'),
  (199, NULL, 1, 'Filters'),
  (200, NULL, 1, 'Electrical'),
  (201, 200, 2, 'Car battery'),
  (202, 201, 3, 'Car battery'),
  (203, 201, 3, 'Battery terminals'),
  (204, 200, 2, 'Audio, video, communication, navigation'),
  (205, 204, 3, 'Radio receiver & Amplifier & Condenser'),
  (206, 200, 2, 'Control units'),
  (207, 206, 3, 'Brake tube & Clamp'),
  (208, 206, 3, 'Switch & Relay & Computer'),
  (209, 200, 2, 'Switches, buttons, keys'),
  (210, 209, 3, 'Switch & Relay & Computer'),
  (211, 200, 2, 'Generator, components'),
  (212, 211, 3, 'Generator'),
  (213, 211, 3, 'Generator condenser, rectifier'),
  (214, 211, 3, 'Generator bearings, bushings'),
  (215, 211, 3, 'Generator voltage regulator, relay'),
  (216, 211, 3, 'Generator rotor, armature'),
  (217, 211, 3, 'Generator stator, winding'),
  (218, 211, 3, 'Generator drive gear, pulley'),
  (219, 200, 2, 'Sensors'),
  (220, 219, 3, 'Wheel sensors'),
  (221, 219, 3, 'Body parts sensors'),
  (222, 219, 3, 'Windshield sensors'),
  (223, 219, 3, 'Suspension, chassis sensors'),
  (224, 219, 3, 'Safety system sensors'),
  (225, 219, 3, 'Sensors of interior A/C and heating system'),
  (226, 219, 3, 'Air supply system sensors'),
  (227, 219, 3, 'Driver assist system sensors, parking sensors'),
  (228, 219, 3, 'Brake system sensors'),
  (229, 219, 3, 'Transmission sensors'),
  (230, 200, 2, 'Relay'),
  (231, 230, 3, 'Switch & Relay & Computer'),
  (232, 200, 2, 'Fuses'),
  (233, 200, 2, 'Control devices'),
  (234, 200, 2, 'Exterior lighting system'),
  (235, 200, 2, 'Interior lighting system'),
  (236, 200, 2, 'Electrical wiring'),
  (237, 236, 3, 'Wiring & Clamp'),
  (238, 200, 2, 'Electric engines, electric pumps, servo motors'),
  (239, 238, 3, 'Interior heater electric motor'),
  (240, 238, 3, 'Electric motor for IC engine cooler'),
  (241, 238, 3, 'Glass lifter electric motor'),
  (242, 238, 3, 'Windshield, headlight washer pump/motor'),
  (243, NULL, 1, 'Multi-purpose parts'),
  (244, 243, 2, 'Mounting material'),
  (245, 243, 2, 'Metal fasteners'),
  (246, 243, 2, 'Seals'),
  (247, 246, 3, 'Torque converter, front oil pump & Chain (atm)'),
  (248, 243, 2, 'All-purpose fasteners'),
  (249, 243, 2, 'Floor insulator'),
  (250, NULL, 1, 'Others'),
  (251, 250, 2, 'Cylinder head'),
  (252, 250, 2, 'Cylinder block'),
  (253, 250, 2, 'Rear axle housing & Differential'),
  (254, 250, 2, 'Disc wheel & Wheel cap'),
  (255, 250, 2, 'Front drive shaft'),
  (256, 250, 2, 'Brake tube & Clamp'),
  (257, 250, 2, 'Front bumper & Bumper stay'),
  (258, 250, 2, 'Hole plug'),
  (259, 250, 2, 'Roof headlining & Silencer pad'),
  (260, 250, 2, 'Seat & Seat track'),
  (261, 250, 2, 'Caution plate'),
  (262, 250, 2, 'Wiring & Clamp'),
  (263, 250, 2, 'Switch & Relay & Computer'),
  (264, 250, 2, 'Windshield washer');

CREATE TEMP TABLE category_import_map (
  source_id bigint PRIMARY KEY,
  category_id bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  l int;
  max_l int;
BEGIN
  SELECT MAX(level) INTO max_l FROM category_seed;
  IF max_l IS NULL THEN
    RETURN;
  END IF;

  FOR l IN 1..max_l LOOP
    INSERT INTO categories (name, parent_id, level, status)
    SELECT s.name, pm.category_id, s.level, true
    FROM category_seed s
    LEFT JOIN category_import_map pm ON pm.source_id = s.source_parent_id
    WHERE s.level = l
      AND NOT EXISTS (
        SELECT 1
        FROM categories c
        WHERE c.name = s.name
          AND c.level = s.level
          AND (
            (pm.category_id IS NULL AND c.parent_id IS NULL)
            OR c.parent_id = pm.category_id
          )
      );

    INSERT INTO category_import_map (source_id, category_id)
    SELECT s.source_id, c.id
    FROM category_seed s
    LEFT JOIN category_import_map pm ON pm.source_id = s.source_parent_id
    JOIN categories c
      ON c.name = s.name
     AND c.level = s.level
     AND (
       (pm.category_id IS NULL AND c.parent_id IS NULL)
       OR c.parent_id = pm.category_id
     )
    WHERE s.level = l
    ON CONFLICT (source_id) DO NOTHING;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION touch_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_categories_updated_at ON categories;
CREATE TRIGGER trg_touch_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION touch_categories_updated_at();
