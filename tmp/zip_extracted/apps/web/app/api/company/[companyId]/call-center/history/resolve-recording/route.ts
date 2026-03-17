import { NextRequest, NextResponse } from "next/server";
import { CallCenter, getSql } from "@repo/ai-core";
import { z } from "zod";
import * as http from "node:http";
import * as https from "node:https";

import { requireAuth } from "@/lib/auth/requireAuth";

type ParamsCtx = { params: Promise<{ companyId: string }> };
const yeastarTokenCache = (() => {
  const key = "__GLOBAL_ERP_YEASTAR_TOKEN_CACHE__";
  const g = globalThis as any;
  if (!g[key]) g[key] = new Map<string, { token: string; expiresAtMs: number }>();
  return g[key] as Map<string, { token: string; expiresAtMs: number }>;
})();
const YEASTAR_TOKEN_REFRESH_BUFFER_MS = 60_000;

const bodySchema = z.object({
  providerCallId: z.string().min(1),
  recordingFile: z.string().trim().optional(),
  recordingUrl: z.string().trim().optional(),
  recordingDurationSeconds: z.number().optional(),
});

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
  return apiPath ? `${baseUrl}/${apiPath}` : baseUrl;
}

function normalizeYeastarRecordingUrl(raw: string | null | undefined, baseOrServerUrl: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  let origin = "";
  try {
    origin = new URL(baseOrServerUrl).origin;
  } catch {
    origin = "";
  }
  if (!origin) return value;
  if (value.startsWith("/")) return `${origin}${value}`;
  if (value.startsWith("files/")) return `${origin}/${value}`;
  return `${origin}/files/${encodeURIComponent(value)}`;
}

function getYeastarTokenCacheKey(base: string, mode: string, identifier: string): string {
  return `${base}|${mode}|${identifier.trim().toLowerCase()}`;
}

function findFirstDeep(payload: unknown, keys: string[]): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const stack: unknown[] = [payload];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    const rec = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      if (wanted.has(key.toLowerCase()) && value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    for (const value of Object.values(rec)) {
      if (value && typeof value === "object") stack.push(value);
      else if (typeof value === "string") {
        const trimmed = value.trim();
        if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length > 2) {
          try {
            stack.push(JSON.parse(trimmed));
          } catch {
            // ignore
          }
        }
      }
    }
  }
  return undefined;
}

function extractRecordingFromListPayload(json: any, providerCallId: string, baseOrServerUrl: string): {
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
} | null {
  const rows = Array.isArray(json?.data) ? json.data : [];
  for (const row of rows) {
    const callIdRaw = findFirstDeep(row, ["call_id", "callid", "linkedid", "linked_id", "uniqueid"]);
    const fileRaw = findFirstDeep(row, ["record_file", "file", "file_name", "filename"]);
    const recordingUrlRaw = findFirstDeep(row, [
      "recording_url",
      "record_url",
      "record_file_url",
      "download_url",
      "play_url",
      "record_file",
      "file",
      "url",
    ]);
    const recordingIdRaw = findFirstDeep(row, ["recording_id", "record_id", "record_file_id", "id", "uuid"]);
    const durationRaw = findFirstDeep(row, [
      "recording_duration",
      "record_duration",
      "recordingDuration",
      "duration",
      "call_duration",
      "talk_duration",
    ]);

    const callId = String(callIdRaw ?? "").trim();
    const fileName = String(fileRaw ?? "").trim();
    const fileCallId = (fileName.match(/-(\d+\.\d+)-/)?.[1] ?? "").trim();
    if (callId !== providerCallId && fileCallId !== providerCallId) continue;

    const recordingUrl = normalizeYeastarRecordingUrl(String(recordingUrlRaw ?? "").trim(), baseOrServerUrl);
    const recordingId = String(recordingIdRaw ?? "").trim();
    const duration = Number(durationRaw);
    return {
      recordingUrl: recordingUrl || normalizeYeastarRecordingUrl(fileName, baseOrServerUrl) || undefined,
      recordingId: recordingId || callId || fileName || undefined,
      recordingDurationSeconds: Number.isFinite(duration) ? duration : undefined,
    };
  }
  return null;
}

async function requestJson(params: {
  url: string;
  method: "GET" | "POST";
  sslVerify: boolean;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; rawBody: string; json: any; error?: string }> {
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
          ...(params.body
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
          resolve({ ok: status >= 200 && status < 300, status, rawBody: responseText, json: parsed });
        });
      }
    );

    req.on("error", (err: any) => {
      resolve({
        ok: false,
        status: 0,
        rawBody: "",
        json: {},
        error: err?.message ?? "request failed",
      });
    });

    if (bodyText) req.write(bodyText);
    req.end();
  });
}

function buildYeastarTokenCandidates(credentials: Record<string, any>): Array<{
  mode: "userpass" | "client" | "access_userpass";
  payload: Record<string, string>;
}> {
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";

  const username = String(
    credentials.username ??
      credentials.userName ??
      credentials.apiUsername ??
      credentials.api_user_name ??
      credentials.api_user ??
      ""
  ).trim();
  const password = String(
    credentials.password ??
      credentials.passWord ??
      credentials.apiPassword ??
      credentials.api_password ??
      credentials.api_pass ??
      ""
  ).trim();
  const accessId = String(
    credentials.accessId ??
      credentials.access_id ??
      credentials.linkusAccessId ??
      credentials.linkus_access_id ??
      ""
  ).trim();
  const accessKey = String(
    credentials.accessKey ??
      credentials.access_key ??
      credentials.linkusAccessKey ??
      credentials.linkus_access_key ??
      ""
  ).trim();
  const clientId = String(credentials.clientId ?? credentials.client_id ?? "").trim();
  const clientSecret = String(credentials.clientSecret ?? credentials.client_secret ?? "").trim();

  const candidates: Array<{
    mode: "userpass" | "client" | "access_userpass";
    payload: Record<string, string>;
  }> = [];
  if (username && password) {
    candidates.push({ mode: "userpass", payload: { user_agent: userAgent, username, password } });
  }
  if (clientId && clientSecret) {
    candidates.push({
      mode: "client",
      payload: { user_agent: userAgent, client_id: clientId, client_secret: clientSecret },
    });
  }
  if (accessId && accessKey) {
    candidates.push({
      mode: "access_userpass",
      payload: { user_agent: userAgent, username: accessId, password: accessKey },
    });
  }
  return candidates;
}

async function getYeastarTokens(
  credentials: Record<string, any>
): Promise<{ tokens: Array<{ mode: string; token: string }>; reason?: string }> {
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return { tokens: [], reason: "missing_base_url" };
  const sslVerify = toBool(credentials.sslVerify, true);
  const candidates = buildYeastarTokenCandidates(credentials);
  if (!candidates.length) return { tokens: [], reason: "missing_credentials" };

  const now = Date.now();
  const successTokens: Array<{ mode: string; token: string }> = [];
  const seen = new Set<string>();
  const failureReasons: string[] = [];

  const getCandidateIdentifier = (
    mode: string,
    payload: Record<string, string>
  ): string => {
    if (mode === "client") return String(payload.client_id ?? "");
    return String(payload.username ?? "");
  };

  for (const candidate of candidates) {
    const identifier = getCandidateIdentifier(candidate.mode, candidate.payload);
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
    const cached = yeastarTokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > now + YEASTAR_TOKEN_REFRESH_BUFFER_MS) {
      const dedupeKey = `${candidate.mode}:${cached.token}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        successTokens.push({ mode: candidate.mode, token: cached.token });
      }
    }
  }

  for (const candidate of candidates) {
    const identifier = getCandidateIdentifier(candidate.mode, candidate.payload);
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
    const cached = yeastarTokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > now + YEASTAR_TOKEN_REFRESH_BUFFER_MS) {
      continue;
    }

    const tokenRes = await requestJson({
      url: `${base}/get_token`,
      method: "POST",
      body: candidate.payload,
      sslVerify,
      headers: { "User-Agent": String(candidate.payload.user_agent ?? "OpenAPI") },
      timeoutMs: 5000,
    });
    const token = String(tokenRes.json?.access_token ?? "").trim();
    const errcode = Number(tokenRes.json?.errcode ?? -1);
    if (tokenRes.ok && errcode === 0 && token) {
      const ttlSecRaw = Number(tokenRes.json?.access_token_expire_time ?? 1800);
      const ttlMs = Number.isFinite(ttlSecRaw) && ttlSecRaw > 0 ? ttlSecRaw * 1000 : 1800 * 1000;
      yeastarTokenCache.set(cacheKey, { token, expiresAtMs: Date.now() + ttlMs });
      const dedupeKey = `${candidate.mode}:${token}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        successTokens.push({ mode: candidate.mode, token });
      }
      continue;
    }
    const errMsg = String(tokenRes.json?.errmsg ?? tokenRes.error ?? "token_failed").trim() || "token_failed";
    if (errMsg.toUpperCase().includes("MAX LIMITATION EXCEEDED") && cached?.token) {
      const dedupeKey = `${candidate.mode}:${cached.token}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        successTokens.push({ mode: candidate.mode, token: cached.token });
      }
      continue;
    }
    failureReasons.push(`${candidate.mode}:${errMsg}`);
  }

  return {
    tokens: successTokens,
    reason: successTokens.length ? undefined : failureReasons.join(" | ") || "token_failed",
  };
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const { companyId } = await ctx.params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }
    const providerCallId = String(parsed.data.providerCallId).trim();
    const sql = getSql();

    const sessions = await sql<
      {
        id: string;
        provider_key: string;
        provider_call_id: string | null;
        status: string;
        from_number: string | null;
        to_number: string | null;
        started_at: string | null;
        ended_at: string | null;
      }[]
    >`
      SELECT id, provider_key, provider_call_id, status, from_number, to_number, started_at::text, ended_at::text
      FROM call_sessions
      WHERE company_id = ${companyId}
        AND (provider_call_id = ${providerCallId} OR id::text = ${providerCallId})
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const session = ((sessions as any).rows ?? sessions)?.[0];
    if (!session) return NextResponse.json({ error: "Call session not found" }, { status: 404 });
    if (String(session.provider_key ?? "").toLowerCase() !== "yeastar") {
      return NextResponse.json({ error: "Resolve Recording Now currently supports Yeastar only" }, { status: 400 });
    }
    const normalizedCallId = String(session.provider_call_id ?? providerCallId).trim();

    const integrations = await sql<{ id: string; credentials: Record<string, unknown> | null }[]>`
      SELECT id, credentials
      FROM integration_dialers
      WHERE provider = 'yeastar'
        AND is_active = TRUE
        AND (company_id = ${companyId} OR company_id IS NULL)
      ORDER BY CASE WHEN company_id = ${companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
      LIMIT 10
    `;
    const candidates = ((integrations as any).rows ?? integrations) as Array<{
      id: string;
      credentials: Record<string, unknown> | null;
    }>;
    if (!candidates.length) {
      return NextResponse.json({ error: "No active Yeastar integration candidates found" }, { status: 404 });
    }

    const manualRecordingFile = String(parsed.data.recordingFile ?? "").trim();
    const manualRecordingUrlRaw = String(parsed.data.recordingUrl ?? "").trim();
    if (manualRecordingFile || manualRecordingUrlRaw) {
      const firstCreds =
        candidates.find((c) => c.credentials && typeof c.credentials === "object")?.credentials ?? {};
      const baseForManual = normalizedBaseUrl(
        typeof (firstCreds as any).apiBaseUrl === "string" ? (firstCreds as any).apiBaseUrl : undefined,
        typeof (firstCreds as any).apiPath === "string" ? (firstCreds as any).apiPath : undefined
      );
      const recordingUrl = normalizeYeastarRecordingUrl(
        manualRecordingUrlRaw || manualRecordingFile,
        baseForManual ?? "https://127.0.0.1"
      );
      const recordingId = manualRecordingFile || manualRecordingUrlRaw;
      await CallCenter.handleDialerWebhookUpdate({
        providerKey: "yeastar",
        providerCallId: normalizedCallId,
        status: String(session.status ?? "completed"),
        scope: "company",
        companyId,
        recordingUrl: recordingUrl || undefined,
        recordingId: recordingId || undefined,
        recordingDurationSeconds: Number.isFinite(Number(parsed.data.recordingDurationSeconds))
          ? Number(parsed.data.recordingDurationSeconds)
          : undefined,
      });
      return NextResponse.json({
        ok: true,
        providerCallId: normalizedCallId,
        recordingUrl: recordingUrl || null,
        recordingId: recordingId || null,
        recordingDurationSeconds: Number.isFinite(Number(parsed.data.recordingDurationSeconds))
          ? Number(parsed.data.recordingDurationSeconds)
          : null,
        attempts: [{ step: "manual", via: manualRecordingUrlRaw ? "recordingUrl" : "recordingFile" }],
      });
    }

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const attemptsLog: Array<Record<string, unknown>> = [];

    for (const integration of candidates) {
      const credentials =
        integration.credentials && typeof integration.credentials === "object"
          ? (integration.credentials as Record<string, any>)
          : {};
      const base = normalizedBaseUrl(
        typeof credentials.apiBaseUrl === "string" ? credentials.apiBaseUrl : undefined,
        typeof credentials.apiPath === "string" ? credentials.apiPath : undefined
      );
      if (!base) continue;
      const tokenRes = await getYeastarTokens(credentials);
      if (!tokenRes.tokens.length) {
        attemptsLog.push({
          integrationId: integration.id,
          step: "token",
          ok: false,
          reason: tokenRes.reason ?? "token_failed",
        });
        continue;
      }

      const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
      const sslVerify = toBool(credentials.sslVerify, true);
      for (const tokenVariant of tokenRes.tokens) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const queryUrl = `${base}/call/query?access_token=${encodeURIComponent(tokenVariant.token)}&call_id=${encodeURIComponent(
            normalizedCallId
          )}`;
          const queryRes = await requestJson({
            url: queryUrl,
            method: "GET",
            sslVerify,
            headers: {
              "User-Agent": userAgent,
              Authorization: tokenVariant.token,
            },
            timeoutMs: 5000,
          });

          const recordingUrlRaw = findFirstDeep(queryRes.json, [
            "recording_url",
            "record_url",
            "record_file",
            "record_file_url",
            "record_path",
            "recording_path",
            "monitor_record",
            "recordingUrl",
            "url",
          ]);
          const recordingIdRaw = findFirstDeep(queryRes.json, [
            "recording_id",
            "record_id",
            "recordingId",
            "record_uuid",
            "record_file_id",
            "uuid",
          ]);
          const recordingDurationRaw = findFirstDeep(queryRes.json, [
            "recording_duration",
            "record_duration",
            "recordingDuration",
            "duration",
            "call_duration",
          ]);
          const recordingUrl = normalizeYeastarRecordingUrl(
            recordingUrlRaw ? String(recordingUrlRaw).trim() : "",
            base
          );
          const recordingId = recordingIdRaw ? String(recordingIdRaw).trim() : "";
          const recordingDurationSeconds = Number(recordingDurationRaw);

          attemptsLog.push({
            integrationId: integration.id,
            tokenMode: tokenVariant.mode,
            step: "query",
            attempt: attempt + 1,
            status: queryRes.status,
            errcode: Number(queryRes.json?.errcode ?? -1),
            errmsg: String(queryRes.json?.errmsg ?? queryRes.error ?? "").trim() || null,
            found: Boolean(recordingUrl || recordingId),
          });

          if (recordingUrl || recordingId) {
            await CallCenter.handleDialerWebhookUpdate({
              providerKey: "yeastar",
              providerCallId: normalizedCallId,
              status: String(session.status ?? "completed"),
              scope: "company",
              companyId,
              recordingUrl: recordingUrl || undefined,
              recordingId: recordingId || undefined,
              recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
                ? recordingDurationSeconds
                : undefined,
            });
            return NextResponse.json({
              ok: true,
              providerCallId: normalizedCallId,
              recordingUrl: recordingUrl || null,
              recordingId: recordingId || null,
              recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
                ? recordingDurationSeconds
                : null,
              attempts: attemptsLog,
            });
          }
          if (attempt < 4) await wait(900);
        }

        const startedAt = session.started_at ? new Date(session.started_at) : null;
        const endedAt = session.ended_at ? new Date(session.ended_at) : null;
        const startedAtSec =
          startedAt && Number.isFinite(startedAt.getTime()) ? Math.floor(startedAt.getTime() / 1000) : null;
        const endedAtSec =
          endedAt && Number.isFinite(endedAt.getTime()) ? Math.floor(endedAt.getTime() / 1000) : null;
        const fallbackEndpoints = ["recording/list", "cdr/list"];
        for (const endpoint of fallbackEndpoints) {
          for (let page = 1; page <= 4; page += 1) {
            const q = new URLSearchParams();
            q.set("access_token", tokenVariant.token);
            q.set("call_id", normalizedCallId);
            q.set("id", normalizedCallId);
            q.set("page", String(page));
            q.set("page_size", "100");
            q.set("sort", "desc");
            q.set("order", "desc");
            q.set("sort_by", "id");
            q.set("order_by", "desc");
            q.set("reverse", "1");
            if (session.from_number) q.set("call_from", String(session.from_number));
            if (session.to_number) q.set("call_to", String(session.to_number));
            if (startedAtSec) q.set("start_time", String(startedAtSec - 5 * 60));
            if (endedAtSec) q.set("end_time", String(endedAtSec + 5 * 60));

            const listRes = await requestJson({
              url: `${base}/${endpoint}?${q.toString()}`,
              method: "GET",
              sslVerify,
              headers: {
                "User-Agent": userAgent,
                Authorization: tokenVariant.token,
              },
              timeoutMs: 6000,
            });

            attemptsLog.push({
              integrationId: integration.id,
              tokenMode: tokenVariant.mode,
              step: "fallback_query",
              endpoint,
              page,
              status: listRes.status,
              errcode: Number(listRes.json?.errcode ?? -1),
              errmsg: String(listRes.json?.errmsg ?? listRes.error ?? "").trim() || null,
            });

            const errcode = Number(listRes.json?.errcode ?? -1);
            if (!listRes.ok || (Number.isFinite(errcode) && errcode !== 0)) continue;
            const extracted = extractRecordingFromListPayload(listRes.json, normalizedCallId, base);
            if (!extracted) continue;

            await CallCenter.handleDialerWebhookUpdate({
              providerKey: "yeastar",
              providerCallId: normalizedCallId,
              status: String(session.status ?? "completed"),
              scope: "company",
              companyId,
              recordingUrl: extracted.recordingUrl,
              recordingId: extracted.recordingId,
              recordingDurationSeconds: extracted.recordingDurationSeconds,
            });
            return NextResponse.json({
              ok: true,
              providerCallId: normalizedCallId,
              recordingUrl: extracted.recordingUrl ?? null,
              recordingId: extracted.recordingId ?? null,
              recordingDurationSeconds: extracted.recordingDurationSeconds ?? null,
              attempts: attemptsLog,
            });
          }
        }
      }
    }

    return NextResponse.json({
      ok: false,
      error: "Recording not found yet",
      providerCallId: normalizedCallId,
      attempts: attemptsLog,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to resolve recording" },
      { status: 500 }
    );
  }
}
