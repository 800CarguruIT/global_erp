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

export type Vin17PreparedPartsRequest = Vin17PreparedRequest & {
  epc: string;
  lastCataCode: string;
  lastCataCodeLevel: string;
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

export type Vin17PartGroup = {
  id: string;
  level: number;
  name: string;
};

export type Vin17Part = {
  code: string;
  name: string;
  groups: Vin17PartGroup[];
};

export type Vin17CatalogNode = {
  code: string;
  name: string;
  level: number;
  isLast: boolean;
  raw: Record<string, unknown>;
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

function resolveVin17Auth(cfg?: Vin17RequestConfig): {
  baseUrl: string;
  username: string;
  password: string;
  usernameParam: string;
  signatureParam: string;
} {
  const baseUrl = normalizeText(cfg?.baseUrl) || normalizeText(process.env.VIN17_BASE_URL);
  const username = normalizeText(cfg?.username) || normalizeText(process.env.VIN17_USERNAME);
  const password = normalizeText(cfg?.password) || normalizeText(process.env.VIN17_PASSWORD);
  const usernameParam = normalizeText(cfg?.usernameParam) || normalizeText(process.env.VIN17_USERNAME_PARAM) || "user";
  const signatureParam = normalizeText(cfg?.signatureParam) || normalizeText(process.env.VIN17_SIGNATURE_PARAM) || "token";

  if (!baseUrl) throw new Error("VIN17_BASE_URL is not configured.");
  if (!username) throw new Error("VIN17_USERNAME is not configured.");
  if (!password) throw new Error("VIN17_PASSWORD is not configured.");

  return { baseUrl, username, password, usernameParam, signatureParam };
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
  auth: { baseUrl: string; username: string; usernameParam: string; signatureParam: string },
  urlParameter: string,
  signature: string
): string {
  const normalizedBase = auth.baseUrl.replace(/\/+$/, "");
  const joined = `${normalizedBase}${urlParameter}`;
  const url = new URL(joined);
  url.searchParams.set(auth.usernameParam, auth.username);
  url.searchParams.set(auth.signatureParam, signature);
  return url.toString();
}

export function prepareVin17Request(vinInput: string, cfg?: Vin17RequestConfig): Vin17PreparedRequest {
  const vin = normalizeText(vinInput).toUpperCase();
  if (!vin) throw new Error("VIN is required.");

  const auth = resolveVin17Auth(cfg);

  const urlParameter = `/?vin=${vin}`;
  const usernameHash = md5Hex(auth.username);
  const passwordHash = md5Hex(auth.password);
  const signature = md5Hex(`${usernameHash}${passwordHash}${urlParameter}`);
  const requestUrl = buildRequestUrl(auth, urlParameter, signature);

  return {
    vin,
    urlParameter,
    username: auth.username,
    usernameHash,
    passwordHash,
    signature,
    requestUrl,
  };
}

export function prepareVin17PartsRequest(
  input: {
    vin: string;
    epc: string;
    lastCataCode: string;
    lastCataCodeLevel: string | number;
    isVinFilterOpen?: string | number;
    epcId?: string;
    jsId?: string;
  },
  cfg?: Vin17RequestConfig
): Vin17PreparedPartsRequest {
  const vin = normalizeText(input.vin).toUpperCase();
  const epc = normalizeText(input.epc).toLowerCase();
  const lastCataCode = normalizeText(input.lastCataCode);
  const lastCataCodeLevel = normalizeText(input.lastCataCodeLevel);
  const isVinFilterOpen = normalizeText(input.isVinFilterOpen || "1");
  const epcId = normalizeText(input.epcId);
  const jsId = normalizeText(input.jsId);

  if (!vin) throw new Error("VIN is required.");
  if (!epc) throw new Error("epc is required.");
  if (!lastCataCode) throw new Error("last_cata_code is required.");
  if (!lastCataCodeLevel) throw new Error("last_cata_code_level is required.");

  const auth = resolveVin17Auth(cfg);
  const query = new URLSearchParams();
  query.set("action", "part");
  query.set("vin", vin);
  query.set("last_cata_code", lastCataCode);
  query.set("last_cata_code_level", lastCataCodeLevel);
  query.set("is_vin_filter_open", isVinFilterOpen || "1");
  if (epcId) query.set("epc_id", epcId);
  if (jsId) query.set("js_id", jsId);

  const urlParameter = `/${epc}?${query.toString()}`;
  const usernameHash = md5Hex(auth.username);
  const passwordHash = md5Hex(auth.password);
  const signature = md5Hex(`${usernameHash}${passwordHash}${urlParameter}`);
  const requestUrl = buildRequestUrl(auth, urlParameter, signature);

  return {
    vin,
    epc,
    lastCataCode,
    lastCataCodeLevel,
    urlParameter,
    username: auth.username,
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

function pickPartList(payload: unknown): unknown[] {
  const root = pickRootObject(payload);
  const candidates = [
    root.list,
    (root as any).parts,
    (root as any).part_list,
    (root as any).partList,
    (payload as any)?.list,
    (payload as any)?.parts,
    (payload as any)?.data?.list,
    (payload as any)?.data?.parts,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as unknown[];
  }
  return [];
}

function toPartGroup(row: Record<string, unknown>, index: number): Vin17PartGroup {
  const id = readFirstString(row, ["group_id", "groupId", "id"]) || `group-${index + 1}`;
  const level = Number(readFirstString(row, ["group_level", "groupLevel", "level"]) || "1") || 1;
  const name = readFirstString(row, ["group_name", "groupName", "name"]) || "Other";
  return { id, level, name };
}

function toPartFrom17Vin(item: Record<string, unknown>, index: number): Vin17Part | null {
  const code = readFirstString(item, ["code", "part_number", "part_no", "partNo", "oe", "oe_no"]);
  const name = readFirstString(item, ["name", "part_name", "partName", "description"]);
  const groupsRaw = Array.isArray(item.groups)
    ? (item.groups as unknown[])
    : Array.isArray((item as any).group_list)
    ? ((item as any).group_list as unknown[])
    : Array.isArray((item as any).group)
    ? ((item as any).group as unknown[])
    : [];
  const groups = groupsRaw
    .map((g, idx) => (g && typeof g === "object" ? toPartGroup(g as Record<string, unknown>, idx) : null))
    .filter(Boolean) as Vin17PartGroup[];

  if (!code && !name) return null;
  return {
    code: code || `unknown-${index + 1}`,
    name,
    groups,
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

export async function fetchVin17PartsUsingConfig(
  input: {
    vin: string;
    epc: string;
    lastCataCode: string;
    lastCataCodeLevel: string | number;
    isVinFilterOpen?: string | number;
    epcId?: string;
    jsId?: string;
  },
  cfg?: Vin17RequestConfig
): Promise<{
  vin: string;
  requestUrl: string;
  raw: unknown;
  parts: Vin17Part[];
  partsCount: number;
  partsBrand: unknown;
}> {
  const prepared = prepareVin17PartsRequest(input, cfg);
  const res = await fetch(prepared.requestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`17vin parts request failed (${res.status}).`);
  }
  const payload = await res.json().catch(() => ({}));
  const rows = pickPartList(payload);
  const parts = rows
    .map((row, idx) =>
      row && typeof row === "object" ? toPartFrom17Vin(row as Record<string, unknown>, idx) : null
    )
    .filter(Boolean) as Vin17Part[];
  const root = pickRootObject(payload);
  const partsBrand = (root as any).partsBrand ?? (payload as any)?.partsBrand ?? (root as any).brand ?? null;
  return {
    vin: prepared.vin,
    requestUrl: prepared.requestUrl,
    raw: payload,
    parts,
    partsCount: parts.length,
    partsBrand,
  };
}

export function prepareVin17CatalogRequest(
  input: {
    vin: string;
    epc: string;
    action: "cata1" | "cata2" | "cata3" | "cata4";
    cata1Code?: string;
    cata2Code?: string;
    cata3Code?: string;
  },
  cfg?: Vin17RequestConfig
): Vin17PreparedRequest {
  const vin = normalizeText(input.vin).toUpperCase();
  const epc = normalizeText(input.epc).toLowerCase();
  const action = normalizeText(input.action).toLowerCase();
  if (!vin) throw new Error("VIN is required.");
  if (!epc) throw new Error("epc is required.");
  if (!["cata1", "cata2", "cata3", "cata4"].includes(action)) throw new Error("Unsupported catalog action.");

  const auth = resolveVin17Auth(cfg);
  const query = new URLSearchParams();
  query.set("action", action);
  query.set("vin", vin);
  const cata1Code = normalizeText(input.cata1Code);
  const cata2Code = normalizeText(input.cata2Code);
  const cata3Code = normalizeText(input.cata3Code);
  if (action !== "cata1" && !cata1Code) throw new Error("cata1_code is required for this action.");
  if (action === "cata3" && !cata2Code) throw new Error("cata2_code is required for cata3.");
  if (action === "cata4" && !cata3Code) throw new Error("cata3_code is required for cata4.");
  if (cata1Code) query.set("cata1_code", cata1Code);
  if (cata2Code) query.set("cata2_code", cata2Code);
  if (cata3Code) query.set("cata3_code", cata3Code);

  const urlParameter = `/${epc}?${query.toString()}`;
  const usernameHash = md5Hex(auth.username);
  const passwordHash = md5Hex(auth.password);
  const signature = md5Hex(`${usernameHash}${passwordHash}${urlParameter}`);
  const requestUrl = buildRequestUrl(auth, urlParameter, signature);
  return {
    vin,
    urlParameter,
    username: auth.username,
    usernameHash,
    passwordHash,
    signature,
    requestUrl,
  };
}

function pickCatalogList(payload: unknown): unknown[] {
  const root = pickRootObject(payload);
  const candidates = [
    (root as any).catalist,
    root.list,
    (root as any).cata_list,
    (root as any).catalogs,
    (payload as any)?.catalist,
    (payload as any)?.list,
    (payload as any)?.data?.list,
    (payload as any)?.data?.catalist,
    (payload as any)?.data?.cata_list,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as unknown[];
  }
  return [];
}

function toCatalogNode(item: Record<string, unknown>, fallbackLevel: number): Vin17CatalogNode | null {
  const code = readFirstString(item, ["cata_code", "code", "id"]);
  const name = readFirstString(item, ["name_en", "name_zh", "cata_name", "name", "title"]);
  const levelRaw = readFirstString(item, ["cata_level", "cata_code_level", "level"]);
  const level = Number(levelRaw || fallbackLevel) || fallbackLevel;
  const isLastRaw = readFirstString(item, ["is_last", "isLast"]);
  const isLast = ["1", "true", "yes", "y"].includes(String(isLastRaw).trim().toLowerCase());
  if (!code && !name) return null;
  return { code, name, level, isLast, raw: item };
}

export async function fetchVin17CatalogByActionUsingConfig(
  input: {
    vin: string;
    epc: string;
    action: "cata1" | "cata2" | "cata3" | "cata4";
    cata1Code?: string;
    cata2Code?: string;
    cata3Code?: string;
  },
  cfg?: Vin17RequestConfig
): Promise<{
  vin: string;
  requestUrl: string;
  raw: unknown;
  catalogs: Vin17CatalogNode[];
}> {
  const prepared = prepareVin17CatalogRequest(input, cfg);
  const res = await fetch(prepared.requestUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`17vin catalog request failed (${res.status}).`);
  }
  const payload = await res.json().catch(() => ({}));
  const rows = pickCatalogList(payload);
  const levelFallback = Number(String(input.action).replace("cata", "")) || 1;
  const catalogs = rows
    .map((row) => (row && typeof row === "object" ? toCatalogNode(row as Record<string, unknown>, levelFallback) : null))
    .filter(Boolean) as Vin17CatalogNode[];
  return {
    vin: prepared.vin,
    requestUrl: prepared.requestUrl,
    raw: payload,
    catalogs,
  };
}
