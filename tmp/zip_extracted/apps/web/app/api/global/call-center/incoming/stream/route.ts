import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IncomingRow = {
  id: string;
  provider_call_id: string | null;
  provider_key: string;
  direction: string | null;
  status: string | null;
  from_number: string | null;
  to_number: string | null;
  company_id: string | null;
  branch_id: string | null;
  created_at: string;
};

function formatSseEvent(event: string, data: unknown, id?: string): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const lines = [`event: ${event}`];
  if (id) lines.push(`id: ${id}`);
  lines.push(`data: ${payload}`);
  return `${lines.join("\n")}\n\n`;
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const sql = getSql();
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  const sentCallIds = new Set<string>();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let stopped = false;

      const send = (event: string, data: unknown, id?: string) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data, id)));
      };

      const poll = async () => {
        if (stopped) return;
        try {
          const rows = await sql<IncomingRow[]>`
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
              created_at::text
            FROM call_sessions
            WHERE direction = 'inbound'
              AND status = 'ringing'
              AND created_at > NOW() - INTERVAL '10 minutes'
              ${companyId ? sql`AND (company_id = ${companyId} OR company_id IS NULL)` : sql``}
            ORDER BY created_at ASC
            LIMIT 30
          `;

          for (const row of rows) {
            const callId = String(row.provider_call_id ?? row.id);
            if (!callId || sentCallIds.has(callId)) continue;
            sentCallIds.add(callId);
            send(
              "incoming",
              {
                id: row.id,
                providerCallId: callId,
                providerKey: row.provider_key,
                direction: row.direction ?? "inbound",
                status: row.status ?? "ringing",
                fromNumber: row.from_number,
                toNumber: row.to_number,
                companyId: row.company_id,
                branchId: row.branch_id,
                createdAt: row.created_at,
              },
              callId
            );
          }
        } catch {
          // keep stream alive even if one poll fails
        }
      };

      send("connected", { ok: true, now: new Date().toISOString() });
      void poll();

      const pollTimer = setInterval(() => {
        void poll();
      }, 1200);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      const cleanup = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(pollTimer);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // no-op
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
