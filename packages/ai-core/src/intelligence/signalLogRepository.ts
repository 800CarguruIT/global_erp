import { getSql } from "../db";
import type { EngineKey, Signal } from "./types";

interface LogSignalRunParams {
  companyId: string;
  branchId: string | null;
  engineKey: EngineKey;
  signals: Signal[];
  tokensUsed: { input: number; output: number };
  latencyMs: number;
  payloadSummary?: Record<string, unknown>;
}

interface SignalLogEntry {
  id: string;
  engine_key: string;
  triggered_at: string;
  signals_count: number;
  high_urgency: number;
  med_urgency: number;
  low_urgency: number;
  latency_ms: number | null;
  error: string | null;
}

export async function logSignalRun(params: LogSignalRunParams): Promise<void> {
  const sql = getSql();
  const { companyId, branchId, engineKey, signals, tokensUsed, latencyMs, payloadSummary } = params;

  const high = signals.filter((s) => s.urgency === "HIGH").length;
  const med = signals.filter((s) => s.urgency === "MED").length;
  const low = signals.filter((s) => s.urgency === "LOW").length;

  await sql`
    INSERT INTO ai_signal_log (
      company_id, branch_id, engine_key,
      payload_summary, signals_count,
      high_urgency, med_urgency, low_urgency,
      model_used, prompt_tokens, completion_tokens, latency_ms
    ) VALUES (
      ${companyId},
      ${branchId},
      ${engineKey},
      ${sql.json((payloadSummary ?? {}) as any)},
      ${signals.length},
      ${high}, ${med}, ${low},
      ${"claude-sonnet-4-6"},
      ${tokensUsed.input},
      ${tokensUsed.output},
      ${latencyMs}
    )
  `;
}

export async function logSignalError(params: {
  companyId: string;
  branchId: string | null;
  engineKey: EngineKey;
  error: string;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO ai_signal_log (company_id, branch_id, engine_key, model_used, error)
    VALUES (${params.companyId}, ${params.branchId}, ${params.engineKey}, ${"claude-sonnet-4-6"}, ${params.error})
  `;
}

export async function getRecentLogs(
  companyId: string,
  limit = 10
): Promise<SignalLogEntry[]> {
  const sql = getSql();
  return sql<SignalLogEntry[]>`
    SELECT
      id, engine_key, triggered_at::text AS triggered_at,
      signals_count, high_urgency, med_urgency, low_urgency,
      latency_ms, error
    FROM ai_signal_log
    WHERE company_id = ${companyId}
    ORDER BY triggered_at DESC
    LIMIT ${limit}
  `;
}
