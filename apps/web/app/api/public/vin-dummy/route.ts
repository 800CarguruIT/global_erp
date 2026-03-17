import { NextResponse } from "next/server";

const vinDummyData = [
  {
    vin: "SIMVIN2026CAMRY01",
    cars: [
      {
        id: "SIM-CAR-TOY-001",
        make: "Toyota",
        model: "Camry",
        year: "2023",
        title: "TOYOTA CAMRY 2.5L GCC",
        description: "ENGINE:2.5L; DRIVE:FWD; DEST:GCC; GRADE:LE; TRANS:AT",
      },
      {
        id: "SIM-CAR-TOY-002",
        make: "Toyota",
        model: "Camry",
        year: "2023",
        title: "TOYOTA CAMRY 3.5L SPORT",
        description: "ENGINE:3.5L; DRIVE:FWD; DEST:GCC; GRADE:SE; TRANS:AT",
      },
    ],
    parts: [
      {
        carId: "SIM-CAR-TOY-001",
        code: "04465-0D140",
        name: "Front Brake Pad Set",
        groups: [
          { id: "GRP-BRK", level: 1, name: "Brake System" },
          { id: "GRP-FT", level: 2, name: "Front Axle" },
        ],
      },
      {
        carId: "SIM-CAR-TOY-001",
        code: "90915-YZZE1",
        name: "Oil Filter Element",
        groups: [{ id: "GRP-ENG", level: 1, name: "Engine Service" }],
      },
      {
        carId: "SIM-CAR-TOY-001",
        code: "17801-0D060",
        name: "Air Filter",
        groups: [{ id: "GRP-INT", level: 1, name: "Intake System" }],
      },
      {
        carId: "SIM-CAR-TOY-002",
        code: "04465-06140",
        name: "Front Brake Pad Performance",
        groups: [{ id: "GRP-BRK", level: 1, name: "Brake System" }],
      },
      {
        carId: "SIM-CAR-TOY-002",
        code: "17801-F0010",
        name: "High Flow Air Filter",
        groups: [{ id: "GRP-INT", level: 1, name: "Intake System" }],
      },
      {
        carId: "SIM-CAR-TOY-002",
        code: "90916-03146",
        name: "Spark Plug Iridium",
        groups: [{ id: "GRP-IGN", level: 1, name: "Ignition System" }],
      },
    ],
  },
  {
    vin: "SIMVIN2026PRADO01",
    cars: [
      {
        id: "SIM-CAR-TOY-003",
        make: "Toyota",
        model: "Prado",
        year: "2022",
        title: "TOYOTA PRADO 2.8D TXL",
        description: "ENGINE:2.8D; DRIVE:4WD; DEST:GCC; GRADE:TXL; TRANS:AT",
      },
    ],
    parts: [
      {
        carId: "SIM-CAR-TOY-003",
        code: "23390-0L070",
        name: "Fuel Filter",
        groups: [{ id: "GRP-FUEL", level: 1, name: "Fuel System" }],
      },
      {
        carId: "SIM-CAR-TOY-003",
        code: "48510-6A460",
        name: "Front Shock Absorber",
        groups: [{ id: "GRP-SUS", level: 1, name: "Suspension" }],
      },
      {
        carId: "SIM-CAR-TOY-003",
        code: "90915-YZZD3",
        name: "Oil Filter Diesel",
        groups: [{ id: "GRP-ENG", level: 1, name: "Engine Service" }],
      },
    ],
  },
  {
    vin: "SIMVIN2026TESLA01",
    cars: [
      {
        id: "SIM-CAR-TSL-001",
        make: "Tesla",
        model: "Model 3",
        year: "2024",
        title: "TESLA MODEL 3 LONG RANGE",
        description: "ENGINE:EV; DRIVE:AWD; DEST:GCC; GRADE:LONG_RANGE; TRANS:1-SPEED",
      },
    ],
    parts: [
      {
        carId: "SIM-CAR-TSL-001",
        code: "1108801-00-B",
        name: "Cabin Air Filter HEPA",
        groups: [{ id: "GRP-HVAC", level: 1, name: "Cabin HVAC" }],
      },
      {
        carId: "SIM-CAR-TSL-001",
        code: "1188363-00-A",
        name: "Front Lower Control Arm",
        groups: [{ id: "GRP-SUS", level: 1, name: "Suspension" }],
      },
      {
        carId: "SIM-CAR-TSL-001",
        code: "1492617-00-A",
        name: "Charge Port Assembly",
        groups: [{ id: "GRP-ELEC", level: 1, name: "Electrical Charging" }],
      },
    ],
  },
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vinFilter = String(url.searchParams.get("vin") ?? "")
    .trim()
    .toUpperCase();
  const carIdFilter = String(url.searchParams.get("carId") ?? "").trim();

  let data = vinDummyData;
  if (vinFilter) {
    data = data.filter((entry) => entry.vin === vinFilter);
  }

  if (carIdFilter) {
    data = data
      .map((entry) => ({
        ...entry,
        cars: entry.cars.filter((car) => car.id === carIdFilter),
        parts: entry.parts.filter((part) => part.carId === carIdFilter),
      }))
      .filter((entry) => entry.cars.length > 0 || entry.parts.length > 0);
  }

  return NextResponse.json({
    data,
    meta: {
      totalVins: data.length,
      totalCars: data.reduce((sum, entry) => sum + entry.cars.length, 0),
      totalParts: data.reduce((sum, entry) => sum + entry.parts.length, 0),
      vinFilter: vinFilter || null,
      carIdFilter: carIdFilter || null,
    },
  });
}
