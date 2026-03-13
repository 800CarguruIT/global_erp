import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import {
  getVinCatalogCarsByVin,
  getVinCatalogSnapshotByVinAndCarId,
  upsertVinCatalogCars,
  upsertVinCatalogSnapshot,
} from "@repo/ai-core/crm/vin-catalog/repository";

type Params = { params: Promise<{ companyId: string; id: string }> };

type CarguruCar = {
  id?: string;
  model?: string;
  year?: string;
  brand?: { id?: string; name?: string };
  info?: { title?: string; description?: string };
};

type CarguruPart = {
  code?: string;
  name?: string;
  groups?: Array<{ id?: string; level?: number; name?: string }>;
};

type NormalizedCar = {
  id: string;
  make: string;
  model: string;
  year: string;
  title: string;
  description: string;
};

async function fetchJsonWithProtocolFallback(urlPath: string) {
  const urls = [`https://800carguru.me${urlPath}`, `http://800carguru.me${urlPath}`];
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`Upstream request failed (${res.status}) for ${url}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("VIN lookup upstream failed");
}

function normalizeCar(car: CarguruCar | null | undefined): NormalizedCar | null {
  if (!car?.id) return null;
  return {
    id: String(car.id),
    make: String(car.brand?.name ?? "").trim(),
    model: String(car.model ?? car.info?.title ?? "").trim(),
    year: String(car.year ?? "").trim(),
    title: String(car.info?.title ?? "").trim(),
    description: String(car.info?.description ?? "").trim(),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const search = new URL(req.url).searchParams;
  const vin = String(search.get("vin") ?? "").trim().toUpperCase();
  const requestedCarId = String(search.get("carId") ?? "").trim();
  if (!vin) return NextResponse.json({ error: "VIN is required." }, { status: 400 });

  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  try {
    const cachedCars = await getVinCatalogCarsByVin(vin);
    if (cachedCars.length > 0) {
      if (requestedCarId) {
        const cachedSelected = await getVinCatalogSnapshotByVinAndCarId(vin, requestedCarId);
        if (cachedSelected && cachedSelected.partsCount > 0) {
          return NextResponse.json({
            data: {
              ...cachedSelected,
              cars: cachedCars,
              requiresCarSelection: false,
              source: "cache",
            },
          });
        }
      } else if (cachedCars.length > 1) {
        return NextResponse.json({
          data: {
            vin,
            cars: cachedCars,
            car: null,
            partsBrand: null,
            parts: [],
            partsCount: 0,
            requiresCarSelection: true,
            source: "cache",
          },
        });
      } else {
        const cachedSingle = await getVinCatalogSnapshotByVinAndCarId(vin, cachedCars[0]!.id);
        if (cachedSingle && cachedSingle.partsCount > 0) {
          return NextResponse.json({
            data: {
              ...cachedSingle,
              cars: cachedCars,
              requiresCarSelection: false,
              source: "cache",
            },
          });
        }
      }
    }

    const carsPayload = await fetchJsonWithProtocolFallback(
      `/api/parts_catalog/get_cars_by_vin.php?vin=${encodeURIComponent(vin)}`
    );
    const carsList: CarguruCar[] = Array.isArray(carsPayload?.list) ? carsPayload.list : [];
    const normalizedCars = carsList.map((c) => normalizeCar(c)).filter(Boolean) as NormalizedCar[];
    if (carsList.length > 0) {
      await upsertVinCatalogCars({ vin, cars: carsList as any });
    }
    const selectedCar =
      (requestedCarId ? normalizedCars.find((c) => c.id === requestedCarId) : null) ??
      (normalizedCars.length === 1 ? normalizedCars[0] : null);

    if (!normalizedCars.length) {
      return NextResponse.json({
        data: {
          vin,
          cars: [],
          car: null,
          partsBrand: null,
          parts: [],
          partsCount: 0,
          requiresCarSelection: false,
        },
      });
    }

    if (!selectedCar) {
      return NextResponse.json({
        data: {
          vin,
          cars: normalizedCars,
          car: null,
          partsBrand: null,
          parts: [],
          partsCount: 0,
          requiresCarSelection: true,
          source: "api",
        },
      });
    }

    const partsPayload = await fetchJsonWithProtocolFallback(
      `/api/parts_catalog/get_parts_by_carId.php?carId=${encodeURIComponent(selectedCar.id)}`
    );
    const partsList: CarguruPart[] = Array.isArray(partsPayload?.list) ? partsPayload.list : [];
    await upsertVinCatalogSnapshot({
      vin,
      car: selectedCar as any,
      parts: partsList as any,
      partsBrand: partsPayload?.partsBrand ?? null,
    });

    const normalizedParts = partsList.map((part) => ({
      code: String(part?.code ?? "").trim(),
      name: String(part?.name ?? "").trim(),
      groups: Array.isArray(part?.groups)
        ? part.groups.map((group) => ({
            id: String(group?.id ?? "").trim(),
            level: Number(group?.level ?? 0) || 0,
            name: String(group?.name ?? "").trim(),
          }))
        : [],
    }));

    return NextResponse.json({
      data: {
        vin,
        cars: normalizedCars,
        car: selectedCar,
        partsBrand: partsPayload?.partsBrand ?? null,
        parts: normalizedParts,
        partsCount: normalizedParts.length,
        requiresCarSelection: false,
        source: "api",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Failed to fetch VIN data from catalog.",
        details: String(err?.message ?? "upstream_error"),
      },
      { status: 502 }
    );
  }
}
