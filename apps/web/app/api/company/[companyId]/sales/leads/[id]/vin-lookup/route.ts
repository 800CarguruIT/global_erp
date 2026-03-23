import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { decodeVinWith17VinUsingConfig, prepareVin17Request } from "@/lib/vin17";
import { getVin17ConfigForCompany } from "@/lib/vin17-config";
import { getVinCatalogCarsByVin, upsertVinCatalogCars } from "@repo/ai-core/crm/vin-catalog/repository";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const search = new URL(req.url).searchParams;
  const vin = String(search.get("vin") ?? "").trim().toUpperCase();
  const requestedCarId = String(search.get("carId") ?? "").trim();
  const forceRefresh = String(search.get("refresh") ?? "").trim() === "1";
  if (!vin) return NextResponse.json({ error: "VIN is required." }, { status: 400 });

  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  // Current parts catalog flow is intentionally paused.
  if (!forceRefresh) {
    const cachedCars = await getVinCatalogCarsByVin(vin);
    if (cachedCars.length > 0) {
      const selectedCar =
        (requestedCarId ? cachedCars.find((c) => String(c.id) === requestedCarId) ?? null : null) ??
        (cachedCars.length === 1 ? cachedCars[0] : null);
      const requiresCarSelection = cachedCars.length > 1 && !selectedCar;
      return NextResponse.json({
        data: {
          vin,
          cars: cachedCars,
          car: selectedCar,
          partsBrand: null,
          parts: [],
          partsCount: 0,
          requiresCarSelection,
          partsCatalogPaused: true,
          source: "global_erp",
        },
      });
    }
  }

  const vin17Config = await getVin17ConfigForCompany(companyId);
  try {
    const decoded = await decodeVinWith17VinUsingConfig(vin, vin17Config ?? undefined);
    const cars = decoded.cars;
    if (cars.length > 0) {
      await upsertVinCatalogCars({
        vin,
        cars: cars.map((car) => ({
          id: car.id,
          make: car.make,
          model: car.model,
          year: car.year,
          title: car.title,
          description: car.description,
        })),
      });
    }
    const selectedCar =
      (requestedCarId ? cars.find((c) => String(c.id) === requestedCarId) ?? null : null) ??
      (cars.length === 1 ? cars[0] : null);
    const requiresCarSelection = cars.length > 1 && !selectedCar;

    return NextResponse.json({
      data: {
        vin: decoded.vin,
        cars,
        car: selectedCar,
        partsBrand: null,
        parts: [],
        partsCount: 0,
        requiresCarSelection,
        partsCatalogPaused: true,
        source: "17vin",
      },
    });
  } catch (err: any) {
    // Surface deterministic request-signature data to speed up integration testing.
    try {
      const prepared = prepareVin17Request(vin, vin17Config ?? undefined);
      return NextResponse.json(
        {
          error: "Failed to decode VIN with 17vin.",
          details: String(err?.message ?? "upstream_error"),
          provider: "17vin",
          signaturePreview: {
            urlParameter: prepared.urlParameter,
            username: prepared.username,
            usernameHash: prepared.usernameHash,
            passwordHash: prepared.passwordHash,
            signature: prepared.signature,
            requestUrl: prepared.requestUrl,
          },
        },
        { status: 502 }
      );
    } catch (prepErr: any) {
      return NextResponse.json(
        {
          error: "17vin configuration is incomplete.",
          details: String(prepErr?.message ?? "vin17_not_configured"),
          provider: "17vin",
        },
        { status: 503 }
      );
    }
  }
}
