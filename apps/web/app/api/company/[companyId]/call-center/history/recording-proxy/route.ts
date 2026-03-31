import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";
import * as http from "node:http";
import * as https from "node:https";

type ParamsCtx = { params: Promise<{ companyId: string }> };
const yeastarTokenCache = (() => {
  const key = "__GLOBAL_ERP_YEASTAR_TOKEN_CACHE__";
  const g = globalThis as any;
  if (!g[key]) g[key] = new Map<string, { token: string; expiresAtMs: number }>();
  return g[key] as Map<string, { token: string; expiresAtMs: number }>;
})();
const YEASTAR_TOKEN_REFRESH_BUFFER_MS = 60_000;

function safeUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function toBool(value: unknown, defaultValue = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return defaultValue;
}

function buildAllowedOrigin(raw: unknown): string | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const url = safeUrl(str);
  return url ? url.origin : null;
}

function normalizedBaseUrl(rawBaseUrl?: string, rawPath?: string): string | null {
  const baseUrl = (rawBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  const apiPath = (rawPath ?? "openapi/v1.0").trim().replace(/^\/+|\/+$/g, "");
  return apiPath ? `${baseUrl}/${apiPath}` : baseUrl;
}

function getYeastarTokenCacheKey(base: string, mode: string, identifier: string): string {
  return `${base}|${mode}|${identifier.trim().toLowerCase()}`;
}

async function fetchBinary(params: {
  target: URL;
  sslVerify: boolean;
  range?: string | null;
  headers?: Record<string, string>;
}): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = params.target.protocol === "https:";
    const client = isHttps ? https : http;
    const req = client.request(
      {
        protocol: params.target.protocol,
        hostname: params.target.hostname,
        port: params.target.port ? Number(params.target.port) : isHttps ? 443 : 80,
        path: `${params.target.pathname}${params.target.search}`,
        method: "GET",
        headers: {
          ...(params.range ? { Range: params.range } : {}),
          ...(params.headers ?? {}),
        },
        ...(isHttps ? { rejectUnauthorized: params.sslVerify } : {}),
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (!v) continue;
            headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
          }
          resolve({
            status: res.statusCode ?? 502,
            headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("upstream timeout")));
    req.end();
  });
}

async function requestJson(params: {
  url: string;
  method: "GET" | "POST";
  sslVerify: boolean;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; json: any; error?: string }> {
  return new Promise((resolve) => {
    const target = new URL(params.url);
    const isHttps = target.protocol === "https:";
    const client = isHttps ? https : http;
    const bodyText = params.body ? JSON.stringify(params.body) : "";

    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port ? Number(target.port) : isHttps ? 443 : 80,
        path: `${target.pathname}${target.search}`,
        method: params.method,
        headers: {
          Accept: "application/json",
          ...(bodyText
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(bodyText),
              }
            : {}),
          ...(params.headers ?? {}),
        },
        ...(isHttps ? { rejectUnauthorized: params.sslVerify } : {}),
        timeout: params.timeoutMs ?? 6000,
      },
      (res) => {
        let responseText = "";
        res.on("data", (chunk) => {
          responseText += chunk.toString();
        });
        res.on("end", () => {
          let parsed: any = {};
          try {
            parsed = responseText ? JSON.parse(responseText) : {};
          } catch {
            parsed = {};
          }
          const status = res.statusCode ?? 500;
          resolve({ ok: status >= 200 && status < 300, status, json: parsed });
        });
      }
    );

    req.on("error", (err: any) => {
      resolve({ ok: false, status: 0, json: {}, error: err?.message ?? "request failed" });
    });
    if (bodyText) req.write(bodyText);
    req.end();
  });
}

async function getYeastarTokenForPlayback(credentials: Record<string, any>): Promise<string | null> {
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return null;
  const sslVerify = toBool(credentials.sslVerify, true);
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const accessId = String(credentials.accessId ?? credentials.linkusAccessId ?? "").trim();
  const accessKey = String(credentials.accessKey ?? credentials.linkusAccessKey ?? "").trim();
  const clientId = String(credentials.clientId ?? credentials.client_id ?? "").trim();
  const clientSecret = String(credentials.clientSecret ?? credentials.client_secret ?? "").trim();
  const candidates = [
    {
      mode: "userpass",
      identifier: String(credentials.username ?? credentials.apiUsername ?? "").trim(),
      payload: {
        user_agent: userAgent,
        username: String(credentials.username ?? credentials.apiUsername ?? "").trim(),
        password: String(credentials.password ?? credentials.apiPassword ?? "").trim(),
      },
    },
    ...(clientId && clientSecret
      ? [
          {
            mode: "client",
            identifier: clientId,
            payload: {
              user_agent: userAgent,
              client_id: clientId,
              client_secret: clientSecret,
            },
          },
        ]
      : []),
    {
      mode: "access_userpass",
      identifier: String(credentials.accessId ?? credentials.linkusAccessId ?? "").trim(),
      payload: {
        user_agent: userAgent,
        username: String(credentials.accessId ?? credentials.linkusAccessId ?? "").trim(),
        password: String(credentials.accessKey ?? credentials.linkusAccessKey ?? "").trim(),
      },
    },
  ].filter((c) => {
    if (!c.identifier) return false;
    if (c.mode === "client") return !!(c.payload as any).client_id && !!(c.payload as any).client_secret;
    return !!(c.payload as any).username && !!(c.payload as any).password;
  });

  const now = Date.now();
  for (const candidate of candidates) {
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, candidate.identifier);
    const cached = yeastarTokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > now + YEASTAR_TOKEN_REFRESH_BUFFER_MS) {
      return cached.token;
    }
  }

  for (const candidate of candidates) {
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, candidate.identifier);
    const tokenRes = await requestJson({
      url: `${base}/get_token`,
      method: "POST",
      sslVerify,
      headers: { "User-Agent": userAgent, "Content-Type": "application/json" },
      body: candidate.payload,
      timeoutMs: 5000,
    });
    const token = String(tokenRes.json?.access_token ?? "").trim();
    const errcode = Number(tokenRes.json?.errcode ?? -1);
    if (tokenRes.ok && errcode === 0 && token) {
      const ttlSec = Number(tokenRes.json?.access_token_expire_time ?? 1800);
      yeastarTokenCache.set(cacheKey, {
        token,
        expiresAtMs: Date.now() + (Number.isFinite(ttlSec) && ttlSec > 0 ? ttlSec * 1000 : 1800 * 1000),
      });
      return token;
    }
  }
  return null;
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { companyId } = await ctx.params;
    const reqUrl = new URL(req.url);
    const recordingUrl = String(reqUrl.searchParams.get("recordingUrl") ?? "").trim();
    const recordingFile = String(reqUrl.searchParams.get("recordingFile") ?? "").trim();
    let target = safeUrl(recordingUrl);

    const sql = getSql();
    const integrations = await sql<
      { credentials: Record<string, unknown> | null; company_id: string | null }[]
    >`
      SELECT credentials, company_id
      FROM integration_dialers
      WHERE provider = 'yeastar'
        AND is_active = TRUE
        AND (company_id = ${companyId} OR company_id IS NULL)
      ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
      LIMIT 10
    `;
    const rows = ((integrations as any).rows ?? integrations) as Array<{
      credentials: Record<string, unknown> | null;
      company_id: string | null;
    }>;
    if (!rows.length) return NextResponse.json({ error: "No active Yeastar integration found" }, { status: 404 });

    const allowed = new Map<string, boolean>();
    for (const row of rows) {
      const credentials = row.credentials && typeof row.credentials === "object" ? row.credentials : {};
      const originCandidates = [
        buildAllowedOrigin((credentials as any).apiBaseUrl),
        buildAllowedOrigin((credentials as any).linkusServerUrl),
      ].filter(Boolean) as string[];
      const sslVerify = toBool((credentials as any).sslVerify, true);
      for (const origin of originCandidates) {
        if (!allowed.has(origin)) allowed.set(origin, sslVerify);
      }
    }

    // Support filename-only records by mapping to allowed PBX origin + /files/<file>.
    if (!target) {
      const file = recordingFile || recordingUrl;
      if (!file) return NextResponse.json({ error: "Invalid recordingUrl" }, { status: 400 });
      const firstAllowedOrigin = Array.from(allowed.keys())[0] ?? "";
      if (!firstAllowedOrigin) {
        return NextResponse.json({ error: "No allowed PBX origin configured" }, { status: 500 });
      }
      target = safeUrl(`${firstAllowedOrigin}/files/${encodeURIComponent(file)}`);
      if (!target) return NextResponse.json({ error: "Invalid recording file" }, { status: 400 });
    }

    if (!allowed.has(target.origin)) {
      return NextResponse.json({ error: "Recording URL origin not allowed" }, { status: 403 });
    }

    const sslVerify = allowed.get(target.origin) ?? true;
    let upstream;
    const fileName = decodeURIComponent(target.pathname.split("/").pop() ?? "");
    const matchedCreds =
      rows.find((row) => {
        const credentials = row.credentials && typeof row.credentials === "object" ? row.credentials : {};
        const apiOrigin = buildAllowedOrigin((credentials as any).apiBaseUrl);
        const linkusOrigin = buildAllowedOrigin((credentials as any).linkusServerUrl);
        return apiOrigin === target.origin || linkusOrigin === target.origin;
      })?.credentials ?? null;

    if (fileName.toLowerCase().endsWith(".wav") && matchedCreds) {
      const creds = matchedCreds as Record<string, any>;
      const apiBase = normalizedBaseUrl(creds.apiBaseUrl, creds.apiPath);
      const token = await getYeastarTokenForPlayback(creds);
      if (!apiBase || !token) {
        return NextResponse.json(
          { error: "Failed to get Yeastar token for playback" },
          { status: 502 }
        );
      }
      const downloadUrl = `${apiBase}/recording/download?access_token=${encodeURIComponent(
        token
      )}&file=${encodeURIComponent(fileName)}`;
      upstream = await fetchBinary({
        target: new URL(downloadUrl),
        sslVerify: toBool(creds.sslVerify, true),
        range: req.headers.get("range"),
        headers: {
          Authorization: token,
          "User-Agent": String(creds.userAgent ?? "OpenAPI"),
        },
      });

      // Some Yeastar versions return JSON envelope with download_resource_url first.
      const contentType = String(upstream.headers["content-type"] ?? "").toLowerCase();
      if (contentType.includes("application/json")) {
        let parsed: any = {};
        try {
          parsed = JSON.parse(upstream.body.toString("utf8"));
        } catch {
          parsed = {};
        }
        const errcode = Number(parsed?.errcode ?? -1);
        const resourceUrlRaw = String(parsed?.download_resource_url ?? "").trim();
        if (errcode === 0 && resourceUrlRaw) {
          const resourceUrl = resourceUrlRaw.startsWith("http")
            ? new URL(resourceUrlRaw)
            : new URL(resourceUrlRaw, target.origin);
          if (!resourceUrl.searchParams.has("access_token")) {
            resourceUrl.searchParams.set("access_token", token);
          }
          upstream = await fetchBinary({
            target: resourceUrl,
            sslVerify: toBool(creds.sslVerify, true),
            range: req.headers.get("range"),
            headers: {
              Authorization: token,
              "User-Agent": String(creds.userAgent ?? "OpenAPI"),
            },
          });
        }
      }
    } else {
      upstream = await fetchBinary({
        target,
        sslVerify,
        range: req.headers.get("range"),
      });
    }

    if (upstream.status >= 400) {
      return NextResponse.json(
        {
          error: "Upstream recording fetch failed",
          upstreamStatus: upstream.status,
          target: `${target.origin}${target.pathname}`,
          bodyPreview: upstream.body.toString("utf8").slice(0, 500),
        },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    const passthroughHeaders = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ];
    for (const key of passthroughHeaders) {
      const value = upstream.headers[key];
      if (value) headers.set(key, value);
    }
    if (!headers.has("content-type")) headers.set("content-type", "audio/wav");
    headers.set("x-recording-proxy", "1");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to proxy recording" },
      { status: 500 }
    );
  }
}
