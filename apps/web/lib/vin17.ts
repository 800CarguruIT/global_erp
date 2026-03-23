import crypto from "node:crypto";

export type Vin17PreparedRequest = {
  vin: string;
  urlParameter: string;
  username: string;
  usernameHash: string;
  passwordHash: string;
  signature: string;
  requestUrl: string;
};

export type Vin17RequestConfig = {
  baseUrl?: string;
  username?: string;
  password?: string;
  usernameParam?: string;
  signatureParam?: string;
};

export type Vin17DecodedCar = {
  id: string;
  make: string;
  model: string;
  year: string;
  title: string;
  description: string;
};

function md5Hex(value: string): string {
  return crypto.createHash("md5").update(value, "utf8").digest("hex");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeYear(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) return "";
  const match = raw.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : raw;
}

function readFirstString(source: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!source) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function buildRequestUrl(
  baseUrl: string,
  urlParameter: string,
  username: string,
  signature: string,
  cfg?: Vin17RequestConfig
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const joined = `${normalizedBase}${urlParameter}`;
  const url = new URL(joined);
  const usernameParam = normalizeText(cfg?.usernameParam) || normalizeText(process.env.VIN17_USERNAME_PARAM) || "user";
  const signatureParam = normalizeText(cfg?.signatureParam) || normalizeText(process.env.VIN17_SIGNATURE_PARAM) || "token";
  url.searchParams.set(usernameParam, username);
  url.searchParams.set(signatureParam, signature);
  return url.toString();
}

export function prepareVin17Request(vinInput: string, cfg?: Vin17RequestConfig): Vin17PreparedRequest {
  const vin = normalizeText(vinInput).toUpperCase();
  if (!vin) throw new Error("VIN is required.");

  const baseUrl = normalizeText(cfg?.baseUrl) || normalizeText(process.env.VIN17_BASE_URL);
  const username = normalizeText(cfg?.username) || normalizeText(process.env.VIN17_USERNAME);
  const password = normalizeText(cfg?.password) || normalizeText(process.env.VIN17_PASSWORD);

  if (!baseUrl) throw new Error("VIN17_BASE_URL is not configured.");
  if (!username) throw new Error("VIN17_USERNAME is not configured.");
  if (!password) throw new Error("VIN17_PASSWORD is not configured.");

  const urlParameter = `/?vin=${vin}`;
  const usernameHash = md5Hex(username);
  const passwordHash = md5Hex(password);
  const signature = md5Hex(`${usernameHash}${passwordHash}${urlParameter}`);
  const requestUrl = buildRequestUrl(baseUrl, urlParameter, username, signature, cfg);

  return {
    vin,
    urlParameter,
    username,
    usernameHash,
    passwordHash,
    signature,
    requestUrl,
  };
}

function pickRootObject(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidates = [obj.data, obj.result, obj.vehicle, obj.vinData, obj.decode];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        return candidate as Record<string, unknown>;
      }
    }
    return obj;
  }
  return {};
}

function buildCarFromPayload(vin: string, payload: unknown): Vin17DecodedCar | null {
  const root = pickRootObject(payload);
  const make = readFirstString(root, ["make", "brand", "manufacturer", "car_make"]);
  const model = readFirstString(root, ["model", "car_model", "series", "trim"]);
  const year = normalizeYear(readFirstString(root, ["year", "model_year", "car_year"]));
  const title = readFirstString(root, ["title", "name", "vehicle_name"]);
  const description = readFirstString(root, ["description", "desc", "details"]);

  if (!make && !model && !year && !title) {
    return null;
  }

  return {
    id: vin,
    make,
    model,
    year,
    title: title || [year, make, model].filter(Boolean).join(" ").trim(),
    description,
  };
}

function toCarFromModelListItem(vin: string, item: Record<string, unknown>): Vin17DecodedCar | null {
  const id = readFirstString(item, ["Id", "id", "Js_id", "Model_detail_key"]) || vin;
  const make = readFirstString(item, ["Brand_en", "Brand", "Factory_en", "Factory"]);
  const model = readFirstString(item, ["Model_en", "Model", "Series_en", "Series"]);
  const year = normalizeYear(readFirstString(item, ["Model_year", "Year", "Date_begin"]));
  const title = readFirstString(item, ["Model_detail_en", "Model_detail", "Sales_name_en", "Sales_name"]);
  const description = [
    readFirstString(item, ["Factory_en", "Factory"]),
    readFirstString(item, ["Cc_en", "Cc"]),
    readFirstString(item, ["Transmission_detail_en", "Transmission_detail"]),
    readFirstString(item, ["Driving_mode_en", "Driving_mode"]),
  ]
    .filter(Boolean)
    .join(" | ");

  if (!title && !make && !model && !year) return null;
  return {
    id,
    make,
    model,
    year,
    title: title || [year, make, model].filter(Boolean).join(" ").trim(),
    description,
  };
}

export async function decodeVinWith17Vin(vinInput: string): Promise<{
  vin: string;
  requestUrl: string;
  raw: unknown;
  cars: Vin17DecodedCar[];
  car: Vin17DecodedCar | null;
}> {
  const prepared = prepareVin17Request(vinInput);
  const res = await fetch(prepared.requestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`17vin request failed (${res.status}).`);
  }

  const payload = await res.json().catch(() => ({}));
  const root = pickRootObject(payload);
  const modelListRaw = Array.isArray(root.model_list) ? (root.model_list as unknown[]) : [];
  const carsFromList = modelListRaw
    .map((row) =>
      row && typeof row === "object" ? toCarFromModelListItem(prepared.vin, row as Record<string, unknown>) : null
    )
    .filter(Boolean) as Vin17DecodedCar[];
  const fallbackCar = buildCarFromPayload(prepared.vin, payload);
  const cars = carsFromList.length > 0 ? carsFromList : fallbackCar ? [fallbackCar] : [];
  const car = cars[0] ?? null;

  return {
    vin: prepared.vin,
    requestUrl: prepared.requestUrl,
    raw: payload,
    cars,
    car,
  };
}

export async function decodeVinWith17VinUsingConfig(vinInput: string, cfg?: Vin17RequestConfig): Promise<{
  vin: string;
  requestUrl: string;
  raw: unknown;
  cars: Vin17DecodedCar[];
  car: Vin17DecodedCar | null;
}> {
  const prepared = prepareVin17Request(vinInput, cfg);
  const res = await fetch(prepared.requestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`17vin request failed (${res.status}).`);
  }
  const payload = await res.json().catch(() => ({}));
  const root = pickRootObject(payload);
  const modelListRaw = Array.isArray(root.model_list) ? (root.model_list as unknown[]) : [];
  const carsFromList = modelListRaw
    .map((row) =>
      row && typeof row === "object" ? toCarFromModelListItem(prepared.vin, row as Record<string, unknown>) : null
    )
    .filter(Boolean) as Vin17DecodedCar[];
  const fallbackCar = buildCarFromPayload(prepared.vin, payload);
  const cars = carsFromList.length > 0 ? carsFromList : fallbackCar ? [fallbackCar] : [];
  const car = cars[0] ?? null;
  return {
    vin: prepared.vin,
    requestUrl: prepared.requestUrl,
    raw: payload,
    cars,
    car,
  };
}
