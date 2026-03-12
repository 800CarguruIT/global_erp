import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { getVinCatalogSnapshotByVin, upsertVinCatalogSnapshot } from "@repo/ai-core/crm/vin-catalog/repository";

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

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const vin = String(new URL(req.url).searchParams.get("vin") ?? "").trim().toUpperCase();
  if (!vin) return NextResponse.json({ error: "VIN is required." }, { status: 400 });

  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  try {
    const cached = await getVinCatalogSnapshotByVin(vin);
    if (cached) {
      return NextResponse.json({
        data: {
          ...cached,
          source: "cache",
        },
      });
    }

    const carsPayload = await fetchJsonWithProtocolFallback(
      `/api/parts_catalog/get_cars_by_vin.php?vin=${encodeURIComponent(vin)}`
    );
    const carsList: CarguruCar[] = Array.isArray(carsPayload?.list) ? carsPayload.list : [];
    const car = carsList[0];

    if (!car?.id) {
      return NextResponse.json({
        data: {
          vin,
          car: null,
          partsBrand: null,
          parts: [],
          partsCount: 0,
        },
      });
    }

    const partsPayload = await fetchJsonWithProtocolFallback(
      `/api/parts_catalog/get_parts_by_carId.php?carId=${encodeURIComponent(String(car.id))}`
    );
    const partsList: CarguruPart[] = Array.isArray(partsPayload?.list) ? partsPayload.list : [];
    await upsertVinCatalogSnapshot({
      vin,
      car: car as any,
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
        car: {
          id: String(car.id),
          make: String(car.brand?.name ?? "").trim(),
          model: String(car.model ?? car.info?.title ?? "").trim(),
          year: String(car.year ?? "").trim(),
          description: String(car.info?.description ?? "").trim(),
        },
        partsBrand: partsPayload?.partsBrand ?? null,
        parts: normalizedParts,
        partsCount: normalizedParts.length,
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
