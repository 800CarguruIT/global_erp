import { NextRequest } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { getVinCatalogCarsByVin, upsertVinCatalogCars } from "@repo/ai-core/crm/vin-catalog/repository";
import { decodeVinWith17VinUsingConfig, prepareVin17Request } from "@/lib/vin17";
import { getVin17ConfigForCompany } from "@/lib/vin17-config";
import {
  resolveWorkshopAccess,
  workshopError,
  workshopErrorFromUnknown,
  workshopSuccess,
} from "../utils";

export async function GET(req: NextRequest) {
  try {
    const access = resolveWorkshopAccess(req, "read");
    const search = new URL(req.url).searchParams;
    const vin = String(search.get("vin") ?? "").trim().toUpperCase();
    const leadId = String(search.get("leadId") ?? "").trim();
    const requestedCarId = String(search.get("carId") ?? "").trim();
    const forceRefresh = String(search.get("refresh") ?? "").trim() === "1";

    if (!vin) {
      return workshopError("VIN is required.", 400);
    }

    if (leadId) {
      const lead = await getLeadById(access.companyId, leadId);
      if (!lead) return workshopError("Lead not found.", 404);
    }

    // Current parts catalog flow is intentionally paused.
    if (!forceRefresh) {
      const cachedCars = await getVinCatalogCarsByVin(vin);
      if (cachedCars.length > 0) {
        const selectedCar =
          (requestedCarId ? cachedCars.find((c) => String(c.id) === requestedCarId) ?? null : null) ??
          (cachedCars.length === 1 ? cachedCars[0] : null);
        const requiresCarSelection = cachedCars.length > 1 && !selectedCar;
        return workshopSuccess({
          vin,
          cars: cachedCars,
          car: selectedCar,
          partsBrand: null,
          parts: [],
          partsCount: 0,
          requiresCarSelection,
          partsCatalogPaused: true,
          source: "global_erp",
          companyId: access.companyId,
        });
      }
    }

    const vin17Config = await getVin17ConfigForCompany(access.companyId);
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

    return workshopSuccess({
      vin: decoded.vin,
      cars,
      car: selectedCar,
      partsBrand: null,
      parts: [],
      partsCount: 0,
      requiresCarSelection,
      partsCatalogPaused: true,
      source: "17vin",
      companyId: access.companyId,
    });
  } catch (error: any) {
    try {
      const access = resolveWorkshopAccess(req, "read");
      const search = new URL(req.url).searchParams;
      const vin = String(search.get("vin") ?? "").trim().toUpperCase();
      if (vin) {
        const vin17Config = await getVin17ConfigForCompany(access.companyId);
        const prepared = prepareVin17Request(vin, vin17Config ?? undefined);
        return workshopError("Failed to decode VIN with 17vin.", 502, {
          provider: "17vin",
          details: String(error?.message ?? "upstream_error"),
          signaturePreview: {
            urlParameter: prepared.urlParameter,
            username: prepared.username,
            usernameHash: prepared.usernameHash,
            passwordHash: prepared.passwordHash,
            signature: prepared.signature,
            requestUrl: prepared.requestUrl,
          },
        });
      }
    } catch {
      // no-op
    }
    return workshopErrorFromUnknown(error);
  }
}

