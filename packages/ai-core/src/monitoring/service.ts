import {
  createSession,
  endSession,
  getRiskProfile,
  insertActivityLog,
  insertChangeHistory,
  listActiveSessionsForUser,
  listActivityLogs,
  listChangeHistory,
  listSessions,
  updateSessionHeartbeat,
  upsertRiskProfile,
} from "./repository";
import type {
  ActivityLogInput,
  ChangeHistoryInput,
  StartSessionInput,
  UpdateSessionHeartbeatInput,
  UserActivityLogRow,
  UserChangeHistoryRow,
  UserRiskComputationInput,
  UserRiskProfileRow,
  UserSessionRow,
} from "./types";
import type { ScopeContext } from "../auth/rbac/types";
import { getUserRoles } from "../auth/rbac/repository";

export async function startSession(input: StartSessionInput): Promise<UserSessionRow> {
  return createSession(input);
}

export async function heartbeatSession(
  input: UpdateSessionHeartbeatInput
): Promise<UserSessionRow> {
  return updateSessionHeartbeat(input);
}

export async function endUserSession(sessionId: string): Promise<void> {
  await endSession(sessionId);
}

export async function logActivity(input: ActivityLogInput): Promise<UserActivityLogRow> {
  return insertActivityLog(input);
}

export async function logChange(input: ChangeHistoryInput): Promise<UserChangeHistoryRow> {
  return insertChangeHistory(input);
}

export function computeUserRiskScore(input: UserRiskComputationInput): {
  score: number;
  level: "low" | "medium" | "high";
  details: Partial<UserRiskProfileRow>;
} {
  let score = 0;
  const hasGlobal = input.roles.some((r) => r.key === "global_admin" || r.key === "global.admin");
  const highPriv = input.roles.filter((r) => r.key === "company_admin" || r.key === "global_admin").length;
  const activeSessions = input.sessions.length;

  if (hasGlobal) score += 50;
  if (highPriv > 0) score += 25;
  if (activeSessions > 3) score += 10;

  // placeholder for unusual location logic
  const details: Partial<UserRiskProfileRow> = {
    has_global_admin_role: hasGlobal,
    high_privilege_role_count: highPriv,
    total_active_sessions: activeSessions,
    last_login_at: input.lastLoginAt ? input.lastLoginAt.toISOString() : null,
    last_login_country: input.lastLoginCountry ?? null,
  };

  if (score < 30) details.risk_level = "low";
  else if (score < 70) details.risk_level = "medium";
  else details.risk_level = "high";

  score = Math.max(0, Math.min(100, score));
  return { score, level: details.risk_level as any, details };
}

export async function recomputeUserRisk(userId: string): Promise<UserRiskProfileRow> {
  const roles = await getUserRoles(userId);
  const sessions = await listActiveSessionsForUser(userId);
  const loginLogs = await listActivityLogs({
    userId,
    actionKey: "auth.login",
    limit: 1,
  });
  const lastLogin = loginLogs[0];

  const computed = computeUserRiskScore({
    userId,
    roles: roles.map((r) => ({ key: r.key })),
    sessions,
    lastLoginAt: lastLogin ? new Date(lastLogin.timestamp) : null,
    lastLoginCountry: lastLogin?.metadata?.country ?? null,
  });

  return upsertRiskProfile({
    user_id: userId,
    overall_risk_score: computed.score,
    risk_level: computed.level,
    last_evaluated_at: new Date().toISOString(),
    has_global_admin_role: computed.details.has_global_admin_role ?? false,
    high_privilege_role_count: computed.details.high_privilege_role_count ?? 0,
    total_active_sessions: computed.details.total_active_sessions ?? sessions.length,
    last_login_at: computed.details.last_login_at ?? null,
    last_login_country: computed.details.last_login_country ?? null,
    unusual_location: computed.details.unusual_location ?? false,
  });
}

export async function getUserMonitoringOverview(userId: string): Promise<{
  sessions: UserSessionRow[];
  recentActivity: UserActivityLogRow[];
  risk: UserRiskProfileRow | null;
}> {
  const sessions = await listSessions({ userId, limit: 20 });
  const recentActivity = await listActivityLogs({ userId, limit: 50 });
  const risk = await getRiskProfile(userId);
  return { sessions, recentActivity, risk };
}

export { listActivityLogs, listChangeHistory, listSessions };
