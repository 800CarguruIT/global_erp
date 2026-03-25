import * as http from "node:http";
import * as https from "node:https";
import { registerDialerProvider } from "../providers";
import type {
  DialerIntegration,
  DialerProvider,
  IntegrationHealthStatus,
  PlaceCallResult,
} from "../types";

type YeastarTokenResponse = {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
};

const providerKey = "yeastar";
const tokenCache = new Map<string, { token: string; expiresAtMs: number }>();

function toBool(value: unknown, defaultValue = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return defaultValue;
}

function normalizedBaseUrl(rawBaseUrl?: string, rawPath?: string): string | null {
  const baseUrl = (rawBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;

  const apiPath = (rawPath ?? "openapi/v1.0").trim().replace(/^\/+|\/+$/g, "");
  if (!apiPath) return baseUrl;
  return `${baseUrl}/${apiPath}`;
}

function normalizeYeastarPhone(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function normalizeYeastarExtension(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/[^0-9A-Za-z_-]/g, "");
}

function getCredentials(integration: DialerIntegration, customCredentials: any): Record<string, any> {
  const fromIntegration =
    integration.credentials && typeof integration.credentials === "object"
      ? integration.credentials
      : {};
  const fromCall =
    customCredentials && typeof customCredentials === "object"
      ? customCredentials
      : {};
  return { ...fromIntegration, ...fromCall };
}

function getCacheKey(integration: DialerIntegration): string {
  return integration.id || `${providerKey}-${Date.now()}`;
}

async function postJson(params: {
  url: string;
  body: Record<string, unknown>;
  sslVerify: boolean;
  headers?: Record<string, string>;
}): Promise<{ ok: boolean; status: number; rawBody: string; error?: string }> {
  return new Promise((resolve) => {
    const target = new URL(params.url);
    const isHttps = target.protocol === "https:";
    const client = isHttps ? https : http;
    const bodyText = JSON.stringify(params.body);

    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port ? Number(target.port) : isHttps ? 443 : 80,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyText),
          ...(params.headers ?? {}),
        },
        ...(isHttps ? { rejectUnauthorized: params.sslVerify } : {}),
        timeout: 15_000,
      },
      (res) => {
        let responseText = "";
        res.on("data", (chunk) => {
          responseText += chunk.toString();
        });
        res.on("end", () => {
          const status = res.statusCode ?? 500;
          resolve({ ok: status >= 200 && status < 300, status, rawBody: responseText });
        });
      }
    );

    req.on("error", (err: any) => {
      resolve({ ok: false, status: 0, rawBody: "", error: err?.message ?? "request failed" });
    });

    req.write(bodyText);
    req.end();
  });
}

async function requestYeastarToken(
  integration: DialerIntegration,
  credentials: Record<string, any>
): Promise<{ ok: true; token: string } | { ok: false; error: string; raw?: unknown }> {
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) {
    return { ok: false, error: "Missing Yeastar API base URL" };
  }

  const cacheKey = getCacheKey(integration);
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return { ok: true, token: cached.token };
  }

  const username = String(credentials.username ?? "").trim();
  const password = String(credentials.password ?? "").trim();
  const clientId = String(credentials.clientId ?? "").trim();
  const clientSecret = String(credentials.clientSecret ?? "").trim();
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);

  if ((!username || !password) && (!clientId || !clientSecret)) {
    return {
      ok: false,
      error: "Missing Yeastar credentials. Provide username/password or clientId/clientSecret.",
    };
  }

  const payload: Record<string, string> = { user_agent: userAgent };
  if (username && password) {
    payload.username = username;
    payload.password = password;
  } else {
    payload.client_id = clientId;
    payload.client_secret = clientSecret;
  }

  const tokenRes = await postJson({
    url: `${base}/get_token`,
    body: payload,
    sslVerify,
    headers: { "User-Agent": userAgent },
  });
  const raw = JSON.parse(tokenRes.rawBody || "{}") as YeastarTokenResponse;
  if (!tokenRes.ok || raw.errcode !== 0 || !raw.access_token) {
    return {
      ok: false,
      error: raw.errmsg || tokenRes.error || `Yeastar token request failed (${tokenRes.status})`,
      raw,
    };
  }

  const expiresInSec = Number(raw.expires_in ?? 3600);
  tokenCache.set(cacheKey, {
    token: raw.access_token,
    expiresAtMs:
      Date.now() + (Number.isFinite(expiresInSec) ? Math.max(expiresInSec, 60) * 1000 : 3600_000),
  });

  return { ok: true, token: raw.access_token };
}

async function dialYeastarCall(args: {
  base: string;
  token: string;
  caller: string;
  callee: string;
  autoAnswer: "yes" | "no";
  dialPermission?: string;
  userAgent: string;
  sslVerify: boolean;
}): Promise<{ ok: true; raw: any } | { ok: false; error: string; raw?: unknown }> {
  const body: Record<string, unknown> = {
    caller: args.caller,
    callee: args.callee,
    auto_answer: args.autoAnswer,
  };
  if (args.dialPermission) {
    body.outbound_params = { dial_permission: args.dialPermission };
  }

  const dialRes = await postJson({
    url: `${args.base}/call/dial`,
    body,
    sslVerify: args.sslVerify,
    headers: {
      Authorization: args.token,
      "User-Agent": args.userAgent,
    },
  });
  const raw = JSON.parse(dialRes.rawBody || "{}");
  if (!dialRes.ok || (typeof raw?.errcode === "number" && raw.errcode !== 0)) {
    return {
      ok: false,
      error: raw?.errmsg || dialRes.error || `Yeastar dial failed (${dialRes.status})`,
      raw,
    };
  }
  return { ok: true, raw };
}

async function subscribeYeastarEvents(args: {
  base: string;
  token: string;
  webhookUrl: string;
  sslVerify: boolean;
  userAgent: string;
}): Promise<void> {
  await postJson({
    url: `${args.base}/subscribe`,
    body: {
      url: args.webhookUrl,
      user_agent: args.userAgent,
      events: [
        { type: "call" },
        { type: "cdr" },
      ],
    },
    sslVerify: args.sslVerify,
    headers: { Authorization: args.token, "User-Agent": args.userAgent },
  });
}

async function doYeastarHealthCheck(integration: DialerIntegration): Promise<IntegrationHealthStatus> {
  const credentials = getCredentials(integration, integration.credentials);
  const token = await requestYeastarToken(integration, credentials);
  if (!token.ok) throw new Error(token.error);

  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  const webhookUrl = String(credentials.webhookUrl ?? "").trim();
  const sslVerify = toBool(credentials.sslVerify, true);
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  if (base && webhookUrl) {
    await subscribeYeastarEvents({ base, token: token.token, webhookUrl, sslVerify, userAgent }).catch(() => {});
  }

  return "healthy";
}

export const yeastarProvider: DialerProvider = {
  key: providerKey,
  async placeCall({ to, from, callerId, credentials, integration }): Promise<PlaceCallResult> {
    const mergedCredentials = getCredentials(integration, credentials);
    const base = normalizedBaseUrl(mergedCredentials.apiBaseUrl, mergedCredentials.apiPath);
    if (!base) {
      return { success: false, error: "Missing Yeastar API base URL" };
    }

    const caller = normalizeYeastarExtension(from ?? callerId ?? mergedCredentials.defaultExtension);
    const callee = normalizeYeastarPhone(to);
    const dialPermission = String(mergedCredentials.dialPermission ?? "").trim() || undefined;
    const autoAnswerRaw = String(mergedCredentials.autoAnswer ?? "yes").toLowerCase();
    const autoAnswer: "yes" | "no" = autoAnswerRaw === "no" ? "no" : "yes";
    const userAgent = String(mergedCredentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
    const sslVerify = toBool(mergedCredentials.sslVerify, true);

    if (!caller) {
      return {
        success: false,
        error: "Missing Yeastar caller extension. Set from/callerId or credentials.defaultExtension.",
      };
    }
    if (!callee) {
      return { success: false, error: "Missing valid destination number" };
    }

    const tokenResult = await requestYeastarToken(integration, mergedCredentials);
    if (!tokenResult.ok) {
      return { success: false, error: tokenResult.error, raw: tokenResult.raw };
    }

    let dial = await dialYeastarCall({
      base,
      token: tokenResult.token,
      caller,
      callee,
      autoAnswer,
      dialPermission,
      userAgent,
      sslVerify,
    });

    if (!dial.ok && (dial.raw as any)?.errcode === 10004) {
      tokenCache.delete(getCacheKey(integration));
      const refreshed = await requestYeastarToken(integration, mergedCredentials);
      if (refreshed.ok) {
        dial = await dialYeastarCall({
          base,
          token: refreshed.token,
          caller,
          callee,
          autoAnswer,
          dialPermission,
          userAgent,
          sslVerify,
        });
      } else {
        return { success: false, error: refreshed.error, raw: refreshed.raw };
      }
    }

    if (!dial.ok) {
      return { success: false, error: dial.error, raw: dial.raw };
    }

    const dialRaw = dial.raw as any;
    const callId =
      dialRaw?.call_id ??
      dialRaw?.unique_id ??
      dialRaw?.id ??
      dialRaw?.data?.call_id ??
      `yeastar-${Date.now()}`;

    return {
      success: true,
      callId: String(callId),
      providerResponse: dialRaw,
      raw: dialRaw,
    };
  },
  checkHealth: doYeastarHealthCheck,
};

registerDialerProvider(yeastarProvider);
