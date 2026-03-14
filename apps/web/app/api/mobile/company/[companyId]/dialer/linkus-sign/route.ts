import { NextRequest } from "next/server";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import { z } from "zod";
import { getSql } from "@repo/ai-core";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

export const runtime = "nodejs";

type Params = { params: Promise<{ companyId: string }> };
type TokenMode = "client" | "access_userpass" | "userpass";

type JsonResult = {
  ok: boolean;
  status: number;
  json: Record<string, any>;
  rawBody: string;
  error?: string;
};

const yeastarAccessTokenCache = new Map<string, { token: string; expiresAtMs: number }>();
const yeastarSignCache = new Map<string, { sign: string; expiresAtMs: number }>();

const bodySchema = z.object({
  extension: z.string().optional().nullable(),
});

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const v = String(value ?? "").trim();
    if (v) return v;
  }
  return "";
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function normalizedBaseUrl(apiBaseUrl: unknown, apiPath?: unknown, serverUrl?: unknown): string {
  const baseRaw = String(apiBaseUrl ?? "").trim();
  const pathRaw = String(apiPath ?? "").trim();
  const serverRaw = String(serverUrl ?? "").trim();
  const pick = baseRaw || pathRaw || serverRaw;
  if (!pick) return "";
  let normalized = pick;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  normalized = normalized.replace(/\/+$/, "");
  normalized = normalized.replace(/\/openapi\/v1\.0$/i, "");
  normalized = normalized.replace(/\/api\/v1\.0$/i, "");
  return `${normalized}/openapi/v1.0`;
}

function apiBaseToServerUrl(base: string): string {
  return String(base ?? "").replace(/\/openapi\/v1\.0$/i, "");
}

async function requestJson(args: {
  url: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown> | null;
  headers?: Record<string, string>;
  sslVerify?: boolean;
  timeoutMs?: number;
}): Promise<JsonResult> {
  const method = args.method ?? "GET";
  const bodyText = args.body ? JSON.stringify(args.body) : "";
  const target = new URL(args.url);
  const isHttps = target.protocol === "https:";
  const lib = isHttps ? https : http;

  return await new Promise((resolve) => {
    const req = lib.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (isHttps ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method,
        timeout: args.timeoutMs ?? 8000,
        headers: {
          "Content-Type": "application/json",
          ...(bodyText ? { "Content-Length": String(Buffer.byteLength(bodyText)) } : {}),
          ...(args.headers ?? {}),
        },
        ...(isHttps ? { rejectUnauthorized: args.sslVerify !== false } : {}),
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk?.toString?.() ?? "";
        });
        res.on("end", () => {
          let json: Record<string, any> = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            json = {};
          }
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            json,
            rawBody: raw,
          });
        });
      },
    );

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: any) => {
      resolve({
        ok: false,
        status: 0,
        json: {},
        rawBody: "",
        error: err?.message ?? "request failed",
      });
    });

    if (bodyText) req.write(bodyText);
    req.end();
  });
}

async function getYeastarCredentialsForCompany(
  companyId: string,
): Promise<Record<string, any> | null> {
  const sql = getSql();
  const rows = await sql<
    { credentials: Record<string, unknown> | null; company_id: string | null }[]
  >`
    SELECT credentials, company_id
    FROM integration_dialers
    WHERE provider = 'yeastar'
      AND is_active = TRUE
      AND (company_id = ${companyId} OR company_id IS NULL)
    ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 5
  `;
  const candidates = ((rows as any).rows ?? rows) as Array<{
    credentials: Record<string, unknown> | null;
  }>;
  for (const row of candidates) {
    if (row.credentials && typeof row.credentials === "object") {
      return row.credentials as Record<string, any>;
    }
  }
  return null;
}

async function getYeastarAccessToken(
  credentials: Record<string, any>,
  preferredMode: TokenMode | "auto" = "auto",
): Promise<{ token: string | null; mode?: TokenMode; reason?: string }> {
  const base = normalizedBaseUrl(
    credentials.apiBaseUrl ??
      credentials.baseUrl ??
      credentials.pbxURL ??
      credentials.serverUrl ??
      credentials.linkusServerUrl,
    credentials.apiPath,
    credentials.serverUrl ?? credentials.pbxURL ?? credentials.linkusServerUrl,
  );
  if (!base) return { token: null, reason: "missing_api_base" };

  const accessId = pickString(
    credentials.accessId,
    credentials.access_id,
    credentials.linkusAccessId,
    credentials.linkus_access_id,
  );
  const accessKey = pickString(
    credentials.accessKey,
    credentials.access_key,
    credentials.linkusAccessKey,
    credentials.linkus_access_key,
  );
  const username = pickString(
    credentials.username,
    credentials.userName,
    credentials.apiUsername,
    credentials.api_user_name,
    credentials.api_user,
  );
  const password = pickString(
    credentials.password,
    credentials.passWord,
    credentials.apiPassword,
    credentials.api_password,
    credentials.api_pass,
  );
  const clientId = pickString(credentials.clientId, credentials.client_id, accessId);
  const clientSecret = pickString(credentials.clientSecret, credentials.client_secret, accessKey);
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);

  const candidates: Array<{
    mode: TokenMode;
    cacheKey: string;
    payload: Record<string, string>;
  }> = [];
  if (clientId && clientSecret) {
    candidates.push({
      mode: "client",
      cacheKey: `${base}|${userAgent}|client|${clientId}`,
      payload: { user_agent: userAgent, client_id: clientId, client_secret: clientSecret },
    });
  }
  if (accessId && accessKey) {
    candidates.push({
      mode: "access_userpass",
      cacheKey: `${base}|${userAgent}|access_userpass|${accessId}`,
      payload: { user_agent: userAgent, username: accessId, password: accessKey },
    });
  }
  if (username && password) {
    candidates.push({
      mode: "userpass",
      cacheKey: `${base}|${userAgent}|userpass|${username}`,
      payload: { user_agent: userAgent, username, password },
    });
  }
  if (!candidates.length) return { token: null, reason: "missing_credentials" };

  const ordered =
    preferredMode === "auto"
      ? candidates
      : candidates.filter((c) => c.mode === preferredMode).concat(candidates.filter((c) => c.mode !== preferredMode));

  const failures: string[] = [];
  for (const candidate of ordered) {
    const cachedToken = yeastarAccessTokenCache.get(candidate.cacheKey);
    if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
      return { token: cachedToken.token, mode: candidate.mode };
    }
    const tokenRes = await requestJson({
      url: `${base}/get_token`,
      method: "POST",
      body: candidate.payload,
      sslVerify,
      headers: { "User-Agent": userAgent },
    });
    const token = String(tokenRes.json?.access_token ?? tokenRes.json?.data?.access_token ?? "").trim();
    const errcode = Number(tokenRes.json?.errcode ?? -1);
    if (tokenRes.ok && errcode === 0 && token) {
      const expiresInSec = Number(tokenRes.json?.expires_in ?? tokenRes.json?.data?.expires_in ?? 1800);
      const ttlMs = Number.isFinite(expiresInSec) ? Math.max(120, expiresInSec) * 1000 : 1800_000;
      yeastarAccessTokenCache.set(candidate.cacheKey, { token, expiresAtMs: Date.now() + ttlMs });
      return { token, mode: candidate.mode };
    }
    failures.push(`${candidate.mode}:${String(tokenRes.json?.errmsg ?? tokenRes.error ?? `http_${tokenRes.status}`)}`);
  }

  return { token: null, reason: failures.join(" | ") || "token_failed" };
}

async function createYeastarSdkSign(args: {
  base: string;
  token: string;
  extension: string;
  sslVerify: boolean;
  userAgent: string;
}): Promise<JsonResult> {
  return requestJson({
    url: `${args.base}/sign/create?access_token=${encodeURIComponent(args.token)}`,
    method: "POST",
    body: {
      username: args.extension,
      sign_type: "sdk",
      expire_time: 0,
    },
    sslVerify: args.sslVerify,
    headers: { "User-Agent": args.userAgent },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return createMobileErrorResponse("Invalid payload", 400, {
        details: parsed.error.format(),
      });
    }

    const credentials = await getYeastarCredentialsForCompany(companyId);
    if (!credentials) {
      return createMobileErrorResponse("No active Yeastar integration credentials", 404);
    }

    const extension = pickString(
      parsed.data.extension,
      credentials.linkusDefaultExtension,
      credentials.defaultExtension,
      credentials.sdkExtension,
      credentials.extension,
    );
    if (!extension) {
      return createMobileErrorResponse("Extension is required", 400);
    }

    const base = normalizedBaseUrl(
      credentials.apiBaseUrl ??
        credentials.baseUrl ??
        credentials.pbxURL ??
        credentials.serverUrl ??
        credentials.linkusServerUrl,
      credentials.apiPath,
      credentials.serverUrl ?? credentials.pbxURL ?? credentials.linkusServerUrl,
    );
    if (!base) {
      return createMobileErrorResponse("Missing Yeastar API base URL", 400);
    }

    const signCacheKey = `${companyId}|${base}|${extension}`;
    const cachedSign = yeastarSignCache.get(signCacheKey);
    if (cachedSign && cachedSign.expiresAtMs > Date.now() + 60_000) {
      return createMobileSuccessResponse({
        sign: cachedSign.sign,
        extension,
        serverUrl: apiBaseToServerUrl(base),
        generatedAt: new Date().toISOString(),
        cached: true,
      });
    }

    let tokenResult = await getYeastarAccessToken(credentials, "auto");
    if (!tokenResult.token) {
      return createMobileErrorResponse("Failed to get Yeastar access token", 502, {
        reason: tokenResult.reason ?? "token_failed",
      });
    }

    const sslVerify = toBool(credentials.sslVerify, true);
    const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
    let signRes = await createYeastarSdkSign({
      base,
      token: tokenResult.token,
      extension,
      sslVerify,
      userAgent,
    });

    let errcode = Number(signRes.json?.errcode ?? -1);
    let sign = String(signRes.json?.sign ?? signRes.json?.data?.sign ?? "").trim();
    if ((!signRes.ok || errcode !== 0 || !sign) && errcode === 10005) {
      const fallbackModes = (["access_userpass", "client", "userpass"] as TokenMode[]).filter(
        (mode) => mode !== tokenResult.mode,
      );
      for (const mode of fallbackModes) {
        const fallbackTokenResult = await getYeastarAccessToken(credentials, mode);
        if (!fallbackTokenResult.token) continue;
        tokenResult = fallbackTokenResult;
        signRes = await createYeastarSdkSign({
          base,
          token: fallbackTokenResult.token,
          extension,
          sslVerify,
          userAgent,
        });
        errcode = Number(signRes.json?.errcode ?? -1);
        sign = String(signRes.json?.sign ?? signRes.json?.data?.sign ?? "").trim();
        if (signRes.ok && errcode === 0 && sign) break;
      }
    }

    if (!signRes.ok || errcode !== 0 || !sign) {
      return createMobileErrorResponse("Failed to create Yeastar SDK sign", 502, {
        errcode,
        errmsg: String(signRes.json?.errmsg ?? signRes.error ?? `http_${signRes.status}`),
      });
    }

    yeastarSignCache.set(signCacheKey, {
      sign,
      expiresAtMs: Date.now() + 25 * 60 * 1000,
    });

    return createMobileSuccessResponse({
      sign,
      extension,
      serverUrl: apiBaseToServerUrl(base),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/dialer/linkus-sign error:",
      error,
    );
    return handleMobileError(error);
  }
}

