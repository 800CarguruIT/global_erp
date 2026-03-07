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
  rawPayload?: unknown;
};

export const dynamic = "force-dynamic";
const WEBHOOK_LOG_PATH =
  process.env.DIALER_WEBHOOK_LOG_PATH?.trim() ||
  path.join(os.tmpdir(), "global-erp", "webhook-dialer.log");
const liveExecutionSeen = new Map<string, number>();
const yeastarTokenCache = new Map<string, { token: string; expiresAtMs: number }>();

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
  } catch {
    // no-op: webhook must not fail because logging failed
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

function getYeastarTokenCacheKey(base: string, mode: "userpass" | "client", identifier: string): string {
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

  const candidates: Array<{ name: string; endpoint: string; body: Record<string, unknown> }> = [
    {
      name: "call_answer_ext",
      endpoint: `${base}/call/answer?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, extension },
    },
    {
      name: "call_answer_number",
      endpoint: `${base}/call/answer?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, number: extension },
    },
    {
      name: "call_control_action_answer_ext",
      endpoint: `${base}/call/control?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, action: "answer", extension },
    },
    {
      name: "call_control_action_pickup_ext",
      endpoint: `${base}/call/control?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, action: "pickup", extension },
    },
    {
      name: "call_control_operation_answer_ext",
      endpoint: `${base}/call/control?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, operation: "answer", extension },
    },
    {
      name: "call_control_operation_pickup_ext",
      endpoint: `${base}/call/control?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, operation: "pickup", extension },
    },
    {
      name: "call_operate_answer_ext",
      endpoint: `${base}/call/operate?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, operation: "answer", extension },
    },
    {
      name: "call_operate_pickup_ext",
      endpoint: `${base}/call/operate?access_token=${encodeURIComponent(token)}`,
      body: { call_id: args.providerCallId, operation: "pickup", extension },
    },
  ];

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
    if (res.ok && (!Number.isFinite(errcode) || errcode === 0)) {
      return { picked: true, endpoint: `${candidate.name}:${candidate.endpoint}` };
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

async function getTokenForYeastarDetailed(credentials: Record<string, any>): Promise<{
  token: string | null;
  reason?: string;
}> {
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return { token: null, reason: "Missing Yeastar API base URL/apiPath" };
  const username = String(credentials.username ?? "").trim();
  const password = String(credentials.password ?? "").trim();
  const clientId = String(credentials.clientId ?? "").trim();
  const clientSecret = String(credentials.clientSecret ?? "").trim();
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);

  const candidates: Array<{ mode: "userpass" | "client"; payload: Record<string, string> }> = [];
  if (username && password) {
    candidates.push({
      mode: "userpass",
      payload: { user_agent: userAgent, username, password },
    });
  }
  if (clientId && clientSecret) {
    candidates.push({
      mode: "client",
      payload: { user_agent: userAgent, client_id: clientId, client_secret: clientSecret },
    });
  }
  if (!candidates.length) {
    return {
      token: null,
      reason: "Missing Yeastar credentials (need username/password or clientId/clientSecret)",
    };
  }

  for (const candidate of candidates) {
    const identifier = candidate.mode === "userpass" ? username : clientId;
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
    const cached = yeastarTokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + 60_000) {
      return { token: cached.token };
    }
  }

  const failures: string[] = [];
  for (const candidate of candidates) {
    const identifier = candidate.mode === "userpass" ? username : clientId;
    const cacheKey = getYeastarTokenCacheKey(base, candidate.mode, identifier);
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
      return { token };
    }
    const errmsg = String(tokenRes.json?.errmsg ?? tokenRes.error ?? `http_${tokenRes.status}`).trim();
    failures.push(`${candidate.mode}:${errmsg || "token_failed"}`);
  }

  return { token: null, reason: failures.join(" | ") || "Yeastar token request failed" };
}

async function getTokenForYeastar(credentials: Record<string, any>): Promise<string | null> {
  const result = await getTokenForYeastarDetailed(credentials);
  return result.token;
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
    const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
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
    msgCallType.includes("inbound") ||
    directionNormalized.includes("in") ||
    [30011, 30016].includes(yeastarType)
  ) {
    direction = "inbound";
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
    fromNumber: fromRaw ? String(fromRaw) : undefined,
    toNumber: answerExt ? String(answerExt) : toRaw ? String(toRaw) : toFromMembers,
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

  let popupAiText: string | null = null;
  let popupPickupHint: string | null = null;

  if (update.direction === "inbound") {
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
    if (
      policyEval.mode === "live" &&
      policyEval.decision === "allow_ai" &&
      update.companyId &&
      shouldRunLiveExecutionOnce(liveExecKey)
    ) {
      if (
        update.providerKey.toLowerCase() === "yeastar" &&
        /(ring|incoming|initiated)/i.test(String(update.status ?? ""))
      ) {
        pickupResult = await tryYeastarAutoPickup({
          companyId: update.companyId,
          providerCallId: update.providerCallId,
          toNumber: update.toNumber ?? null,
        }).catch((err) => ({
          picked: false,
          reason: err instanceof Error ? err.message : String(err),
        }));
      }

      liveExec = await executeLiveInboundAi({
        companyId: update.companyId,
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

    if (policyEval.decision === "allow_ai" && policyEval.policy?.guidance?.automationEnabled) {
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
      mode: policyEval.mode,
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
