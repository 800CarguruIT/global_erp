import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import postgres from "postgres";
import { subscribeIncomingPopupEvent } from "./lib/call-center/incoming-popup-bus.shared.js";

const args = process.argv.slice(2);
const mode = args[0] === "start" ? "start" : "dev";
const dev = mode === "dev";

function getArgValue(name, fallback) {
  const idx = args.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

const port = Number(getArgValue("port", process.env.PORT ?? "3000"));
const hostname = getArgValue("hostname", process.env.HOSTNAME ?? "0.0.0.0");

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const databaseUrl = process.env.DATABASE_URL || "";
const sql = databaseUrl ? postgres(databaseUrl, { prepare: false }) : null;

function normalizeAgentToken(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
}

function agentTokenVariants(value) {
  const normalized = normalizeAgentToken(value).toLowerCase();
  if (!normalized) return [];
  const digits = normalized.replace(/\D+/g, "");
  const out = new Set([normalized]);
  if (digits) out.add(digits);
  return Array.from(out);
}

function buildAgentTokenSet(values) {
  const set = new Set();
  for (const value of values) {
    for (const token of agentTokenVariants(value)) set.add(token);
  }
  return set;
}

function anyTargetMatchesAgent(agentTokens, targets) {
  if (!agentTokens || agentTokens.size === 0) return true;
  for (const target of targets) {
    for (const token of agentTokenVariants(target)) {
      if (agentTokens.has(token)) return true;
    }
  }
  return false;
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });

  // Global registry of all connected WebSocket clients.
  // Each entry: { companyId, agentTokens, connectedAt, sentCalls }
  const wsClients = new Map();

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host || `${hostname}:${port}`;
    const url = new URL(req.url || "/", `http://${host}`);
    if (url.pathname !== "/ws/call-center/incoming") {
      // Let Next.js handle its own upgrade paths (e.g. dev HMR websocket).
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, url);
    });
  });

  wss.on("connection", (ws, _req, url) => {
    const companyId = (url.searchParams.get("companyId") || "").trim();
    const rawAgentIds = (url.searchParams.get("agentIds") || "").trim();
    const agentTokens = buildAgentTokenSet(
      rawAgentIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
    const connectedAt = Date.now();
    const sentCalls = new Map();

    const send = (type, data) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ type, data }));
    };

    send("connected", { ok: true, now: new Date().toISOString() });

    // Register this client in the global map.
    wsClients.set(ws, { companyId, agentTokens, connectedAt, sentCalls });

    // Real-time path: webhook fires → publishIncomingPopupEvent → this subscriber → instant push.
    // No polling needed here — the global DB poll below is only a catch-up fallback.
    const unsubscribe = subscribeIncomingPopupEvent((event) => {
      if (companyId && event.companyId && String(event.companyId) !== companyId) return;
      if (companyId && !event.companyId) {
        // global event should still be visible in company CRM
      }

      const status = String(event.status ?? "").toLowerCase();
      const isRinging = status.includes("ring") || status.includes("incoming") || status.includes("initiated");
      if (isRinging && agentTokens.size > 0) {
        const targets = [
          ...(Array.isArray(event.ringingExtensions) ? event.ringingExtensions : []),
          String(event.toNumber ?? "").trim(),
        ].filter(Boolean);
        if (!anyTargetMatchesAgent(agentTokens, targets)) return;
      }

      const callId = String(event.providerCallId ?? event.id ?? "").trim();
      if (callId) {
        const prev = sentCalls.get(callId);
        const fromNumber = String(event.fromNumber ?? "").trim();
        const toNumberNow = String(event.toNumber ?? "").trim();
        const ringingExtensionsNow = Array.isArray(event.ringingExtensions)
          ? event.ringingExtensions.map((v) => String(v ?? "").trim()).filter(Boolean).sort().join(",")
          : "";
        const aiTextNow = String(event.aiText ?? "").trim();
        const statusNow = String(event.status ?? "").toLowerCase();
        const hasBetterFrom = !!fromNumber && !String(prev?.fromNumber ?? "").trim();
        const hasBetterTo = !!toNumberNow && !String(prev?.toNumber ?? "").trim();
        const hasBetterRingingExtensions =
          ringingExtensionsNow &&
          String(prev?.ringingExtensions ?? "").trim() !== ringingExtensionsNow;
        const hasBetterAi = !!aiTextNow && !String(prev?.aiText ?? "").trim();
        const statusChanged = !!prev && String(prev.status ?? "").toLowerCase() !== statusNow;
        if (prev && !hasBetterFrom && !hasBetterTo && !hasBetterRingingExtensions && !hasBetterAi && !statusChanged) return;
        sentCalls.set(callId, {
          fromNumber,
          toNumber: toNumberNow,
          ringingExtensions: ringingExtensionsNow,
          aiText: aiTextNow,
          status: statusNow,
        });
      }
      send("incoming", event);
    });

    const heartbeat = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      try {
        ws.ping();
      } catch {
        // ignore ping errors
      }
    }, 20000);

    const cleanup = () => {
      wsClients.delete(ws);
      clearInterval(heartbeat);
      unsubscribe();
    };

    ws.on("close", cleanup);
    ws.on("error", () => {
      cleanup();
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
    });
  });

  // Single global DB poll — runs every 10 seconds as a catch-up fallback for clients
  // that connect mid-call (the real-time path via subscribeIncomingPopupEvent handles
  // instant delivery; this only fills gaps for missed events).
  setInterval(async () => {
    if (!sql || wsClients.size === 0) return;

    const clientList = Array.from(wsClients.entries()).filter(
      ([ws]) => ws.readyState === ws.OPEN
    );
    if (clientList.length === 0) return;

    // Collect unique company IDs across all active clients.
    const companyIdSet = new Set();
    for (const [, client] of clientList) {
      if (client.companyId) companyIdSet.add(client.companyId);
    }
    const companyIds = Array.from(companyIdSet);

    // 2-minute catch-up window — enough to cover reconnects without over-fetching.
    const windowStart = new Date(Date.now() - 2 * 60 * 1000).toISOString();

    try {
      const rows = await sql`
        SELECT
          id,
          provider_call_id,
          provider_key,
          direction,
          status,
          from_number,
          to_number,
          company_id,
          branch_id,
          created_at::text AS created_at
        FROM call_sessions
        WHERE direction = 'inbound'
          AND status = 'ringing'
          AND created_at >= ${windowStart}::timestamptz
          AND (
            company_id IS NULL
            ${companyIds.length > 0 ? sql`OR company_id = ANY(${companyIds})` : sql``}
          )
        ORDER BY created_at ASC
        LIMIT 50
      `;

      if (rows.length === 0) return;

      for (const [ws, client] of clientList) {
        if (ws.readyState !== ws.OPEN) continue;
        for (const row of rows) {
          const rowCompanyId = String(row.company_id ?? "").trim();

          // Company-scoped client: only see their company's calls + global calls.
          if (client.companyId && rowCompanyId && rowCompanyId !== client.companyId) continue;
          // Global client with no companyId: sees everything (hasGlobalClient path).

          const callId = String(row.provider_call_id ?? row.id ?? "").trim();
          if (!callId) continue;

          const toNumber = String(row.to_number ?? "").trim();
          if (client.agentTokens.size > 0 && toNumber && !anyTargetMatchesAgent(client.agentTokens, [toNumber])) {
            continue;
          }

          const prev = client.sentCalls.get(callId);
          const fromNumber = String(row.from_number ?? "").trim();
          const statusNow = String(row.status ?? "ringing").toLowerCase();
          const hasBetterFrom = !!fromNumber && !String(prev?.fromNumber ?? "").trim();
          const hasBetterTo = !!toNumber && !String(prev?.toNumber ?? "").trim();
          const statusChanged = !!prev && String(prev.status ?? "").toLowerCase() !== statusNow;
          if (prev && !hasBetterFrom && !hasBetterTo && !statusChanged) continue;

          client.sentCalls.set(callId, { fromNumber, toNumber, aiText: "", status: statusNow });

          try {
            ws.send(JSON.stringify({
              type: "incoming",
              data: {
                id: String(row.id),
                providerCallId: callId,
                providerKey: String(row.provider_key ?? "dialer"),
                direction: String(row.direction ?? "inbound"),
                status: String(row.status ?? "ringing"),
                fromNumber: row.from_number ?? null,
                toNumber: row.to_number ?? null,
                companyId: row.company_id ?? null,
                branchId: row.branch_id ?? null,
                createdAt: String(row.created_at ?? new Date().toISOString()),
              },
            }));
          } catch {
            // ignore send errors — client will be cleaned up on next close/error event
          }
        }
      }
    } catch {
      // keep poll alive on DB errors
    }
  }, 10_000);

  server.listen(port, hostname, () => {
    const proto = "http";
    console.log(`[web] ${mode} server ready on ${proto}://${hostname}:${port}`);
    console.log(`[web] websocket endpoint ws://${hostname}:${port}/ws/call-center/incoming`);
  });
});
