import { NextRequest, NextResponse } from "next/server";
import {
  CallAiPolicy,
  CallAiWorkflow,
  CallCenter,
  Dialer,
  getOpenAIClientForCompany,
  getSql,
} from "@repo/ai-core";
import { publishIncomingPopupEvent } from "../../../../../lib/call-center/incoming-popup-bus";
import { appendFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as http from "node:http";
import * as https from "node:https";

type DialerWebhookUpdate = {
  providerKey: string;
  providerCallId: string;
  status: string;
  direction?: "inbound" | "outbound";
  fromNumber?: string;
  toNumber?: string;
  scope?: "global" | "company";
  companyId?: string;
  branchId?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
  ringingExtensions?: string[];
  rawPayload?: unknown;
};

export const dynamic = "force-dynamic";
const WEBHOOK_LOG_PATH =
  process.env.DIALER_WEBHOOK_LOG_PATH?.trim() ||
  path.join(os.tmpdir(), "global-erp", "webhook-dialer.log");
const WEBHOOK_LOG_FALLBACK_PATH = path.join(
  os.tmpdir(),
  "global-erp",
  "webhook-dialer-fallback.log"
);
const liveExecutionSeen = new Map<string, number>();
const yeastarTokenCache = (() => {
  const key = "__GLOBAL_ERP_YEASTAR_TOKEN_CACHE__";
  const g = globalThis as any;
  if (!g[key]) g[key] = new Map<string, { token: string; expiresAtMs: number }>();
  return g[key] as Map<string, { token: string; expiresAtMs: number }>;
})();
const yeastarRecordingRetrySeen = new Map<string, number>();
const yeastarTokenBackoffUntil = new Map<string, number>();
const YEASTAR_TOKEN_REFRESH_BUFFER_MS = 5 * 60_000;
const YEASTAR_TOKEN_MAX_LIMIT_BACKOFF_MS = 60_000;
const YEASTAR_RECORDING_QUERY_ATTEMPTS = 4;
const YEASTAR_RECORDING_QUERY_WAIT_MS = 1200;
const YEASTAR_RECORDING_DEFERRED_DELAYS_MS = [0, 30_000] as const;

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Failed to serialize payload" });
  }
}

async function logWebhookLine(line: Record<string, unknown>) {
  try {
    const dir = path.dirname(WEBHOOK_LOG_PATH);
    await mkdir(dir, { recursive: true });
    await appendFile(WEBHOOK_LOG_PATH, `${safeJson(line)}\n`, "utf8");
  } catch (error) {
    // Keep webhook resilient, but surface diagnostics and preserve logs in fallback path.
    console.error("dialer webhook log write failed", {
      targetPath: WEBHOOK_LOG_PATH,
      fallbackPath: WEBHOOK_LOG_FALLBACK_PATH,
      error: error instanceof Error ? error.message : String(error),
    });
    try {
      const fallbackDir = path.dirname(WEBHOOK_LOG_FALLBACK_PATH);
      await mkdir(fallbackDir, { recursive: true });
      await appendFile(
        WEBHOOK_LOG_FALLBACK_PATH,
        `${safeJson({
          ts: new Date().toISOString(),
          stage: "log_write_fallback",
          targetPath: WEBHOOK_LOG_PATH,
          originalError: error instanceof Error ? error.message : String(error),
          line,
        })}\n`,
        "utf8"
      );
    } catch {
      // no-op: logging must never break webhook handling
    }
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

function normalizedBaseUrl(rawBaseUrl?: string, rawPath?: string): string | null {
  const baseUrl = (rawBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  const apiPath = (rawPath ?? "openapi/v1.0").trim().replace(/^\/+|\/+$/g, "");
  return apiPath ? `${baseUrl}/${apiPath}` : baseUrl;
}

function getYeastarTokenCacheKey(
  base: string,
  mode: "userpass" | "client" | "access_userpass",
  identifier: string
): string {
  return `${base}|${mode}|${identifier.trim().toLowerCase()}`;
}

function normalizeMaybePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

function normalizeDialToken(value: string | null | undefined): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/[\s\-().]/g, "");
}

function extractRingingExtensionsFromPayload(rawPayload: unknown): string[] {
  const out = new Set<string>();
  const payload = rawPayload && typeof rawPayload === "object" ? (rawPayload as any) : null;
  const push = (value: unknown) => {
    const token = String(value ?? "").trim();
    if (token) out.add(token);
  };

  let msgObj: any = null;
  const msgRaw = typeof payload?.msg === "string" ? payload.msg : null;
  if (msgRaw) {
    try {
      msgObj = JSON.parse(msgRaw);
    } catch {
      msgObj = null;
    }
  }

  const sources = [
    payload?.msgParsed,
    msgObj,
    payload,
  ];

  for (const source of sources) {
    const members = Array.isArray(source?.members) ? source.members : [];
    for (const member of members) {
      const extObj = member?.extension ?? {};
      const extNum = String(extObj?.number ?? "").trim();
      if (!extNum) continue;
      const status = String(extObj?.member_status ?? "").trim().toUpperCase();
      if (!status || ["RING", "ALERT", "RINGING", "INCOMING", "ANSWER"].includes(status)) {
        push(extNum);
      }
    }
  }

  return Array.from(out);
}

function isLikelyExternalNumber(value: string | null | undefined): boolean {
  const normalized = normalizeMaybePhone(value);
  if (!normalized) return false;
  const digits = normalized.replace(/\D+/g, "");
  return digits.length >= 7;
}

function coerceStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "number") return [String(value)];
  return [];
}

function pickIntegrationTokens(
  credentials: Record<string, unknown> | null | undefined,
  metadata: Record<string, unknown> | null | undefined
): string[] {
  const out = new Set<string>();
  const keys = [
    "defaultExtension",
    "extension",
    "extensions",
    "inboundExtension",
    "inboundExtensions",
    "did",
    "didNumber",
    "didNumbers",
    "inboundDid",
    "inboundDids",
    "toNumber",
    "toNumbers",
  ];
  const sources = [credentials ?? {}, metadata ?? {}];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const rec = source as Record<string, unknown>;
    for (const key of keys) {
      const values = coerceStringList(rec[key]);
      for (const value of values) {
        const token = normalizeDialToken(value);
        if (token) out.add(token);
      }
    }
  }
  return Array.from(out);
}

async function resolveCompanyForInbound(args: {
  providerKey: string;
  toNumber?: string | null;
  rawPayload?: unknown;
}): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      company_id: string | null;
      credentials: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    }[]
  >`
    SELECT id, company_id, credentials, metadata
    FROM integration_dialers
    WHERE provider = ${args.providerKey}
      AND is_active = TRUE
      AND company_id IS NOT NULL
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 200
  `;
  const candidates = ((rows as any).rows ?? rows) as Array<{
    id: string;
    company_id: string | null;
    credentials: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>;
  if (!candidates.length) return null;

  const uniqueCompanies = Array.from(new Set(candidates.map((r) => String(r.company_id ?? "").trim()).filter(Boolean)));
  if (uniqueCompanies.length === 1) return uniqueCompanies[0] ?? null;

  const payloadToRaw = findFirstDeep(args.rawPayload, [
    "to",
    "to_number",
    "toNumber",
    "dst",
    "dnis",
    "called_number",
    "did",
    "did_number",
    "extension",
  ]);
  const targetTokens = new Set<string>();
  for (const raw of [args.toNumber ?? null, typeof payloadToRaw === "string" || typeof payloadToRaw === "number" ? String(payloadToRaw) : null]) {
    const token = normalizeDialToken(raw);
    if (!token) continue;
    targetTokens.add(token);
    const digits = token.replace(/\D+/g, "");
    if (digits) targetTokens.add(digits);
  }
  if (!targetTokens.size) return null;

  for (const candidate of candidates) {
    const integrationTokens = pickIntegrationTokens(candidate.credentials, candidate.metadata);
    if (!integrationTokens.length) continue;
    for (const token of integrationTokens) {
      const normalized = normalizeDialToken(token);
      const digits = normalized.replace(/\D+/g, "");
      if (targetTokens.has(normalized) || (digits && targetTokens.has(digits))) {
        return candidate.company_id;
      }
    }
  }

  return null;
}

async function executeLiveInboundAi(args: {
  companyId: string;
  providerKey: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  policy: {
    guidance?: {
      welcomeMessage?: string;
      systemPrompt?: string;
      escalationKeywords?: string[];
    } | null;
    timezone?: string;
  } | null;
}): Promise<{
  executed: boolean;
  action: string;
  reason?: string;
  replyText?: string;
  model?: string;
  source?: "company" | "global" | null;
}> {
  const { client, source } = await getOpenAIClientForCompany(args.companyId);
  if (!client) {
    return {
      executed: false,
      action: "no_client",
      reason: "No OpenAI client available for company or global fallback",
      source,
    };
  }

  const model = process.env.CALL_AI_MODEL?.trim() || "gpt-4o-mini";
  const systemPrompt =
    String(args.policy?.guidance?.systemPrompt ?? "").trim() ||
    "You are an inbound call AI assistant for an ERP call center. Reply with one short, polite opening sentence and one clarifying question.";
  const welcomeMessage = String(args.policy?.guidance?.welcomeMessage ?? "").trim();
  const escalationKeywords = Array.isArray(args.policy?.guidance?.escalationKeywords)
    ? args.policy?.guidance?.escalationKeywords.join(", ")
    : "";
  const userPrompt = [
    `Call context: provider=${args.providerKey}, callId=${args.providerCallId}`,
    `Caller: ${String(args.fromNumber ?? "unknown")}`,
    `Target: ${String(args.toNumber ?? "unknown")}`,
    `Timezone: ${String(args.policy?.timezone ?? "Asia/Dubai")}`,
    welcomeMessage ? `Preferred welcome: ${welcomeMessage}` : "",
    escalationKeywords ? `Escalation keywords: ${escalationKeywords}` : "",
    "Return plain text only. Max 220 characters.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const replyText = String(completion.choices?.[0]?.message?.content ?? "").trim();
  if (!replyText) {
    return {
      executed: false,
      action: "empty_reply",
      reason: "AI returned empty response",
      source,
      model,
    };
  }

  // Phase 2 start: live generation path. Provider-side media injection is provider-dependent.
  return {
    executed: true,
    action: "generated_reply",
    replyText,
    source,
    model,
  };
}

function shouldRunLiveExecutionOnce(key: string, ttlMs = 120_000): boolean {
  const now = Date.now();
  for (const [k, seenAt] of liveExecutionSeen.entries()) {
    if (now - seenAt > ttlMs) liveExecutionSeen.delete(k);
  }
  const seen = liveExecutionSeen.get(key);
  if (seen && now - seen <= ttlMs) return false;
  liveExecutionSeen.set(key, now);
  return true;
}

async function getYeastarCredentialsForCompany(args: {
  companyId: string;
}): Promise<Record<string, any> | null> {
  const sql = getSql();
  const rows = await sql<
    { credentials: Record<string, unknown> | null; company_id: string | null }[]
  >`
    SELECT credentials, company_id
    FROM integration_dialers
    WHERE provider = 'yeastar'
      AND is_active = TRUE
      AND (company_id = ${args.companyId} OR company_id IS NULL)
    ORDER BY CASE WHEN company_id = ${args.companyId} THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
    LIMIT 5
  `;
  const candidates = ((rows as any).rows ?? rows) as Array<{
    credentials: Record<string, unknown> | null;
    company_id: string | null;
  }>;
  if (!candidates.length) return null;
  for (const row of candidates) {
    if (row.credentials && typeof row.credentials === "object") {
      return row.credentials;
    }
  }
  return null;
}

async function tryYeastarAutoPickup(args: {
  companyId: string;
  providerCallId: string;
  toNumber?: string | null;
  rawPayload?: unknown;
}): Promise<{ picked: boolean; endpoint?: string; reason?: string }> {
  const credentials = await getYeastarCredentialsForCompany({ companyId: args.companyId });
  if (!credentials) return { picked: false, reason: "No active Yeastar integration credentials" };
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return { picked: false, reason: "Missing Yeastar base URL" };
  const tokenResult = await getTokenForYeastarDetailed(credentials);
  if (!tokenResult.token) {
    return {
      picked: false,
      reason: `Failed to get Yeastar token: ${tokenResult.reason ?? "unknown"}`,
    };
  }
  const token = tokenResult.token;
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);
  const extension = String(args.toNumber ?? "").trim();

  const normalizeExt = (value: string | null | undefined): string => String(value ?? "").trim();
  const targetExt = normalizeExt(extension);
  const channelCandidates: Array<{ channelId: string; extension?: string }> = [];
  const pushChannelCandidate = (channelId: unknown, ext?: unknown) => {
    const cid = String(channelId ?? "").trim();
    if (!cid) return;
    if (channelCandidates.some((c) => c.channelId === cid)) return;
    channelCandidates.push({
      channelId: cid,
      extension: ext ? String(ext).trim() : undefined,
    });
  };

  // 1) Prefer channel_id from webhook payload (fastest + most accurate while ringing).
  const payload = (args.rawPayload ?? {}) as any;
  const msgRaw = typeof payload?.msg === "string" ? payload.msg : null;
  let msgObj: any = null;
  if (msgRaw) {
    try {
      msgObj = JSON.parse(msgRaw);
    } catch {
      msgObj = null;
    }
  }
  const payloadMembers = Array.isArray(msgObj?.members) ? msgObj.members : [];
  // Prefer target extension first (if provided), but also queue all ringing channels as fallback.
  for (const member of payloadMembers) {
    const extObj = member?.extension ?? {};
    const memberStatus = String(extObj?.member_status ?? "").toUpperCase();
    if (!["RING", "ALERT"].includes(memberStatus)) continue;
    const memberExt = normalizeExt(extObj?.number);
    if (targetExt && memberExt && memberExt === targetExt) {
      pushChannelCandidate(extObj?.channel_id, memberExt);
    }
  }
  for (const member of payloadMembers) {
    const extObj = member?.extension ?? {};
    const memberStatus = String(extObj?.member_status ?? "").toUpperCase();
    if (!["RING", "ALERT"].includes(memberStatus)) continue;
    pushChannelCandidate(extObj?.channel_id, extObj?.number);
  }

  // 2) Fallback to live query lookup if webhook did not include usable channel_id.
  if (!channelCandidates.length) {
    const queryUrl = `${base}/call/query?access_token=${encodeURIComponent(token)}&call_id=${encodeURIComponent(
      args.providerCallId
    )}`;
    const queryRes = await requestJson({
      url: queryUrl,
      method: "GET",
      sslVerify,
      headers: {
        "User-Agent": userAgent,
        Authorization: token,
      },
      timeoutMs: 5000,
    });
    const queryData = Array.isArray(queryRes.json?.data) ? queryRes.json.data : [];
    const call = queryData[0];
    const members = Array.isArray(call?.members) ? call.members : [];
    // Prefer target extension first (if provided), then all ringing channels.
    for (const member of members) {
      const extObj = member?.extension ?? {};
      const memberStatus = String(extObj?.member_status ?? "").toUpperCase();
      if (!["RING", "ALERT"].includes(memberStatus)) continue;
      const memberExt = normalizeExt(extObj?.number);
      if (targetExt && memberExt && memberExt === targetExt) {
        pushChannelCandidate(extObj?.channel_id, memberExt);
      }
    }
    for (const member of members) {
      const extObj = member?.extension ?? {};
      const memberStatus = String(extObj?.member_status ?? "").toUpperCase();
      if (!["RING", "ALERT"].includes(memberStatus)) continue;
      pushChannelCandidate(extObj?.channel_id, extObj?.number);
    }
  }

  const candidates: Array<{ name: string; endpoint: string; body: Record<string, unknown> }> = channelCandidates.map(
    (item) => ({
      name: `call_accept_inbound_${item.extension ?? "any"}`,
      endpoint: `${base}/call/accept_inbound?access_token=${encodeURIComponent(token)}`,
      body: { channel_id: item.channelId, inbound: true },
    })
  );

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const verifyAnsweredState = async (): Promise<boolean> => {
    const queryUrl = `${base}/call/query?access_token=${encodeURIComponent(token)}&call_id=${encodeURIComponent(
      args.providerCallId
    )}`;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const queryRes = await requestJson({
        url: queryUrl,
        method: "GET",
        sslVerify,
        headers: {
          "User-Agent": userAgent,
          Authorization: token,
        },
        timeoutMs: 5000,
      });
      const callData = Array.isArray(queryRes.json?.data) ? queryRes.json.data[0] : null;
      const members = Array.isArray(callData?.members) ? callData.members : [];
      const statuses = members
        .map((m: any) =>
          String(
            m?.extension?.member_status ??
              m?.inbound?.member_status ??
              m?.outbound?.member_status ??
              m?.member_status ??
              ""
          ).toUpperCase()
        )
        .filter(Boolean);
      if (statuses.some((s: string) => ["ANSWER", "ANSWERED", "UP", "TALK"].includes(s))) return true;
      const stillRinging = statuses.some((s: string) => ["RING", "ALERT", "RINGING"].includes(s));
      if (!stillRinging) return false;
      await wait(300);
    }
    return false;
  };

  const failureDetails: string[] = [];
  for (const candidate of candidates) {
    const res = await requestJson({
      url: candidate.endpoint,
      method: "POST",
      sslVerify,
      headers: {
        "User-Agent": userAgent,
        Authorization: token,
      },
      body: candidate.body,
      timeoutMs: 5000,
    });
    const errcode = Number(res.json?.errcode ?? 0);
    const endpointPath = (() => {
      try {
        return new URL(candidate.endpoint).pathname;
      } catch {
        return candidate.endpoint;
      }
    })();
    if (res.ok && (!Number.isFinite(errcode) || errcode === 0)) {
      const answered = await verifyAnsweredState();
      if (answered) {
        return { picked: true, endpoint: `${candidate.name}:${endpointPath}` };
      }
      // Yeastar can acknowledge pickup before query view reflects answered state.
      return {
        picked: true,
        endpoint: `${candidate.name}:${endpointPath}`,
        reason: "accept_inbound_acknowledged_verify_pending",
      };
    }
    const errmsg = String(res.json?.errmsg ?? res.error ?? `http_${res.status}`).trim();
    failureDetails.push(`${candidate.name}[${errcode}]:${errmsg || "rejected"}`);
  }
  return {
    picked: false,
    reason:
      failureDetails.length > 0
        ? `Yeastar call answer endpoints rejected: ${failureDetails.join(" | ")}`
        : "Yeastar call answer endpoints did not accept request",
  };
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

async function getTokenForYeastarDetailed(
  credentials: Record<string, any>,
  options?: { allowAccessUserpass?: boolean }
): Promise<{
  token: string | null;
  mode?: "userpass" | "client" | "access_userpass";
  reason?: string;
}> {
  const allowAccessUserpass = options?.allowAccessUserpass ?? true;
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return { token: null, reason: "Missing Yeastar API base URL/apiPath" };
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
  const clientId = String(credentials.clientId ?? credentials.client_id ?? accessId ?? "").trim();
  const clientSecret = String(
    credentials.clientSecret ?? credentials.client_secret ?? accessKey ?? ""
  ).trim();
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);

  const candidates: Array<{
    mode: "userpass" | "client" | "access_userpass";
    payload: Record<string, string>;
  }> = [];
  const hasApiUserCreds = username && password;
  const hasClientCreds = clientId && clientSecret;
  const hasSdkAccessCreds = accessId && accessKey;

  // For PBX control/query APIs, prefer API user/client credentials.
  // SDK AccessID/AccessKey is only used as fallback when API credentials are not configured.
  if (hasApiUserCreds) {
    candidates.push({
      mode: "userpass",
      payload: { user_agent: userAgent, username, password },
    });
  }
  if (hasClientCreds) {
    candidates.push({
      mode: "client",
      payload: { user_agent: userAgent, client_id: clientId, client_secret: clientSecret },
    });
  }
  if (hasSdkAccessCreds && allowAccessUserpass) {
    candidates.push({
      mode: "access_userpass",
      payload: { user_agent: userAgent, username: accessId, password: accessKey },
    });
  }
  if (!candidates.length) {
    return {
      token: null,
      reason: "Missing Yeastar credentials (need username/password or clientId/clientSecret)",
    };
  }

  for (const candidate of candidates) {
    const identifier =
      candidate.mode === "client"
        ? clientId
        : candidate.mode === "access_userpass"
        ? accessId
        : username;
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
    const cached = yeastarTokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + YEASTAR_TOKEN_REFRESH_BUFFER_MS) {
      return { token: cached.token, mode: candidate.mode };
    }
  }

  const failures: string[] = [];
  for (const candidate of candidates) {
    const identifier =
      candidate.mode === "client"
        ? clientId
        : candidate.mode === "access_userpass"
        ? accessId
        : username;
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
    const retryAt = Number(yeastarTokenBackoffUntil.get(cacheKey) ?? 0);
    if (retryAt > Date.now()) {
      failures.push(`${candidate.mode}:backoff_active`);
      continue;
    }
    const tokenRes = await requestJson({
      url: `${base}/get_token`,
      method: "POST",
      body: candidate.payload,
      sslVerify,
      headers: { "User-Agent": userAgent },
    });
    const token = String(tokenRes.json?.access_token ?? "").trim();
    const errcode = Number(tokenRes.json?.errcode ?? -1);
    if (tokenRes.ok && errcode === 0 && token) {
      const expiresInSec = Number(tokenRes.json?.expires_in ?? 1800);
      const expiresAtMs =
        Date.now() + (Number.isFinite(expiresInSec) ? Math.max(expiresInSec, 120) * 1000 : 1800_000);
      yeastarTokenCache.set(cacheKey, { token, expiresAtMs });
      yeastarTokenBackoffUntil.delete(cacheKey);
      return { token, mode: candidate.mode };
    }
    const errmsg = String(tokenRes.json?.errmsg ?? tokenRes.error ?? `http_${tokenRes.status}`).trim();
    if (/max limitation exceeded/i.test(errmsg)) {
      yeastarTokenBackoffUntil.set(cacheKey, Date.now() + YEASTAR_TOKEN_MAX_LIMIT_BACKOFF_MS);
    }
    failures.push(`${candidate.mode}:${errmsg || "token_failed"}`);
  }

  return { token: null, reason: failures.join(" | ") || "Yeastar token request failed" };
}

async function getTokenForYeastar(credentials: Record<string, any>): Promise<string | null> {
  const result = await getTokenForYeastarDetailed(credentials);
  return result.token;
}

type RecordingResolveHints = {
  fromNumber: string | null;
  toNumber: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
};

async function getRecordingResolveHints(args: {
  providerCallId: string;
  companyId?: string | null;
}): Promise<RecordingResolveHints> {
  const sql = getSql();
  const rows = await sql<
    {
      from_number: string | null;
      to_number: string | null;
      started_at: string | null;
      ended_at: string | null;
      created_at: string | null;
    }[]
  >`
    SELECT
      from_number,
      to_number,
      started_at::text,
      ended_at::text,
      created_at::text
    FROM call_sessions
    WHERE provider_call_id = ${args.providerCallId}
      ${
        args.companyId
          ? sql`AND (company_id = ${args.companyId} OR company_id IS NULL)`
          : sql``
      }
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = ((rows as any).rows ?? rows)?.[0];
  const startedAtRaw = String(row?.started_at ?? row?.created_at ?? "").trim();
  const endedAtRaw = String(row?.ended_at ?? "").trim();
  const startedAt = startedAtRaw ? new Date(startedAtRaw) : null;
  const endedAt = endedAtRaw ? new Date(endedAtRaw) : null;
  return {
    fromNumber: normalizeMaybePhone(row?.from_number ?? null),
    toNumber: normalizeMaybePhone(row?.to_number ?? null),
    startedAt: startedAt && Number.isFinite(startedAt.getTime()) ? startedAt : null,
    endedAt: endedAt && Number.isFinite(endedAt.getTime()) ? endedAt : null,
  };
}

function flattenObjects(input: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const queue: unknown[] = [input];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }
    const rec = current as Record<string, unknown>;
    out.push(rec);
    for (const value of Object.values(rec)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return out;
}

function parseDateLoose(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    const ms = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
    const d = new Date(ms);
    if (Number.isFinite(d.getTime())) return d;
  }
  const direct = new Date(raw);
  if (Number.isFinite(direct.getTime())) return direct;
  const m = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] ?? "0");
    const d = new Date(year, month - 1, day, hour, minute, second);
    if (Number.isFinite(d.getTime())) return d;
  }
  return null;
}

function formatYeastarDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()} ${pad(
    value.getHours()
  )}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
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
  // Yeastar often returns file name only in `record_file`.
  return `${origin}/files/${encodeURIComponent(value)}`;
}

function extractRecordingFromObject(rec: Record<string, unknown>): {
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
  callId?: string;
  fromNumber?: string;
  toNumber?: string;
  at?: Date | null;
} | null {
  const recordingUrlRaw = findFirstDeep(rec, [
    "recording_url",
    "record_url",
    "record_file",
    "record_file_url",
    "record_path",
    "recording_path",
    "monitor_record",
    "download_url",
    "play_url",
    "recordingUrl",
    "url",
  ]);
  const recordingIdRaw = findFirstDeep(rec, [
    "recording_id",
    "record_id",
    "recordingId",
    "record_uuid",
    "record_file_id",
    "id",
    "uuid",
  ]);
  const recordingDurationRaw = findFirstDeep(rec, [
    "recording_duration",
    "record_duration",
    "recordingDuration",
    "duration",
    "call_duration",
  ]);
  const callIdRaw = findFirstDeep(rec, ["call_id", "callid", "linkedid", "linked_id", "uniqueid"]);
  const fileRaw = findFirstDeep(rec, ["file", "file_name", "filename", "record_file"]);
  const fromRaw = findFirstDeep(rec, ["from", "call_from", "from_number", "caller", "caller_number", "src"]);
  const toRaw = findFirstDeep(rec, ["to", "call_to", "to_number", "called_number", "callee", "dst", "dnis"]);
  const atRaw = findFirstDeep(rec, ["time", "start_time", "created_at", "record_time", "recording_time", "date"]);

  const fileName = fileRaw ? String(fileRaw).trim() : "";
  const callIdFromFile = (() => {
    // Yeastar recording/list often stores call id in filename: ...-1773146999.89222-...
    const match = fileName.match(/-(\d+\.\d+)-/);
    return match?.[1] ?? "";
  })();

  const recordingUrl = recordingUrlRaw ? String(recordingUrlRaw).trim() : "";
  const recordingId = recordingIdRaw ? String(recordingIdRaw).trim() : "";
  if (!recordingUrl && !recordingId && !fileName) return null;

  const duration = Number(recordingDurationRaw);
  return {
    recordingUrl: recordingUrl || fileName || undefined,
    recordingId: recordingId || undefined,
    recordingDurationSeconds: Number.isFinite(duration) ? duration : undefined,
    callId: callIdRaw ? String(callIdRaw).trim() : callIdFromFile || undefined,
    fromNumber: normalizeMaybePhone(fromRaw ? String(fromRaw) : null) ?? undefined,
    toNumber: normalizeMaybePhone(toRaw ? String(toRaw) : null) ?? undefined,
    at: parseDateLoose(atRaw),
  };
}

function scoreRecordingCandidate(
  candidate: ReturnType<typeof extractRecordingFromObject>,
  providerCallId: string,
  hints: RecordingResolveHints
): number {
  if (!candidate) return -1;
  let score = 0;
  if (candidate.callId && candidate.callId === providerCallId) score += 100;
  if (hints.fromNumber && candidate.fromNumber && hints.fromNumber === candidate.fromNumber) score += 40;
  if (hints.toNumber && candidate.toNumber && hints.toNumber === candidate.toNumber) score += 20;

  const hintStartMs = hints.startedAt?.getTime() ?? null;
  const hintEndMs = hints.endedAt?.getTime() ?? null;
  const atMs = candidate.at?.getTime() ?? null;
  if (atMs && hintStartMs) {
    const diffStart = Math.abs(atMs - hintStartMs);
    if (diffStart <= 2 * 60_000) score += 35;
    else if (diffStart <= 10 * 60_000) score += 15;
  }
  if (atMs && hintEndMs) {
    const diffEnd = Math.abs(atMs - hintEndMs);
    if (diffEnd <= 2 * 60_000) score += 20;
    else if (diffEnd <= 10 * 60_000) score += 8;
  }

  // Accept likely match if we have only one signal (from/time) or exact call id.
  return score;
}

async function resolveYeastarRecordingFromFallbackApis(args: {
  base: string;
  token: string;
  userAgent: string;
  sslVerify: boolean;
  providerCallId: string;
  integrationId: string;
  tokenMode?: string;
  attempt: number;
  hints: RecordingResolveHints;
}): Promise<{
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
} | null> {
  const endpoints: Array<{ path: string; isList: boolean }> = [
    { path: "recording/query", isList: false },
    { path: "recording/list", isList: true },
    { path: "record/query", isList: false },
    { path: "record/list", isList: true },
    { path: "cdr/query", isList: false },
    { path: "cdr/list", isList: true },
  ];
  const startedAtSec = args.hints.startedAt
    ? Math.floor(args.hints.startedAt.getTime() / 1000)
    : null;
  const endedAtSec = args.hints.endedAt
    ? Math.floor(args.hints.endedAt.getTime() / 1000)
    : startedAtSec
    ? startedAtSec + 6 * 60
    : null;

  let best:
    | { score: number; recordingUrl?: string; recordingId?: string; recordingDurationSeconds?: number }
    | null = null;

  for (const endpoint of endpoints) {
    const buildBaseQuery = () => {
      const q = new URLSearchParams();
      q.set("access_token", args.token);
      q.set("call_id", args.providerCallId);
      q.set("id", args.providerCallId);
      if (args.hints.fromNumber) {
        q.set("call_from", args.hints.fromNumber);
        q.set("from_number", args.hints.fromNumber);
        q.set("from", args.hints.fromNumber);
      }
      if (args.hints.toNumber) {
        q.set("call_to", args.hints.toNumber);
        q.set("to_number", args.hints.toNumber);
        q.set("to", args.hints.toNumber);
      }
      if (startedAtSec) q.set("start_time", String(startedAtSec - 5 * 60));
      if (endedAtSec) q.set("end_time", String(endedAtSec + 5 * 60));
      if (args.hints.startedAt) q.set("start_time_str", formatYeastarDateTime(args.hints.startedAt));
      if (args.hints.endedAt) q.set("end_time_str", formatYeastarDateTime(args.hints.endedAt));
      return q;
    };

    const queryPlans: URLSearchParams[] = [];
    const baseQ = buildBaseQuery();
    queryPlans.push(baseQ);
    if (endpoint.isList) {
      const sortQ = new URLSearchParams(baseQ.toString());
      // Yeastar list APIs accept order_by as direction (asc/desc) and
      // sort_by as one of documented fields (e.g. id/time), not "timestamp".
      sortQ.set("sort", "desc");
      sortQ.set("order", "desc");
      sortQ.set("sort_by", "id");
      sortQ.set("order_by", "desc");
      sortQ.set("reverse", "1");
      queryPlans.push(sortQ);
    }

    for (const plan of queryPlans) {
      const pages = endpoint.isList ? [1, 2, 3, 4] : [1];
      for (const page of pages) {
        const q = new URLSearchParams(plan.toString());
        q.set("page", String(page));
        q.set("page_size", "100");

        const url = `${args.base}/${endpoint.path}?${q.toString()}`;
        const res = await requestJson({
          url,
          method: "GET",
          sslVerify: args.sslVerify,
          headers: {
            "User-Agent": args.userAgent,
            Authorization: args.token,
          },
          timeoutMs: 5000,
        });

        const errcode = Number(res.json?.errcode ?? -1);
        const errmsg = String(res.json?.errmsg ?? res.error ?? "").trim();
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "recording_resolve_fallback_query",
          providerCallId: args.providerCallId,
          integrationId: args.integrationId,
          tokenMode: args.tokenMode ?? null,
          attempt: args.attempt,
          endpoint: endpoint.path,
          page,
          status: res.status,
          errcode,
          errmsg: errmsg || null,
          raw:
            endpoint.path === "recording/list" || endpoint.path === "cdr/list"
              ? String(res.rawBody ?? "").slice(0, 4000)
              : undefined,
        });

        if (!res.ok) continue;
        if (Number.isFinite(errcode) && errcode !== 0) continue;

        const nodes = flattenObjects(res.json);
        for (const node of nodes) {
          const extractedRaw = extractRecordingFromObject(node);
          if (!extractedRaw) continue;
          const extracted = {
            ...extractedRaw,
            recordingUrl: normalizeYeastarRecordingUrl(extractedRaw.recordingUrl, args.base) || undefined,
          };
          const score = scoreRecordingCandidate(extracted, args.providerCallId, args.hints);
          if (score < 30) continue;
          if (!best || score > best.score) {
            best = { score, ...extracted };
          }
        }

        if (best && best.score >= 100) break;
      }
      if (best && best.score >= 100) break;
    }
    if (best && best.score >= 100) break;
  }

  if (!best) return null;
  return {
    recordingUrl: best.recordingUrl,
    recordingId: best.recordingId,
    recordingDurationSeconds: best.recordingDurationSeconds,
  };
}

async function resolveYeastarRecordingForCall(args: {
  providerCallId: string;
  companyId?: string | null;
}): Promise<{
  recordingUrl?: string;
  recordingId?: string;
  recordingDurationSeconds?: number;
  integrationCompanyId?: string | null;
} | null> {
  const provider = "yeastar";
  const hints = await getRecordingResolveHints(args).catch(() => ({
    fromNumber: null,
    toNumber: null,
    startedAt: null,
    endedAt: null,
  }));
  await logWebhookLine({
    ts: new Date().toISOString(),
    stage: "recording_resolve_start",
    providerCallId: args.providerCallId,
    companyId: args.companyId ?? null,
    fromNumber: hints.fromNumber ?? null,
    toNumber: hints.toNumber ?? null,
    startedAt: hints.startedAt?.toISOString() ?? null,
    endedAt: hints.endedAt?.toISOString() ?? null,
  });
  const sql = getSql();
  const rows = await sql<
    { id: string; credentials: Record<string, unknown> | null; company_id: string | null }[]
  >`
    SELECT id, credentials, company_id
    FROM integration_dialers
    WHERE provider = ${provider}
      AND is_active = TRUE
      ${
        args.companyId
          ? sql`AND (company_id = ${args.companyId} OR company_id IS NULL)`
          : sql``
      }
    ORDER BY CASE WHEN company_id IS NULL THEN 1 ELSE 0 END, created_at DESC
    LIMIT 20
  `;
  const candidates = ((rows as any).rows ?? rows) as Array<{
    id: string;
    credentials: Record<string, unknown> | null;
    company_id: string | null;
  }>;
  if (!candidates.length) {
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "recording_resolve_no_candidates",
      providerCallId: args.providerCallId,
      companyId: args.companyId ?? null,
    });
    return null;
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const integration of candidates) {
    const credentials =
      integration.credentials && typeof integration.credentials === "object"
        ? integration.credentials
        : {};
    const base = normalizedBaseUrl(
      typeof credentials.apiBaseUrl === "string" ? credentials.apiBaseUrl : undefined,
      typeof credentials.apiPath === "string" ? credentials.apiPath : undefined
    );
    if (!base) continue;
    const tokenResult = await getTokenForYeastarDetailed(credentials, {
      // CDR/recording APIs should use API credentials, not Linkus SDK access credentials.
      allowAccessUserpass: false,
    });
    const token = tokenResult.token;
    if (!token) {
      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "recording_resolve_token_failed",
        providerCallId: args.providerCallId,
        integrationId: integration.id,
        tokenMode: tokenResult.mode ?? null,
        reason: tokenResult.reason ?? null,
      });
      continue;
    }

    const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
    const sslVerify = toBool(credentials.sslVerify, true);
    for (let attempt = 0; attempt < YEASTAR_RECORDING_QUERY_ATTEMPTS; attempt += 1) {
      const queryUrl = `${base}/call/query?access_token=${encodeURIComponent(token)}&call_id=${encodeURIComponent(
        args.providerCallId
      )}`;
      const queryRes = await requestJson({
        url: queryUrl,
        method: "GET",
        sslVerify,
        headers: {
          "User-Agent": userAgent,
          Authorization: token,
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
      if (recordingUrl || recordingId) {
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "recording_resolve_query",
          providerCallId: args.providerCallId,
          integrationId: integration.id,
          tokenMode: tokenResult.mode ?? null,
          attempt: attempt + 1,
          found: true,
        });
        return {
          recordingUrl: recordingUrl || undefined,
          recordingId: recordingId || undefined,
          recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
            ? recordingDurationSeconds
            : undefined,
          integrationCompanyId: integration.company_id ?? null,
        };
      }

      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "recording_resolve_query",
        providerCallId: args.providerCallId,
        integrationId: integration.id,
        tokenMode: tokenResult.mode ?? null,
        attempt: attempt + 1,
        found: false,
        status: queryRes.status,
        errcode: Number(queryRes.json?.errcode ?? -1),
        errmsg: String(queryRes.json?.errmsg ?? queryRes.error ?? "").trim() || null,
      });

      if (attempt === YEASTAR_RECORDING_QUERY_ATTEMPTS - 1) {
        const fallbackResolved = await resolveYeastarRecordingFromFallbackApis({
          base,
          token,
          userAgent,
          sslVerify,
          providerCallId: args.providerCallId,
          integrationId: integration.id,
          tokenMode: tokenResult.mode ?? null,
          attempt: attempt + 1,
          hints,
        }).catch(() => null);
        if (fallbackResolved?.recordingUrl || fallbackResolved?.recordingId) {
          await logWebhookLine({
            ts: new Date().toISOString(),
            stage: "recording_resolve_fallback_hit",
            providerCallId: args.providerCallId,
            integrationId: integration.id,
            tokenMode: tokenResult.mode ?? null,
            attempt: attempt + 1,
            recordingUrl: fallbackResolved.recordingUrl ?? null,
            recordingId: fallbackResolved.recordingId ?? null,
          });
          return { ...fallbackResolved, integrationCompanyId: integration.company_id ?? null };
        }
      }

      if (attempt < YEASTAR_RECORDING_QUERY_ATTEMPTS - 1) await wait(YEASTAR_RECORDING_QUERY_WAIT_MS);
    }
  }

  await logWebhookLine({
    ts: new Date().toISOString(),
    stage: "recording_resolve_all_candidates_miss",
    providerCallId: args.providerCallId,
    companyId: args.companyId ?? null,
    triedCandidates: candidates.length,
  });
  return null;
}

async function scheduleDeferredYeastarRecordingResolve(args: {
  providerCallId: string;
  providerKey: string;
  companyId?: string | null;
  status: string;
}) {
  const key = `${args.providerKey}|${args.companyId ?? ""}|${args.providerCallId}`;
  const now = Date.now();
  const seenAt = yeastarRecordingRetrySeen.get(key);
  if (seenAt && now - seenAt < 10 * 60_000) return;
  yeastarRecordingRetrySeen.set(key, now);

  for (const delayMs of YEASTAR_RECORDING_DEFERRED_DELAYS_MS) {
    setTimeout(async () => {
      try {
        const resolved = await resolveYeastarRecordingForCall({
          providerCallId: args.providerCallId,
          companyId: args.companyId ?? null,
        });
        if (resolved?.recordingUrl || resolved?.recordingId) {
          const effectiveCompanyId = args.companyId ?? resolved.integrationCompanyId ?? null;
          await CallCenter.handleDialerWebhookUpdate({
            providerKey: args.providerKey,
            providerCallId: args.providerCallId,
            status: args.status,
            scope: effectiveCompanyId ? "company" : "global",
            companyId: effectiveCompanyId ?? undefined,
            recordingUrl: resolved.recordingUrl,
            recordingId: resolved.recordingId,
            recordingDurationSeconds: resolved.recordingDurationSeconds,
          });
          await logWebhookLine({
            ts: new Date().toISOString(),
            stage: "recording_resolved_deferred",
            providerKey: args.providerKey,
            providerCallId: args.providerCallId,
            companyId: effectiveCompanyId,
            delayMs,
            recordingUrl: resolved.recordingUrl ?? null,
            recordingId: resolved.recordingId ?? null,
            recordingDurationSeconds: resolved.recordingDurationSeconds ?? null,
          });
          return;
        }
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "recording_resolved_deferred_miss",
          providerKey: args.providerKey,
          providerCallId: args.providerCallId,
          companyId: args.companyId ?? null,
          delayMs,
        });
      } catch (error: any) {
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "recording_resolved_deferred_error",
          providerKey: args.providerKey,
          providerCallId: args.providerCallId,
          companyId: args.companyId ?? null,
          delayMs,
          error: error?.message ?? String(error),
        });
      }
    }, delayMs);
  }
}

async function resolveYeastarLiveCaller(args: {
  providerCallId: string;
  toNumber?: string;
  companyId?: string;
}): Promise<{ fromNumber: string | null; toNumber: string | null } | null> {
  const provider = "yeastar";
  const sql = getSql();
  const rows = await sql<
    { id: string; credentials: Record<string, unknown> | null; company_id: string | null }[]
  >`
    SELECT id, credentials, company_id
    FROM integration_dialers
    WHERE provider = ${provider}
      AND is_active = TRUE
      ${
        args.companyId
          ? sql`AND (company_id = ${args.companyId} OR company_id IS NULL)`
          : sql``
      }
    ORDER BY CASE WHEN company_id IS NULL THEN 1 ELSE 0 END, created_at DESC
    LIMIT 20
  `;
  const candidates = ((rows as any).rows ?? rows) as Array<{
    id: string;
    credentials: Record<string, unknown> | null;
    company_id: string | null;
  }>;
  if (!candidates.length) return null;

  for (const integration of candidates) {
    const credentials =
      integration.credentials && typeof integration.credentials === "object"
        ? integration.credentials
        : {};
    const base = normalizedBaseUrl(
      typeof credentials.apiBaseUrl === "string" ? credentials.apiBaseUrl : undefined,
      typeof credentials.apiPath === "string" ? credentials.apiPath : undefined
    );
    if (!base) continue;
    const token = await getTokenForYeastar(credentials);
    if (!token) continue;

    const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
    const sslVerify = toBool(credentials.sslVerify, true);
    const queryUrl = `${base}/call/query?access_token=${encodeURIComponent(token)}&call_id=${encodeURIComponent(
      args.providerCallId
    )}`;
    const queryRes = await requestJson({
      url: queryUrl,
      method: "GET",
      sslVerify,
      headers: {
        "User-Agent": userAgent,
        Authorization: token,
      },
      timeoutMs: 5000,
    });
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "live_fallback_query",
      providerCallId: args.providerCallId,
      integrationId: integration.id,
      status: queryRes.status,
      ok: queryRes.ok,
      raw: String(queryRes.rawBody ?? "").slice(0, 2000),
    });

    const data = Array.isArray(queryRes.json?.data) ? queryRes.json.data : [];
    const call = data[0];
    const members = Array.isArray(call?.members) ? call.members : [];
    const toHint = normalizeMaybePhone(args.toNumber ?? null);

    const candidatesFrom: string[] = [];
    const candidatesTo: string[] = [];
    const pushCandidate = (bucket: string[], value: unknown) => {
      const normalized = normalizeMaybePhone(value as string);
      if (!normalized) return;
      if (!isLikelyExternalNumber(normalized)) return;
      if (toHint && normalized === toHint) return;
      bucket.push(normalized);
    };

    for (const member of members) {
      const sectionList = [member?.inbound, member?.outbound, member?.external, member?.trunk, member];
      for (const section of sectionList) {
        if (!section || typeof section !== "object") continue;
        const rec = section as Record<string, unknown>;
        pushCandidate(candidatesFrom, rec.from);
        pushCandidate(candidatesFrom, rec.call_from);
        pushCandidate(candidatesFrom, rec.caller);
        pushCandidate(candidatesFrom, rec.caller_number);
        pushCandidate(candidatesFrom, rec.caller_id_number);
        pushCandidate(candidatesTo, rec.to);
        pushCandidate(candidatesTo, rec.call_to);
        pushCandidate(candidatesTo, rec.called_number);
        pushCandidate(candidatesTo, rec.did_number);
      }
    }

    // broad fallback over full response: different PBX versions shape fields differently
    const fallbackFromRaw = findFirstDeep(queryRes.json, [
      "call_from",
      "from_number",
      "caller_number",
      "caller_id_number",
      "cid_num",
      "ani",
      "src",
    ]);
    const fallbackToRaw = findFirstDeep(queryRes.json, [
      "call_to",
      "to_number",
      "called_number",
      "did_number",
      "dst",
      "dnis",
    ]);
    const fallbackFrom = normalizeMaybePhone(
      typeof fallbackFromRaw === "string" || typeof fallbackFromRaw === "number"
        ? String(fallbackFromRaw)
        : null
    );
    const fallbackTo = normalizeMaybePhone(
      typeof fallbackToRaw === "string" || typeof fallbackToRaw === "number"
        ? String(fallbackToRaw)
        : null
    );
    if (isLikelyExternalNumber(fallbackFrom) || isLikelyExternalNumber(fallbackTo)) {
      return {
        fromNumber: isLikelyExternalNumber(fallbackFrom) ? fallbackFrom : null,
        toNumber: isLikelyExternalNumber(fallbackTo) ? fallbackTo : null,
      };
    }

    const fromNumber = candidatesFrom[0] ?? null;
    const toNumber = candidatesTo[0] ?? null;
    if (fromNumber || toNumber) {
      return { fromNumber, toNumber };
    }
  }

  return null;
}

type ParamsCtx =
  | { params: { providerKey: string } }
  | { params: Promise<{ providerKey: string }> };

async function parsePayload(req: NextRequest): Promise<{
  payload: any;
  rawText: string;
  contentType: string;
}> {
  const contentType = req.headers.get("content-type") || "";
  const text = await req.text().catch(() => "");
  if (!text) return { payload: {}, rawText: "", contentType };
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return {
        payload: Object.fromEntries(new URLSearchParams(text)),
        rawText: text,
        contentType,
      };
    }
    return { payload: JSON.parse(text), rawText: text, contentType };
  } catch {
    return { payload: {}, rawText: text, contentType };
  }
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

function toScalarString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const out = String(value).trim();
  if (!out || out.toLowerCase() === "[object object]") return undefined;
  return out ? out : undefined;
}

function mapGenericWebhook(providerKey: string, payload: any): DialerWebhookUpdate | null {
  const providerCallId =
    payload.CallSid || payload.call_sid || payload.callId || payload.id || payload.call_id || null;
  if (!providerCallId) return null;

  const status = payload.CallStatus || payload.call_status || payload.status;
  const startStr = payload.StartTime || payload.start_time;
  const endStr = payload.EndTime || payload.end_time;
  const startedAt = startStr ? new Date(startStr) : undefined;
  const endedAt = endStr ? new Date(endStr) : undefined;
  const durationRaw = payload.CallDuration ?? payload.duration;
  const durationSeconds = durationRaw !== undefined ? Number(durationRaw) : undefined;
  const recordingUrl = payload.RecordingUrl || payload.recording_url;
  const recordingId = payload.RecordingSid || payload.recording_id;
  const recordingDurationSeconds =
    payload.RecordingDuration !== undefined ? Number(payload.RecordingDuration) : undefined;
  const directionRaw = payload.direction ?? payload.call_direction;
  const direction =
    String(directionRaw ?? "").toLowerCase().includes("in") ? "inbound" : "outbound";
  const fromNumber = payload.From ?? payload.from ?? payload.from_number ?? payload.caller_number ?? null;
  const toNumber = payload.To ?? payload.to ?? payload.to_number ?? payload.callee_number ?? null;
  const companyIdRaw = payload.companyId ?? payload.company_id ?? null;
  const branchIdRaw = payload.branchId ?? payload.branch_id ?? null;

  return {
    providerKey,
    providerCallId,
    status: status ?? "",
    direction,
    fromNumber: fromNumber ? String(fromNumber) : undefined,
    toNumber: toNumber ? String(toNumber) : undefined,
    scope: companyIdRaw ? "company" : "global",
    companyId: companyIdRaw ? String(companyIdRaw) : undefined,
    branchId: branchIdRaw ? String(branchIdRaw) : undefined,
    startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined,
    endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : undefined,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    recordingUrl: recordingUrl ?? undefined,
    recordingId: recordingId ?? undefined,
    recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
      ? recordingDurationSeconds
      : undefined,
    rawPayload: payload,
  };
}

function mapYeastarWebhook(providerKey: string, payload: any): DialerWebhookUpdate | null {
  const msgRaw = typeof payload?.msg === "string" ? payload.msg : null;
  let msgObj: Record<string, unknown> | null = null;
  if (msgRaw) {
    try {
      msgObj = JSON.parse(msgRaw) as Record<string, unknown>;
    } catch {
      msgObj = null;
    }
  }
  const source = msgObj ? { ...payload, msgParsed: msgObj } : payload;

  const providerCallId = findFirstDeep(payload, [
    "call_id",
    "callid",
    "unique_id",
    "uniqueid",
    "id",
    "callId",
  ]);
  if (!providerCallId) return null;

  const statusValue = findFirstDeep(source, [
    "status",
    "call_status",
    "event",
    "event_name",
    "eventType",
    "event_type",
  ]);
  const startedAtRaw = findFirstDeep(source, [
    "started_at",
    "start_time",
    "startTime",
    "ring_time",
    "time_start",
  ]);
  const endedAtRaw = findFirstDeep(source, ["ended_at", "end_time", "endTime", "hangup_time"]);
  const durationRaw = findFirstDeep(source, [
    "duration",
    "duration_seconds",
    "talk_duration",
    "billsec",
    "call_duration",
  ]);
  const recordingUrl = findFirstDeep(source, ["recording_url", "record_url", "recordingUrl", "url"]);
  const recordingId = findFirstDeep(source, ["recording_id", "record_id", "recordingId"]);
  const recordingDurationRaw = findFirstDeep(source, [
    "recording_duration",
    "record_duration",
    "recordingDuration",
  ]);

  const startedAt = startedAtRaw ? new Date(String(startedAtRaw)) : undefined;
  const endedAt = endedAtRaw ? new Date(String(endedAtRaw)) : undefined;
  const durationSeconds = durationRaw !== undefined ? Number(durationRaw) : undefined;
  const recordingDurationSeconds =
    recordingDurationRaw !== undefined ? Number(recordingDurationRaw) : undefined;
  const fromRaw = findFirstDeep(source, [
    "from_number",
    "caller_number",
    "caller_id_number",
    "cid_number",
    "cid_num",
    "callerid_num",
    "inbound_number",
    "external_number",
    "call_from",
    "caller",
    "from",
    "callerid",
    "caller_id",
    "caller_num",
    "src",
    "ani",
  ]);
  const toRaw = findFirstDeep(source, [
    "to_number",
    "callee_number",
    "call_to",
    "callee",
    "to",
    "called_number",
    "called",
    "callee_num",
    "dst",
    "dnis",
  ]);
  const explicitExtensionRaw = findFirstDeep(msgObj ?? source, ["extension"]);
  const toFromMembers =
    Array.isArray((msgObj as any)?.members) &&
    (msgObj as any).members.length > 0 &&
    (msgObj as any).members[0]?.extension?.number
      ? String((msgObj as any).members[0].extension.number)
      : undefined;
  const msgDirectionRaw = findFirstDeep(msgObj ?? {}, ["direction", "call_direction", "type"]);
  const payloadDirectionRaw = findFirstDeep(payload, ["direction", "call_direction"]);
  const companyIdRaw = findFirstDeep(source, ["companyId", "company_id"]);
  const branchIdRaw = findFirstDeep(source, ["branchId", "branch_id"]);
  const directionNormalized = String(msgDirectionRaw ?? payloadDirectionRaw ?? "").toLowerCase();

  const rawStatus = String(statusValue ?? "").trim();
  const yeastarType = Number(payload?.type ?? msgObj?.type ?? NaN);
  const operation = String(findFirstDeep(source, ["operation"]) ?? "").toLowerCase();
  const hasRingMember = /"member_status":"RING"/i.test(msgRaw ?? "");
  const hasAlertMember = /"member_status":"ALERT"/i.test(msgRaw ?? "");
  const hasAnswerMember = /"member_status":"ANSWER"/i.test(msgRaw ?? "");
  const hasByeMember = /"member_status":"BYE"/i.test(msgRaw ?? "");
  const answerExt =
    Array.isArray((msgObj as any)?.members)
      ? ((msgObj as any).members.find((m: any) => m?.extension?.member_status === "ANSWER")
          ?.extension?.number as string | undefined)
      : undefined;
  const msgCallType = String(findFirstDeep(msgObj ?? {}, ["type"]) ?? "").toLowerCase();

  let direction: "inbound" | "outbound" = "inbound";
  if (msgCallType.includes("outbound") || directionNormalized.includes("out")) {
    direction = "outbound";
  } else if (
    // Yeastar P-Series PCIR (type 30020): "External" means extension→PSTN = outbound
    msgCallType === "external"
  ) {
    direction = "outbound";
  } else if (
    msgCallType.includes("inbound") ||
    directionNormalized.includes("in") ||
    [30011, 30016].includes(yeastarType)
  ) {
    direction = "inbound";
  }

  // Fallback heuristic for Yeastar type 30020 events with no explicit direction field:
  // if fromNumber is a short internal extension (≤5 digits) and toNumber is an external
  // number (≥7 digits), the call was originated by the extension → outbound.
  if (direction === "inbound" && yeastarType === 30020) {
    const fromDigits = String(fromRaw ?? "").replace(/\D+/g, "");
    const toDigits = String(toRaw ?? "").replace(/\D+/g, "");
    if (fromDigits.length <= 5 && toDigits.length >= 7) {
      direction = "outbound";
    }
  }

  let normalizedStatus = rawStatus;
  // Yeastar commonly sends event code 30016 for incoming call request.
  if (rawStatus === "30016" || yeastarType === 30016) {
    normalizedStatus = "incoming";
  } else if (yeastarType === 30011 && hasAnswerMember) {
    normalizedStatus = "ANSWERED";
  } else if (yeastarType === 30011 && hasAlertMember) {
    normalizedStatus = "ringing";
  } else if (yeastarType === 30011 && hasRingMember) {
    normalizedStatus = "ringing";
  } else if (yeastarType === 30011 && hasByeMember) {
    normalizedStatus = "completed";
  } else if (yeastarType === 30020 && operation === "call_start") {
    // Yeastar can emit per-extension call_start events for a single inbound call.
    // Keep this as non-ringing to avoid spawning duplicate popups.
    normalizedStatus = "initiated";
  } else if (yeastarType === 30020 && operation === "call_over") {
    normalizedStatus = "completed";
  } else if (yeastarType === 30020 && operation === "call_answer") {
    normalizedStatus = "ANSWERED";
  } else if (/incoming\s*call\s*request/i.test(rawStatus)) {
    normalizedStatus = "incoming";
  } else if (/ring|incoming/i.test(rawStatus)) {
    normalizedStatus = "ringing";
  }

  return {
    providerKey,
    providerCallId: String(providerCallId),
    status: normalizedStatus,
    direction,
    fromNumber: toScalarString(fromRaw),
    toNumber:
      toScalarString(answerExt) ??
      toScalarString(explicitExtensionRaw) ??
      toScalarString(toRaw) ??
      toScalarString(toFromMembers),
    scope: companyIdRaw ? "company" : "global",
    companyId: companyIdRaw ? String(companyIdRaw) : undefined,
    branchId: branchIdRaw ? String(branchIdRaw) : undefined,
    startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined,
    endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : undefined,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
    recordingUrl: recordingUrl ? String(recordingUrl) : undefined,
    recordingId: recordingId ? String(recordingId) : undefined,
    recordingDurationSeconds: Number.isFinite(recordingDurationSeconds)
      ? recordingDurationSeconds
      : undefined,
    rawPayload: payload,
  };
}

function isUnknownPartyNumber(value: string | undefined | null): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "unknown" || normalized === "null";
}

function shouldIgnoreYeastarAuxEvent(update: DialerWebhookUpdate): {
  ignore: boolean;
  operation?: string;
  type?: number;
} {
  if (update.providerKey.toLowerCase() !== "yeastar") return { ignore: false };
  const payload = (update.rawPayload ?? {}) as Record<string, unknown>;
  const eventType = Number(payload?.type ?? NaN);
  if (eventType !== 30020) return { ignore: false };

  let msg: Record<string, unknown> | null = null;
  const msgRaw = payload?.msg;
  if (typeof msgRaw === "string") {
    try {
      msg = JSON.parse(msgRaw) as Record<string, unknown>;
    } catch {
      msg = null;
    }
  } else if (msgRaw && typeof msgRaw === "object") {
    msg = msgRaw as Record<string, unknown>;
  }

  const operation = String(
    findFirstDeep(msg ?? payload, ["operation", "event", "event_name"]) ?? ""
  ).toLowerCase();
  if (!["call_start", "call_answer", "call_over"].includes(operation)) {
    return { ignore: false };
  }

  const hasKnownFrom = !isUnknownPartyNumber(update.fromNumber ?? null);
  const hasKnownTo = !isUnknownPartyNumber(update.toNumber ?? null);
  if (hasKnownFrom || hasKnownTo) {
    return { ignore: false };
  }

  return { ignore: true, operation, type: eventType };
}

async function handle(providerKey: string, req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());
  const parsed = await parsePayload(req);
  const payload = parsed.payload;
  await logWebhookLine({
    ts: new Date().toISOString(),
    stage: "received",
    providerKey,
    method: req.method,
    url: req.url,
    contentType: parsed.contentType,
    rawBody: parsed.rawText.slice(0, 4000),
    payload,
  });

  // Maintain legacy integration event behavior
  await Dialer.handleDialerWebhook(providerKey, payload, headers);

  // Map payload to CallCenter update
  const update =
    providerKey.toLowerCase() === "yeastar"
      ? mapYeastarWebhook(providerKey, payload)
      : mapGenericWebhook(providerKey, payload);
  if (!update) return;
  update.ringingExtensions = extractRingingExtensionsFromPayload(update.rawPayload);
  const yeastarAuxFilter = shouldIgnoreYeastarAuxEvent(update);
  if (yeastarAuxFilter.ignore) {
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "yeastar_aux_event_ignored",
      providerKey,
      providerCallId: update.providerCallId,
      eventType: yeastarAuxFilter.type ?? null,
      operation: yeastarAuxFilter.operation ?? null,
      fromNumber: update.fromNumber ?? null,
      toNumber: update.toNumber ?? null,
    });
    return;
  }

  // Fast path: publish inbound ringing popup immediately, before expensive lookups/AI workflow.
  // This removes perceived UI delay while richer updates continue asynchronously below.
  const isInboundRingingFastPath =
    update.direction === "inbound" &&
    /(ring|incoming|initiated)/i.test(String(update.status ?? ""));
  if (isInboundRingingFastPath) {
    publishIncomingPopupEvent({
      id: `${providerKey}-${update.providerCallId}-${Date.now()}`,
      providerCallId: update.providerCallId,
      providerKey,
      direction: "inbound",
      status: update.status,
      fromNumber: update.fromNumber ?? null,
      toNumber: update.toNumber ?? null,
      ringingExtensions: update.ringingExtensions ?? null,
      companyId: update.companyId ?? null,
      branchId: update.branchId ?? null,
      aiText: null,
      pickupHint: null,
      createdAt: new Date().toISOString(),
    });
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "popup_published_fast",
      providerKey,
      providerCallId: update.providerCallId,
      status: update.status,
      companyId: update.companyId ?? null,
      toNumber: update.toNumber ?? null,
      ringingExtensions: update.ringingExtensions ?? null,
    });
  }

  const needsLiveFallback =
    providerKey.toLowerCase() === "yeastar" &&
    update.direction === "inbound" &&
    (!update.fromNumber || !isLikelyExternalNumber(update.fromNumber)) &&
    /(ring|incoming|initiated)/i.test(String(update.status ?? ""));
  if (needsLiveFallback) {
    const resolved = await resolveYeastarLiveCaller({
      providerCallId: update.providerCallId,
      toNumber: update.toNumber,
      companyId: update.companyId,
    }).catch(() => null);
    if (resolved?.fromNumber) update.fromNumber = resolved.fromNumber;
    if ((!update.toNumber || update.toNumber.toLowerCase() === "unknown") && resolved?.toNumber) {
      update.toNumber = resolved.toNumber;
    }
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "live_fallback",
      providerKey,
      providerCallId: update.providerCallId,
      resolvedFromNumber: resolved?.fromNumber ?? null,
      resolvedToNumber: resolved?.toNumber ?? null,
    });
  }
  await logWebhookLine({
    ts: new Date().toISOString(),
    stage: "mapped",
    providerKey,
    providerCallId: update.providerCallId,
    direction: update.direction,
    status: update.status,
    companyId: update.companyId ?? null,
    fromNumber: update.fromNumber ?? null,
    toNumber: update.toNumber ?? null,
  });

  // For outbound calls (e.g. placed directly from Linkus), Yeastar payloads carry no companyId.
  // Resolve it from the active integration so the session is stored under the correct company.
  if (!update.companyId && update.direction === "outbound" && providerKey.toLowerCase() === "yeastar") {
    const inferredCompanyId = await resolveCompanyForInbound({
      providerKey: update.providerKey,
      toNumber: update.toNumber ?? null,
      rawPayload: update.rawPayload,
    }).catch(() => null);
    if (inferredCompanyId) {
      update.companyId = inferredCompanyId;
      update.scope = "company";
      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "company_scope_resolved_outbound",
        providerKey,
        providerCallId: update.providerCallId,
        companyId: inferredCompanyId,
      });
    }
  }

  let popupAiText: string | null = null;
  let popupPickupHint: string | null = null;

  const shouldRunInboundAiFlow =
    update.direction === "inbound" &&
    (/(ring|incoming|initiated)/i.test(String(update.status ?? "")) ||
      isLikelyExternalNumber(update.fromNumber ?? null));
  if (shouldRunInboundAiFlow) {
    if (!update.companyId) {
      const inferredCompanyId = await resolveCompanyForInbound({
        providerKey: update.providerKey,
        toNumber: update.toNumber ?? null,
        rawPayload: update.rawPayload,
      }).catch(() => null);
      if (inferredCompanyId) {
        update.companyId = inferredCompanyId;
        update.scope = "company";
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "company_scope_resolved",
          providerKey,
          providerCallId: update.providerCallId,
          companyId: inferredCompanyId,
          toNumber: update.toNumber ?? null,
        });
      }
    }

    const policyEval = await CallAiPolicy.evaluateInboundCallAiPolicy({
      companyId: update.companyId ?? null,
      providerKey: update.providerKey,
      providerCallId: update.providerCallId,
      fromNumber: update.fromNumber ?? null,
      toNumber: update.toNumber ?? null,
      rawPayload: update.rawPayload,
    }).catch(() => ({
      decision: "disabled",
      reason: "Policy evaluation failed",
      mode: "dry_run",
      matchedRule: null,
      details: {},
      policy: null,
    }));

    let liveExec: {
      executed: boolean;
      action: string;
      reason?: string;
      replyText?: string;
      model?: string;
      source?: "company" | "global" | null;
    } | null = null;
    let pickupResult:
      | { picked: boolean; endpoint?: string; reason?: string }
      | null = null;
    let automationWorkflow: Awaited<ReturnType<typeof CallAiWorkflow.runCallAiWorkflow>> | null =
      null;
    const liveExecKey = `${update.providerKey}:${update.providerCallId}:${update.companyId ?? ""}`;
    const companyIdForLive = update.companyId ?? null;
    const canRunOnce =
      policyEval.decision === "allow_ai" &&
      Boolean(companyIdForLive) &&
      shouldRunLiveExecutionOnce(liveExecKey);
    if (
      canRunOnce &&
      update.providerKey.toLowerCase() === "yeastar" &&
      /(ring|incoming|initiated)/i.test(String(update.status ?? ""))
    ) {
      pickupResult = await tryYeastarAutoPickup({
        companyId: companyIdForLive as string,
        providerCallId: update.providerCallId,
        toNumber: update.toNumber ?? null,
        rawPayload: update.rawPayload,
      }).catch((err) => ({
        picked: false,
        reason: err instanceof Error ? err.message : String(err),
      }));
    }

    if (
      policyEval.mode === "live" &&
      canRunOnce
    ) {
      liveExec = await executeLiveInboundAi({
        companyId: companyIdForLive as string,
        providerKey: update.providerKey,
        providerCallId: update.providerCallId,
        fromNumber: update.fromNumber ?? null,
        toNumber: update.toNumber ?? null,
        policy: policyEval.policy ?? null,
      }).catch((err) => ({
        executed: false,
        action: "execution_error",
        reason: err instanceof Error ? err.message : String(err),
      }));
      if (liveExec) {
        liveExec.reason = liveExec.reason
          ? liveExec.reason
          : pickupResult
          ? pickupResult.picked
            ? `pickup_ok:${pickupResult.endpoint ?? "unknown"}`
            : `pickup_failed:${pickupResult.reason ?? "unknown"}`
          : liveExec.reason;
      }
    }

    const allowInquiryAutomation = isLikelyExternalNumber(update.fromNumber ?? null);
    if (policyEval.decision === "allow_ai" && policyEval.policy?.guidance?.automationEnabled) {
      if (!allowInquiryAutomation) {
        await logWebhookLine({
          ts: new Date().toISOString(),
          stage: "ai_workflow_skipped_no_external_caller",
          providerKey,
          providerCallId: update.providerCallId,
          companyId: update.companyId ?? null,
          fromNumber: update.fromNumber ?? null,
          toNumber: update.toNumber ?? null,
        });
      }
    }
    if (
      policyEval.decision === "allow_ai" &&
      policyEval.policy?.guidance?.automationEnabled &&
      allowInquiryAutomation
    ) {
      const simulationMode = Boolean(policyEval.policy?.guidance?.simulationMode);
      if (!update.companyId) {
        automationWorkflow = {
          enabled: true,
          simulationMode,
          currentStage: "inquiry",
          inquiryId: null,
          leadId: null,
          inferredOutcome: null,
          steps: [
            {
              key: "inquiry",
              action: "create_inquiry",
              status: "failed",
              payload: {},
              error: "No company scope for automation workflow",
            },
          ],
        };
      } else {
        automationWorkflow = await CallAiWorkflow.runCallAiWorkflow({
          companyId: update.companyId,
          providerKey: update.providerKey,
          providerCallId: update.providerCallId,
          fromNumber: update.fromNumber ?? null,
          toNumber: update.toNumber ?? null,
          aiReply: liveExec?.replyText ?? null,
          simulationMode,
          inquiryOnly: true,
        }).catch((err) => ({
          enabled: true as const,
          simulationMode,
          currentStage: "inquiry" as const,
          inquiryId: null,
          leadId: null,
          inferredOutcome: null,
          steps: [
            {
              key: "inquiry" as const,
              action: "create_inquiry",
              status: "failed" as const,
              payload: {},
              error: err instanceof Error ? err.message : String(err),
            },
          ],
        }));
      }
    }

    await CallAiPolicy.logCallAiPolicyDecision({
      companyId: update.companyId ?? null,
      providerKey: update.providerKey,
      providerCallId: update.providerCallId,
      fromNumber: update.fromNumber ?? null,
      toNumber: update.toNumber ?? null,
      decision: policyEval.decision as any,
      reason: policyEval.reason,
      mode: policyEval.mode as any,
      matchedRule: policyEval.matchedRule,
      details: {
        ...policyEval.details,
        policyEnabled: Boolean(policyEval.policy?.enabled),
        policyMode: policyEval.policy?.mode ?? null,
        liveExecution: liveExec
          ? {
              executed: liveExec.executed,
              action: liveExec.action,
              reason: liveExec.reason ?? null,
              source: liveExec.source ?? null,
              model: liveExec.model ?? null,
              replyPreview: liveExec.replyText ? liveExec.replyText.slice(0, 220) : null,
            }
          : null,
        automationWorkflow,
      },
    }).catch(() => undefined);

    update.rawPayload = {
      ...(typeof update.rawPayload === "object" && update.rawPayload ? (update.rawPayload as any) : {}),
      __aiPolicyPhase1: {
        decision: policyEval.decision,
        reason: policyEval.reason,
        mode: policyEval.mode,
        matchedRule: policyEval.matchedRule,
      },
      ...(liveExec
        ? {
            __aiPolicyPhase2: {
              executed: liveExec.executed,
              action: liveExec.action,
              reason: liveExec.reason ?? null,
              source: liveExec.source ?? null,
              model: liveExec.model ?? null,
              replyText: liveExec.replyText ?? null,
            },
          }
        : {}),
      ...(automationWorkflow
        ? {
            __aiAutomationWorkflow: automationWorkflow,
          }
        : {}),
    };

    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "ai_policy_phase1",
      providerKey,
      providerCallId: update.providerCallId,
      decision: policyEval.decision,
      reason: policyEval.reason,
      mode: policyEval.mode,
      matchedRule: policyEval.matchedRule,
      companyId: update.companyId ?? null,
      liveExecution: liveExec
        ? {
            executed: liveExec.executed,
            action: liveExec.action,
            reason: liveExec.reason ?? null,
            source: liveExec.source ?? null,
            model: liveExec.model ?? null,
            replyPreview: liveExec.replyText ? liveExec.replyText.slice(0, 220) : null,
          }
        : null,
    });
    if (liveExec) {
      popupAiText = liveExec.replyText ?? null;
      if (update.providerKey.toLowerCase() === "yeastar") {
        popupPickupHint = update.toNumber
          ? `Pick up from PBX: *4 (group) or *04${update.toNumber} (directed).`
          : "Pick up from PBX: *4 (group) or *04<extension> (directed).";
      }
      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "ai_phase2_pickup",
        providerKey,
        providerCallId: update.providerCallId,
        companyId: update.companyId ?? null,
        picked: pickupResult?.picked ?? null,
        endpoint: pickupResult?.endpoint ?? null,
        reason: pickupResult?.reason ?? null,
      });
      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "ai_phase2_live",
        providerKey,
        providerCallId: update.providerCallId,
        companyId: update.companyId ?? null,
        executed: liveExec.executed,
        action: liveExec.action,
        reason: liveExec.reason ?? null,
        source: liveExec.source ?? null,
        model: liveExec.model ?? null,
        replyPreview: liveExec.replyText ? liveExec.replyText.slice(0, 220) : null,
      });
    }
    if (automationWorkflow) {
      await logWebhookLine({
        ts: new Date().toISOString(),
        stage: "ai_workflow_automation",
        providerKey,
        providerCallId: update.providerCallId,
        companyId: update.companyId ?? null,
        simulationMode: automationWorkflow.simulationMode,
        steps: automationWorkflow.steps.map((s) => ({
          key: s.key,
          action: s.action,
          status: s.status,
          error: (s as any).error ?? null,
          payload: {
            scenario: (s as any)?.payload?.scenario ?? null,
            leadType: (s as any)?.payload?.leadType ?? null,
            leadOutcome: (s as any)?.payload?.leadOutcome ?? null,
            inquiryId: (s as any)?.payload?.inquiryId ?? null,
            leadId: (s as any)?.payload?.leadId ?? null,
            recoveryRequestId: (s as any)?.payload?.recoveryRequestId ?? null,
          },
        })),
      });
    }
  }

  const shouldResolveRecordingDeferredOnly =
    providerKey.toLowerCase() === "yeastar" &&
    !update.recordingUrl &&
    /(completed|hangup|bye|over|done|finished|failed|cancelled|canceled)/i.test(
      String(update.status ?? "")
    );
  if (shouldResolveRecordingDeferredOnly) {
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "recording_resolve_deferred_queued",
      providerKey,
      providerCallId: update.providerCallId,
      status: update.status,
    });
    void scheduleDeferredYeastarRecordingResolve({
      providerCallId: update.providerCallId,
      providerKey,
      companyId: update.companyId ?? null,
      status: String(update.status ?? "completed"),
    });
  }

  await CallCenter.handleDialerWebhookUpdate(update);

  if (update.direction === "inbound") {
    publishIncomingPopupEvent({
      id: `${providerKey}-${update.providerCallId}-${Date.now()}`,
      providerCallId: update.providerCallId,
      providerKey,
      direction: "inbound",
      status: update.status,
      fromNumber: update.fromNumber ?? null,
      toNumber: update.toNumber ?? null,
      ringingExtensions: update.ringingExtensions ?? null,
      companyId: update.companyId ?? null,
      branchId: update.branchId ?? null,
      aiText: popupAiText,
      pickupHint: popupPickupHint,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { providerKey } = await ctx.params;
    await handle(providerKey, req);
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "success",
      providerKey,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Dialer webhook error", err);
    await logWebhookLine({
      ts: new Date().toISOString(),
      stage: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: ParamsCtx) {
  return POST(req, ctx);
}
