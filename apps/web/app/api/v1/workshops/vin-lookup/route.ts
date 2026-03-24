import { NextRequest } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import {
  getVinCatalogCarsByVin,
  getVinCatalogSnapshotByVinAndCarId,
  upsertVinCatalogCars,
  upsertVinCatalogSnapshot,
} from "@repo/ai-core/crm/vin-catalog/repository";
import {
  decodeVinWith17VinUsingConfig,
  fetchVin17PartsUsingConfig,
  prepareVin17PartsRequest,
  prepareVin17Request,
} from "@/lib/vin17";
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
    const epc = String(search.get("epc") ?? "").trim();
    const lastCataCode = String(search.get("last_cata_code") ?? "").trim();
    const lastCataCodeLevel = String(search.get("last_cata_code_level") ?? "").trim();
    const isVinFilterOpen = String(search.get("is_vin_filter_open") ?? "").trim() || "1";
    const epcId = String(search.get("epc_id") ?? "").trim();
    const jsId = String(search.get("js_id") ?? "").trim();
    const wantsParts = Boolean(lastCataCode && lastCataCodeLevel);

    if (!vin) {
      return workshopError("VIN is required.", 400);
    }

    if (leadId) {
      const lead = await getLeadById(access.companyId, leadId);
      if (!lead) return workshopError("Lead not found.", 404);
    }

    // Current parts catalog flow can fetch 17vin parts when cata parameters are provided.
    if (!forceRefresh) {
      const cachedCars = await getVinCatalogCarsByVin(vin);
      if (cachedCars.length > 0) {
        const selectedCar =
          (requestedCarId ? cachedCars.find((c) => String(c.id) === requestedCarId) ?? null : null) ??
          (cachedCars.length === 1 ? cachedCars[0] : null);
        const requiresCarSelection = cachedCars.length > 1 && !selectedCar;
        const cachedPartsSnapshot =
          wantsParts && selectedCar
            ? await getVinCatalogSnapshotByVinAndCarId(vin, String(selectedCar.id)).catch(() => null)
            : null;
        return workshopSuccess({
          vin,
          cars: cachedCars,
          car: selectedCar,
          partsBrand: cachedPartsSnapshot?.partsBrand ?? null,
          parts: cachedPartsSnapshot?.parts ?? [],
          partsCount: cachedPartsSnapshot?.partsCount ?? 0,
          requiresCarSelection,
          partsCatalogPaused: !wantsParts,
          source: "global_erp",
          companyId: access.companyId,
          requestUrls: {
            vinDecodeUrl: null,
            partsUrl: null,
          },
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
    const resolvedEpc = epc || String((decoded.raw as any)?.data?.epc ?? (decoded.raw as any)?.epc ?? "").trim();
    let partsBrand: unknown = null;
    let parts: Array<{ code: string; name: string; groups: Array<{ id: string; level: number; name: string }> }> = [];
    let partsCount = 0;
    let partsUrl: string | null = null;
    if (wantsParts && selectedCar) {
      if (!resolvedEpc) {
        return workshopError("epc is required to fetch parts for this VIN.", 400, { provider: "17vin" });
      }
      const partsResult = await fetchVin17PartsUsingConfig(
        {
          vin,
          epc: resolvedEpc,
          lastCataCode,
          lastCataCodeLevel,
          isVinFilterOpen,
          epcId,
          jsId,
        },
        vin17Config ?? undefined
      );
      partsBrand = partsResult.partsBrand ?? null;
      parts = partsResult.parts;
      partsCount = partsResult.partsCount;
      partsUrl = partsResult.requestUrl;
      await upsertVinCatalogSnapshot({
        vin,
        car: {
          id: selectedCar.id,
          make: selectedCar.make,
          model: selectedCar.model,
          year: selectedCar.year,
          title: selectedCar.title,
          description: selectedCar.description,
        },
        parts,
        partsBrand,
      });
    }

    return workshopSuccess({
      vin: decoded.vin,
      cars,
      car: selectedCar,
      partsBrand,
      parts,
      partsCount,
      requiresCarSelection,
      partsCatalogPaused: !wantsParts,
      source: "17vin",
      companyId: access.companyId,
      requestUrls: {
        vinDecodeUrl: decoded.requestUrl,
        partsUrl,
      },
    });
  } catch (error: any) {
    try {
      const access = resolveWorkshopAccess(req, "read");
      const search = new URL(req.url).searchParams;
      const vin = String(search.get("vin") ?? "").trim().toUpperCase();
      const epc = String(search.get("epc") ?? "").trim();
      const lastCataCode = String(search.get("last_cata_code") ?? "").trim();
      const lastCataCodeLevel = String(search.get("last_cata_code_level") ?? "").trim();
      const isVinFilterOpen = String(search.get("is_vin_filter_open") ?? "").trim() || "1";
      const epcId = String(search.get("epc_id") ?? "").trim();
      const jsId = String(search.get("js_id") ?? "").trim();
      const wantsParts = Boolean(lastCataCode && lastCataCodeLevel);
      if (vin) {
        const vin17Config = await getVin17ConfigForCompany(access.companyId);
        const prepared =
          wantsParts && epc
            ? prepareVin17PartsRequest(
                {
                  vin,
                  epc,
                  lastCataCode,
                  lastCataCodeLevel,
                  isVinFilterOpen,
                  epcId,
                  jsId,
                },
                vin17Config ?? undefined
              )
            : prepareVin17Request(vin, vin17Config ?? undefined);
        return workshopError(wantsParts ? "Failed to fetch parts with 17vin." : "Failed to decode VIN with 17vin.", 502, {
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
