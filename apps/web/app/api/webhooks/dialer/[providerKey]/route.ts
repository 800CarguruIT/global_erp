import { NextRequest, NextResponse } from "next/server";
import { CallCenter, Dialer, getSql } from "@repo/ai-core";
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

function normalizeMaybePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

function isLikelyExternalNumber(value: string | null | undefined): boolean {
  const normalized = normalizeMaybePhone(value);
  if (!normalized) return false;
  const digits = normalized.replace(/\D+/g, "");
  return digits.length >= 7;
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

async function getTokenForYeastar(credentials: Record<string, any>): Promise<string | null> {
  const base = normalizedBaseUrl(credentials.apiBaseUrl, credentials.apiPath);
  if (!base) return null;
  const username = String(credentials.username ?? "").trim();
  const password = String(credentials.password ?? "").trim();
  const clientId = String(credentials.clientId ?? "").trim();
  const clientSecret = String(credentials.clientSecret ?? "").trim();
  const userAgent = String(credentials.userAgent ?? "OpenAPI").trim() || "OpenAPI";
  const sslVerify = toBool(credentials.sslVerify, true);

  if ((!username || !password) && (!clientId || !clientSecret)) {
    return null;
  }

  const payload: Record<string, string> = { user_agent: userAgent };
  if (username && password) {
    payload.username = username;
    payload.password = password;
  } else {
    payload.client_id = clientId;
    payload.client_secret = clientSecret;
  }

  const tokenRes = await requestJson({
    url: `${base}/get_token`,
    method: "POST",
    body: payload,
    sslVerify,
    headers: { "User-Agent": userAgent },
  });
  const token = String(tokenRes.json?.access_token ?? "").trim();
  if (!tokenRes.ok || Number(tokenRes.json?.errcode ?? -1) !== 0 || !token) return null;
  return token;
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
    /(ring|incoming)/i.test(String(update.status ?? ""));
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
