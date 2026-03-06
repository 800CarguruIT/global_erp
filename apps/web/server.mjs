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

function agentTokenVariants(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const normalized = raw.replace(/\s+/g, "").toLowerCase();
  const digits = normalized.replace(/\D+/g, "");
  const out = new Set([normalized]);
  if (digits) out.add(digits);
  return [...out];
}

function agentMatches(set, value) {
  if (!set || set.size === 0) return false;
  const variants = agentTokenVariants(value);
  return variants.some((token) => set.has(token));
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });

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
    const agentIds = new Set(
      rawAgentIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .flatMap((x) => agentTokenVariants(x))
    );
    const connectedAt = Date.now();
    const sentCalls = new Map();

    const send = (type, data) => {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify({ type, data }));
    };

    send("connected", { ok: true, now: new Date().toISOString() });

    const unsubscribe = subscribeIncomingPopupEvent((event) => {
      if (companyId && event.companyId && String(event.companyId) !== companyId) return;
      if (companyId && !event.companyId) {
        // global event should still be visible in company CRM
      }

      const status = String(event.status ?? "").toLowerCase();
      const toNumber = String(event.toNumber ?? "").trim();
      const isRinging = status.includes("ring") || status.includes("incoming");
      if (isRinging && agentIds.size > 0 && toNumber && !agentMatches(agentIds, toNumber)) return;

      const callId = String(event.providerCallId ?? event.id ?? "").trim();
      if (callId) {
        const prev = sentCalls.get(callId);
        const fromNumber = String(event.fromNumber ?? "").trim();
        const toNumberNow = String(event.toNumber ?? "").trim();
        const statusNow = String(event.status ?? "").toLowerCase();
        const hasBetterFrom = !!fromNumber && !String(prev?.fromNumber ?? "").trim();
        const hasBetterTo = !!toNumberNow && !String(prev?.toNumber ?? "").trim();
        const statusChanged = !!prev && String(prev.status ?? "").toLowerCase() !== statusNow;
        if (prev && !hasBetterFrom && !hasBetterTo && !statusChanged) return;
        sentCalls.set(callId, {
          fromNumber,
          toNumber: toNumberNow,
          status: statusNow,
        });
      }
      send("incoming", event);
    });

    const dbPoll = setInterval(async () => {
      if (!sql || ws.readyState !== ws.OPEN) return;
      try {
        const windowStart = new Date(connectedAt - 5000).toISOString();
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
            ${companyId ? sql`AND (company_id = ${companyId} OR company_id IS NULL)` : sql``}
          ORDER BY created_at ASC
          LIMIT 30
        `;

        for (const row of rows) {
          const callId = String(row.provider_call_id ?? row.id ?? "").trim();
          if (!callId) continue;
          const toNumber = String(row.to_number ?? "").trim();
          if (agentIds.size > 0 && toNumber && !agentMatches(agentIds, toNumber)) continue;
          const prev = sentCalls.get(callId);
          const fromNumber = String(row.from_number ?? "").trim();
          const statusNow = String(row.status ?? "ringing").toLowerCase();
          const hasBetterFrom = !!fromNumber && !String(prev?.fromNumber ?? "").trim();
          const hasBetterTo = !!toNumber && !String(prev?.toNumber ?? "").trim();
          const statusChanged = !!prev && String(prev.status ?? "").toLowerCase() !== statusNow;
          if (prev && !hasBetterFrom && !hasBetterTo && !statusChanged) continue;
          sentCalls.set(callId, {
            fromNumber,
            toNumber,
            status: statusNow,
          });
          send("incoming", {
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
          });
        }
      } catch {
        // keep socket alive
      }
    }, 1000);

    const heartbeat = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return;
      try {
        ws.ping();
      } catch {
        // ignore ping errors
      }
    }, 20000);

    ws.on("close", () => {
      clearInterval(dbPoll);
      clearInterval(heartbeat);
      unsubscribe();
    });

    ws.on("error", () => {
      clearInterval(dbPoll);
      clearInterval(heartbeat);
      unsubscribe();
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
    });
  });

  server.listen(port, hostname, () => {
    const proto = "http";
    console.log(`[web] ${mode} server ready on ${proto}://${hostname}:${port}`);
    console.log(`[web] websocket endpoint ws://${hostname}:${port}/ws/call-center/incoming`);
  });
});
