import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import {
  decodeVinWith17VinUsingConfig,
  fetchVin17CatalogByActionUsingConfig,
  fetchVin17PartsUsingConfig,
  prepareVin17CatalogRequest,
  prepareVin17PartsRequest,
  prepareVin17Request,
  type Vin17Part,
} from "@/lib/vin17";
import { getVin17ConfigForCompany } from "@/lib/vin17-config";
import {
  getVinCatalogCarsByVin,
  getVinCatalogSnapshotByVinAndCarId,
  upsertVinCatalogCars,
  upsertVinCatalogSnapshot,
} from "@repo/ai-core/crm/vin-catalog/repository";
import { getOpenAIClientForCompany } from "@repo/ai-core";

type Params = { params: Promise<{ companyId: string; id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const search = new URL(req.url).searchParams;
  const vin = String(search.get("vin") ?? "").trim().toUpperCase();
  const requestedCarId = String(search.get("carId") ?? "").trim();
  const forceRefresh = String(search.get("refresh") ?? "").trim() === "1";
  const epc = String(search.get("epc") ?? "").trim();
  const catalogAction = String(search.get("catalog_action") ?? "").trim().toLowerCase();
  const cata1Code = String(search.get("cata1_code") ?? "").trim();
  const cata2Code = String(search.get("cata2_code") ?? "").trim();
  const cata3Code = String(search.get("cata3_code") ?? "").trim();
  const lastCataCode = String(search.get("last_cata_code") ?? "").trim();
  const lastCataCodeLevel = String(search.get("last_cata_code_level") ?? "").trim();
  const isVinFilterOpen = String(search.get("is_vin_filter_open") ?? "").trim() || "1";
  const epcId = String(search.get("epc_id") ?? "").trim();
  const jsId = String(search.get("js_id") ?? "").trim();
  const wantsParts = Boolean(lastCataCode && lastCataCodeLevel);
  const wantsCatalog = ["cata1", "cata2", "cata3", "cata4"].includes(catalogAction);
  if (!vin) return NextResponse.json({ error: "VIN is required." }, { status: 400 });

  const lead = await getLeadById(companyId, id);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  // Current parts catalog flow can fetch 17vin parts when cata parameters are provided.
  if (!forceRefresh && !wantsCatalog) {
    const cachedCars = await getVinCatalogCarsByVin(vin);
    if (cachedCars.length > 0) {
      const selectedCar =
        (requestedCarId ? cachedCars.find((c) => String(c.id) === requestedCarId) ?? null : null) ??
        (cachedCars.length === 1 ? cachedCars[0] : null);
      const requiresCarSelection = cachedCars.length > 1 && !selectedCar;
      // For parts lookup, fall back to first car when no specific car is selected
      const carForParts = selectedCar ?? (wantsParts && cachedCars.length > 0 ? cachedCars[0] : null);
      const cachedPartsSnapshot =
        wantsParts && carForParts
          ? await getVinCatalogSnapshotByVinAndCarId(vin, String(carForParts.id)).catch(() => null)
          : null;
      const cachedEpc = carForParts?.epc || selectedCar?.epc || cachedCars.find((c) => c.epc)?.epc || null;
      return NextResponse.json({
        data: {
          vin,
          epc: cachedEpc,
          cars: cachedCars,
          car: selectedCar,
          partsBrand: cachedPartsSnapshot?.partsBrand ?? null,
          parts: cachedPartsSnapshot?.parts ?? [],
          partsCount: cachedPartsSnapshot?.partsCount ?? 0,
          requiresCarSelection,
          partsCatalogPaused: !wantsParts,
          source: "global_erp",
          requestUrls: {
            vinDecodeUrl: null,
            partsUrl: null,
          },
        },
      });
    }
  }

  const vin17Config = await getVin17ConfigForCompany(companyId);
  try {
    if (wantsCatalog) {
      const resolvedEpc =
        epc ||
        String(
          (
            await decodeVinWith17VinUsingConfig(vin, vin17Config ?? undefined).catch(() => ({ raw: {} as any }))
          )?.raw?.data?.epc ?? ""
        ).trim();
      if (!resolvedEpc) {
        return NextResponse.json({ error: "epc is required for catalog action.", provider: "17vin" }, { status: 400 });
      }
      const catalogResult = await fetchVin17CatalogByActionUsingConfig(
        {
          vin,
          epc: resolvedEpc,
          action: catalogAction as "cata1" | "cata2" | "cata3" | "cata4",
          cata1Code,
          cata2Code,
          cata3Code,
        },
        vin17Config ?? undefined
      );
      return NextResponse.json({
        data: {
          vin,
          epc: resolvedEpc,
          catalogAction,
          catalogs: catalogResult.catalogs,
          count: catalogResult.catalogs.length,
          requestUrls: {
            catalogUrl: catalogResult.requestUrl,
          },
          source: "17vin",
        },
      });
    }

    const decoded = await decodeVinWith17VinUsingConfig(vin, vin17Config ?? undefined);
    const cars = decoded.cars;
    const resolvedEpcFromDecode = String((decoded.raw as any)?.data?.epc ?? (decoded.raw as any)?.epc ?? "").trim();
    if (cars.length > 0) {
      await upsertVinCatalogCars({
        vin,
        epc: epc || resolvedEpcFromDecode || undefined,
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
    // For parts fetch, fall back to first car when no specific car is selected (multi-variant VINs)
    const carForParts = selectedCar ?? (wantsParts && cars.length > 0 ? cars[0] : null);
    const resolvedEpc = epc || resolvedEpcFromDecode;
    let partsBrand: unknown = null;
    let parts: Vin17Part[] = [];
    let partsCount = 0;

    let partsUrl: string | null = null;
    if (wantsParts && carForParts) {
      if (!resolvedEpc) {
        return NextResponse.json(
          { error: "epc is required to fetch parts for this VIN.", provider: "17vin" },
          { status: 400 }
        );
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

      // Translate Chinese names where English is missing
      const needsTranslation = parts.filter((p) => !p.name && p.nameZh);
      if (needsTranslation.length > 0) {
        const aiClient = await getOpenAIClientForCompany(companyId).catch(() => ({ client: null }));
        if (aiClient.client) {
          try {
            const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
            const inputMap = Object.fromEntries(needsTranslation.map((p, i) => [String(i), p.nameZh]));
            const completion = await aiClient.client.chat.completions.create({
              model,
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content:
                    "You are an automotive parts translator. Translate Chinese automotive part names to concise English. Return a JSON object where each key matches the input key and the value is the English translation. Keep names short and technical.",
                },
                {
                  role: "user",
                  content: JSON.stringify(inputMap),
                },
              ],
            });
            const translations = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Record<string, string>;
            needsTranslation.forEach((p, i) => {
              const translated = String(translations[String(i)] ?? "").trim();
              if (translated) {
                p.name = translated;
                (p as any).nameTranslated = true;
              }
            });
          } catch {
            // translation failed — keep Chinese name as fallback
          }
        }
      }

      await upsertVinCatalogSnapshot({
        vin,
        car: {
          id: carForParts.id,
          make: carForParts.make,
          model: carForParts.model,
          year: carForParts.year,
          title: carForParts.title,
          description: carForParts.description,
        },
        parts,
        partsBrand,
      });
    }

    return NextResponse.json({
      data: {
        vin: decoded.vin,
        epc: resolvedEpc || null,
        cars,
        car: selectedCar,
        partsBrand,
        parts,
        partsCount,
        requiresCarSelection,
        partsCatalogPaused: !wantsParts,
        source: "17vin",
        requestUrls: {
          vinDecodeUrl: decoded.requestUrl,
          partsUrl,
        },
      },
    });
  } catch (err: any) {
    // Surface deterministic request-signature data to speed up integration testing.
    try {
      const prepared =
        wantsCatalog && epc
          ? prepareVin17CatalogRequest(
              {
                vin,
                epc,
                action: catalogAction as "cata1" | "cata2" | "cata3" | "cata4",
                cata1Code,
                cata2Code,
                cata3Code,
              },
              vin17Config ?? undefined
            )
          : prepareVin17Request(vin, vin17Config ?? undefined);
      return NextResponse.json(
        {
          error: wantsCatalog
            ? "Failed to fetch catalog with 17vin."
            : wantsParts
            ? "Failed to fetch VIN/parts with 17vin."
            : "Failed to decode VIN with 17vin.",
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
      try {
        if (wantsParts && epc && lastCataCode && lastCataCodeLevel) {
          const preparedParts = prepareVin17PartsRequest(
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
          );
          return NextResponse.json(
            {
              error: "Failed to fetch parts with 17vin.",
              details: String(err?.message ?? "upstream_error"),
              provider: "17vin",
              signaturePreview: {
                urlParameter: preparedParts.urlParameter,
                username: preparedParts.username,
                usernameHash: preparedParts.usernameHash,
                passwordHash: preparedParts.passwordHash,
                signature: preparedParts.signature,
                requestUrl: preparedParts.requestUrl,
              },
            },
            { status: 502 }
          );
        }
      } catch {
        // no-op
      }
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
