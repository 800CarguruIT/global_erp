import { getSql } from "../db";
import type {
  CallCenterDashboardData,
  CallCenterDashboardFilter,
  CallCenterDailyBreakdownItem,
  CallCenterDirectionBreakdownItem,
  CallCenterStatusBreakdownItem,
  CallCenterTotals,
  CallCenterUserBreakdownItem,
  CallSession,
  CallStatus,
  ListCallsFilter,
  StartOutboundCallInput,
} from "./types";

type CallSessionRow = {
  id: string;
  scope: string;
  company_id: string | null;
  branch_id: string | null;
  created_by_user_id: string;
  direction: string;
  from_number: string;
  to_number: string;
  to_entity_type: string | null;
  to_entity_id: string | null;
  provider_key: string;
  provider_call_id: string | null;
  status: string;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

type CallRecordingRow = {
  id: string;
  call_session_id: string;
  provider_recording_id: string;
  url: string;
  duration_seconds: number | null;
  created_at: Date;
};

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

function mapSession(row: CallSessionRow): CallSession {
  return {
    id: row.id,
    scope: row.scope as CallSession["scope"],
    companyId: row.company_id,
    branchId: row.branch_id,
    createdByUserId: row.created_by_user_id,
    direction: row.direction as CallSession["direction"],
    fromNumber: row.from_number,
    toNumber: row.to_number,
    toEntityType: (row.to_entity_type as CallSession["toEntityType"]) ?? null,
    toEntityId: row.to_entity_id,
    providerKey: row.provider_key,
    providerCallId: row.provider_call_id,
    status: row.status as CallSession["status"],
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertCallSession(
  input: StartOutboundCallInput & {
    providerCallId?: string | null;
    status: CallStatus;
    providerResponse?: unknown;
  }
): Promise<CallSession> {
  const sql = getSql();
  const metadata = {
    ...(input.metadata ?? {}),
    providerResponse: input.providerResponse ?? undefined,
  };

  const result = await sql<CallSessionRow[]>`
    INSERT INTO call_sessions (
      scope,
      company_id,
      branch_id,
      created_by_user_id,
      direction,
      from_number,
      to_number,
      to_entity_type,
      to_entity_id,
      provider_key,
      provider_call_id,
      status,
      started_at,
      ended_at,
      duration_seconds,
      metadata
    ) VALUES (
      ${input.scope},
      ${input.scope === "company" ? input.companyId ?? null : null},
      ${input.scope === "company" ? input.branchId ?? null : null},
      ${input.createdByUserId},
      'outbound',
      ${input.fromNumber},
      ${input.toNumber},
      ${input.toEntityType ?? null},
      ${input.toEntityId ?? null},
      ${input.providerKey},
      ${input.providerCallId ?? null},
      ${input.status},
      NULL,
      NULL,
      NULL,
      ${metadata as any}::jsonb
    )
    RETURNING *
  `;

  const row = rowsFrom(result)[0] as CallSessionRow | undefined;
  if (!row) throw new Error("Failed to insert call session");
  return mapSession(row);
}

export async function updateCallSessionStatusByProviderCallId(
  providerCallId: string,
  patch: {
    status?: CallStatus;
    startedAt?: Date | null;
    endedAt?: Date | null;
    durationSeconds?: number | null;
    metadataPatch?: Record<string, unknown>;
  }
): Promise<string | null> {
  const sql = getSql();
  const metadataJson = patch.metadataPatch ? JSON.stringify(patch.metadataPatch) : null;
  const result = await sql<{ id: string }[]>`
    UPDATE call_sessions
    SET
      status = COALESCE(${patch.status ?? null}, status),
      started_at = COALESCE(${patch.startedAt ?? null}, started_at),
      ended_at = COALESCE(${patch.endedAt ?? null}, ended_at),
      duration_seconds = COALESCE(${patch.durationSeconds ?? null}, duration_seconds),
      metadata =
        CASE
          WHEN ${metadataJson}::jsonb IS NOT NULL
            THEN COALESCE(metadata, '{}'::jsonb) || ${metadataJson}::jsonb
          ELSE metadata
        END,
      updated_at = NOW()
    WHERE provider_call_id = ${providerCallId}
    RETURNING id
  `;

  const row = rowsFrom(result)[0] as { id: string } | undefined;
  return row?.id ?? null;
}

export async function listCallSessions(filter: ListCallsFilter): Promise<CallSession[]> {
  const sql = getSql();
  const limit = filter.limit ?? 50;

  const companyClause =
    filter.companyId != null ? sql`AND company_id = ${filter.companyId}` : sql``;
  const branchClause =
    filter.branchId != null ? sql`AND branch_id = ${filter.branchId}` : sql``;
  const createdByClause =
    filter.createdByUserId != null ? sql`AND created_by_user_id = ${filter.createdByUserId}` : sql``;

  const result = await sql<CallSessionRow[]>`
    SELECT *
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      ${createdByClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rowsFrom(result).map(mapSession);
}

export async function getCallSessionById(id: string): Promise<CallSession | null> {
  const sql = getSql();
  const result = await sql<CallSessionRow[]>`
    SELECT * FROM call_sessions WHERE id = ${id} LIMIT 1
  `;
  const row = rowsFrom(result)[0] as CallSessionRow | undefined;
  return row ? mapSession(row) : null;
}

export async function getCallCenterDashboardData(
  filter: CallCenterDashboardFilter
): Promise<CallCenterDashboardData> {
  const sql = getSql();
  const branchClause = filter.branchId ? sql`AND branch_id = ${filter.branchId}` : sql``;
  const companyClause =
    filter.scope === "company" ? sql`AND company_id = ${filter.companyId ?? null}` : sql``;

  const totalsRes = await sql<{
    total_calls: number;
    total_duration_seconds: number | null;
    completed_calls: number;
    failed_calls: number;
  }[]>`
    SELECT
      COUNT(*)::int AS total_calls,
      COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_calls,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_calls
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      AND created_at BETWEEN ${filter.from} AND ${filter.to}
  `;

  const totalsRow = rowsFrom(totalsRes)[0] ?? {
    total_calls: 0,
    total_duration_seconds: 0,
    completed_calls: 0,
    failed_calls: 0,
  };
  const totals: CallCenterTotals = {
    totalCalls: Number(totalsRow.total_calls ?? 0),
    totalDurationSeconds: Number(totalsRow.total_duration_seconds ?? 0),
    completedCalls: Number(totalsRow.completed_calls ?? 0),
    failedCalls: Number(totalsRow.failed_calls ?? 0),
    averageDurationSeconds:
      Number(totalsRow.completed_calls ?? 0) > 0
        ? Number(totalsRow.total_duration_seconds ?? 0) / Number(totalsRow.completed_calls)
        : null,
  };

  const statusRes = await sql<{ status: string; count: number }[]>`
    SELECT status, COUNT(*)::int AS count
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      AND created_at BETWEEN ${filter.from} AND ${filter.to}
    GROUP BY status
  `;
  const byStatus: CallCenterStatusBreakdownItem[] = rowsFrom(statusRes).map((r) => ({
    status: r.status as CallStatus,
    count: Number(r.count ?? 0),
  }));

  const directionRes = await sql<{ direction: string; count: number }[]>`
    SELECT direction, COUNT(*)::int AS count
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      AND created_at BETWEEN ${filter.from} AND ${filter.to}
    GROUP BY direction
  `;
  const byDirection: CallCenterDirectionBreakdownItem[] = rowsFrom(directionRes).map((r) => ({
    direction: r.direction as CallSession["direction"],
    count: Number(r.count ?? 0),
  }));

  const userRes = await sql<{ created_by_user_id: string; call_count: number; total_duration_seconds: number | null }[]>`
    SELECT created_by_user_id, COUNT(*)::int AS call_count, COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      AND created_at BETWEEN ${filter.from} AND ${filter.to}
    GROUP BY created_by_user_id
    ORDER BY call_count DESC
  `;
  const byUser: CallCenterUserBreakdownItem[] = rowsFrom(userRes).map((r) => ({
    createdByUserId: r.created_by_user_id,
    callCount: Number(r.call_count ?? 0),
    totalDurationSeconds: Number(r.total_duration_seconds ?? 0),
  }));

  const dayRes = await sql<{ day: string; call_count: number; total_duration_seconds: number | null }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS call_count,
      COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds
    FROM call_sessions
    WHERE scope = ${filter.scope}
      ${companyClause}
      ${branchClause}
      AND created_at BETWEEN ${filter.from} AND ${filter.to}
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY day
  `;
  const byDay: CallCenterDailyBreakdownItem[] = rowsFrom(dayRes).map((r) => ({
    date: r.day,
    callCount: Number(r.call_count ?? 0),
    totalDurationSeconds: Number(r.total_duration_seconds ?? 0),
  }));

  return {
    period: { from: filter.from, to: filter.to },
    totals,
    byStatus,
    byDirection,
    byUser,
    byDay,
  };
}

export async function insertCallRecording(params: {
  callSessionId: string;
  providerRecordingId: string;
  url: string;
  durationSeconds?: number | null;
}): Promise<CallRecordingRow> {
  const sql = getSql();
  const result = await sql<CallRecordingRow[]>`
    INSERT INTO call_recordings (call_session_id, provider_recording_id, url, duration_seconds)
    VALUES (
      ${params.callSessionId},
      ${params.providerRecordingId},
      ${params.url},
      ${params.durationSeconds ?? null}
    )
    RETURNING *
  `;
  const row = rowsFrom(result)[0] as CallRecordingRow | undefined;
  if (!row) throw new Error("Failed to insert call recording");
  return row;
}

export async function listCallRecordingsBySessionIds(
  sessionIds: string[]
): Promise<Array<{ callSessionId: string; url: string; durationSeconds: number | null }>> {
  if (sessionIds.length === 0) return [];
  const sql = getSql();
  const result = await sql<CallRecordingRow[]>`
    SELECT call_session_id, url, duration_seconds
    FROM call_recordings
    WHERE call_session_id = ANY(${sessionIds})
  `;
  return rowsFrom(result).map((row) => ({
    callSessionId: row.call_session_id,
    url: row.url,
    durationSeconds: row.duration_seconds,
  }));
}
