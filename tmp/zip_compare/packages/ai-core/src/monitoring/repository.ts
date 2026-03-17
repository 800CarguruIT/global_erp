import { getSql } from "../db";
import type {
  ActivityLogInput,
  ChangeHistoryInput,
  StartSessionInput,
  UpdateSessionHeartbeatInput,
  UserActivityLogRow,
  UserChangeHistoryRow,
  UserRiskProfileRow,
  UserSessionRow,
} from "./types";
import type { ScopeContext } from "../auth/rbac/types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

// Sessions
export async function createSession(input: StartSessionInput): Promise<UserSessionRow> {
  const sql: any = getSql();
  const ctx = input.scopeContext;
  const result = await sql<UserSessionRow[]>`
    INSERT INTO user_sessions (
      user_id, scope, company_id, branch_id, vendor_id,
      ip_address, user_agent, device_fingerprint, geo_country, geo_city, last_action, last_action_at
    ) VALUES (
      ${input.userId},
      ${ctx.scope},
      ${ctx.companyId ?? null},
      ${ctx.branchId ?? null},
      ${ctx.vendorId ?? null},
      ${input.ipAddress ?? null},
      ${input.userAgent ?? null},
      ${input.deviceFingerprint ?? null},
      ${input.geoCountry ?? null},
      ${input.geoCity ?? null},
      null,
      null
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as UserSessionRow;
}

export async function updateSessionHeartbeat(
  input: UpdateSessionHeartbeatInput
): Promise<UserSessionRow> {
  const sql: any = getSql();
  const result = await sql<UserSessionRow[]>`
    UPDATE user_sessions
    SET
      last_seen_at = now(),
      ip_address = COALESCE(${input.ipAddress ?? null}, ip_address),
      geo_country = COALESCE(${input.geoCountry ?? null}, geo_country),
      geo_city = COALESCE(${input.geoCity ?? null}, geo_city),
      last_action = COALESCE(${input.lastActionKey ?? null}, last_action),
      last_action_at = CASE WHEN ${input.lastActionKey ?? null} IS NOT NULL THEN now() ELSE last_action_at END
    WHERE id = ${input.sessionId}
    RETURNING *
  `;
  const row = rowsFrom(result)[0] as UserSessionRow | undefined;
  if (!row) throw new Error("Session not found");
  return row;
}

export async function endSession(sessionId: string): Promise<void> {
  const sql: any = getSql();
  await sql`
    UPDATE user_sessions
    SET is_active = FALSE, last_seen_at = now()
    WHERE id = ${sessionId}
  `;
}

export async function listActiveSessionsForUser(userId: string): Promise<UserSessionRow[]> {
  const sql: any = getSql();
  const result = await sql<UserSessionRow[]>`
    SELECT * FROM user_sessions
    WHERE user_id = ${userId} AND is_active = TRUE
    ORDER BY last_seen_at DESC
  `;
  return rowsFrom(result) as UserSessionRow[];
}

export async function listSessions(params: {
  userId?: string;
  companyId?: string;
  limit?: number;
}): Promise<UserSessionRow[]> {
  const sql: any = getSql();
  const result = await sql<UserSessionRow[]>`
    SELECT * FROM user_sessions
    WHERE (${params.userId ?? null} IS NULL OR user_id = ${params.userId ?? null})
      AND (${params.companyId ?? null} IS NULL OR company_id = ${params.companyId ?? null})
    ORDER BY last_seen_at DESC
    LIMIT ${params.limit ?? 50}
  `;
  return rowsFrom(result) as UserSessionRow[];
}

// Activity logs
export async function insertActivityLog(input: ActivityLogInput): Promise<UserActivityLogRow> {
  const sql: any = getSql();
  const ctx = input.scopeContext;
  const result = await sql<UserActivityLogRow[]>`
    INSERT INTO user_activity_logs (
      user_id, session_id, scope, company_id, branch_id, vendor_id,
      ip_address, action_key, entity_type, entity_id, summary, metadata
    ) VALUES (
      ${input.userId},
      ${input.sessionId ?? null},
      ${ctx.scope},
      ${ctx.companyId ?? null},
      ${ctx.branchId ?? null},
      ${ctx.vendorId ?? null},
      ${input.ipAddress ?? null},
      ${input.actionKey},
      ${input.entityType ?? null},
      ${input.entityId ?? null},
      ${input.summary ?? null},
      ${input.metadata ?? {}}
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as UserActivityLogRow;
}

export async function listActivityLogs(params: {
  userId?: string;
  actionKey?: string;
  entityType?: string;
  entityId?: string;
  scopeContext?: ScopeContext;
  limit?: number;
}): Promise<UserActivityLogRow[]> {
  const sql: any = getSql();
  const ctx = params.scopeContext;
  const result = await sql<UserActivityLogRow[]>`
    SELECT * FROM user_activity_logs
    WHERE (${params.userId ?? null} IS NULL OR user_id = ${params.userId ?? null})
      AND (${params.actionKey ?? null} IS NULL OR action_key = ${params.actionKey ?? null})
      AND (${params.entityType ?? null} IS NULL OR entity_type = ${params.entityType ?? null})
      AND (${params.entityId ?? null} IS NULL OR entity_id = ${params.entityId ?? null})
      AND (${ctx ? ctx.scope : null} IS NULL OR scope = ${ctx?.scope})
      AND (${ctx ? ctx.companyId : null} IS NULL OR company_id = ${ctx?.companyId ?? null})
      AND (${ctx ? ctx.branchId : null} IS NULL OR branch_id = ${ctx?.branchId ?? null})
      AND (${ctx ? ctx.vendorId : null} IS NULL OR vendor_id = ${ctx?.vendorId ?? null})
    ORDER BY timestamp DESC
    LIMIT ${params.limit ?? 100}
  `;
  return rowsFrom(result) as UserActivityLogRow[];
}

// Change history
export async function insertChangeHistory(
  input: ChangeHistoryInput
): Promise<UserChangeHistoryRow> {
  const sql: any = getSql();
  const ctx = input.scopeContext;
  const result = await sql<UserChangeHistoryRow[]>`
    INSERT INTO user_change_history (
      user_id, session_id, scope, company_id, branch_id, vendor_id,
      entity_type, entity_id, change_type, change_summary, before_data, after_data
    ) VALUES (
      ${input.userId ?? null},
      ${input.sessionId ?? null},
      ${ctx.scope},
      ${ctx.companyId ?? null},
      ${ctx.branchId ?? null},
      ${ctx.vendorId ?? null},
      ${input.entityType},
      ${input.entityId},
      ${input.changeType},
      ${input.summary ?? null},
      ${input.beforeData ?? null},
      ${input.afterData ?? null}
    )
    RETURNING *
  `;
  return rowsFrom(result)[0] as UserChangeHistoryRow;
}

export async function listChangeHistory(params: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit?: number;
}): Promise<UserChangeHistoryRow[]> {
  const sql: any = getSql();
  const result = await sql<UserChangeHistoryRow[]>`
    SELECT * FROM user_change_history
    WHERE (${params.entityType ?? null} IS NULL OR entity_type = ${params.entityType ?? null})
      AND (${params.entityId ?? null} IS NULL OR entity_id = ${params.entityId ?? null})
      AND (${params.userId ?? null} IS NULL OR user_id = ${params.userId ?? null})
    ORDER BY change_timestamp DESC
    LIMIT ${params.limit ?? 100}
  `;
  return rowsFrom(result) as UserChangeHistoryRow[];
}

// Risk
export async function getRiskProfile(userId: string): Promise<UserRiskProfileRow | null> {
  const sql: any = getSql();
  const res = await sql<UserRiskProfileRow[]>`
    SELECT * FROM user_risk_profiles WHERE user_id = ${userId} LIMIT 1
  `;
  return (rowsFrom(res)[0] as UserRiskProfileRow | undefined) ?? null;
}

export async function upsertRiskProfile(
  row: Partial<UserRiskProfileRow> & { user_id: string }
): Promise<UserRiskProfileRow> {
  const sql: any = getSql();
  const res = await sql<UserRiskProfileRow[]>`
    INSERT INTO user_risk_profiles (
      user_id, overall_risk_score, risk_level, last_evaluated_at, has_global_admin_role,
      high_privilege_role_count, total_active_sessions, last_login_at, last_login_ip,
      last_login_country, last_failed_login_at, unusual_location, notes
    ) VALUES (
      ${row.user_id},
      ${row.overall_risk_score ?? 0},
      ${row.risk_level ?? "low"},
      ${row.last_evaluated_at ?? new Date()},
      ${row.has_global_admin_role ?? false},
      ${row.high_privilege_role_count ?? 0},
      ${row.total_active_sessions ?? 0},
      ${row.last_login_at ?? null},
      ${row.last_login_ip ?? null},
      ${row.last_login_country ?? null},
      ${row.last_failed_login_at ?? null},
      ${row.unusual_location ?? false},
      ${row.notes ?? null}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      overall_risk_score = EXCLUDED.overall_risk_score,
      risk_level = EXCLUDED.risk_level,
      last_evaluated_at = EXCLUDED.last_evaluated_at,
      has_global_admin_role = EXCLUDED.has_global_admin_role,
      high_privilege_role_count = EXCLUDED.high_privilege_role_count,
      total_active_sessions = EXCLUDED.total_active_sessions,
      last_login_at = EXCLUDED.last_login_at,
      last_login_ip = EXCLUDED.last_login_ip,
      last_login_country = EXCLUDED.last_login_country,
      last_failed_login_at = EXCLUDED.last_failed_login_at,
      unusual_location = EXCLUDED.unusual_location,
      notes = EXCLUDED.notes
    RETURNING *
  `;
  return rowsFrom(res)[0] as UserRiskProfileRow;
}
