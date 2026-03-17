import type { ScopeContext } from "../auth/rbac/types";

export interface UserSessionRow {
  id: string;
  user_id: string;
  scope: ScopeContext["scope"];
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;
  started_at: string;
  last_seen_at: string;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  geo_country: string | null;
  geo_city: string | null;
  is_active: boolean;
  last_action: string | null;
  last_action_at: string | null;
}

export interface UserActivityLogRow {
  id: string;
  user_id: string;
  session_id: string | null;
  scope: ScopeContext["scope"];
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;
  timestamp: string;
  ip_address: string | null;
  action_key: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, any>;
}

export interface UserChangeHistoryRow {
  id: string;
  user_id: string | null;
  session_id: string | null;
  scope: ScopeContext["scope"];
  company_id: string | null;
  branch_id: string | null;
  vendor_id: string | null;
  entity_type: string;
  entity_id: string;
  change_timestamp: string;
  change_type: "create" | "update" | "delete" | "login" | "security" | string;
  change_summary: string | null;
  before_data: any;
  after_data: any;
}

export interface UserRiskProfileRow {
  user_id: string;
  overall_risk_score: number;
  risk_level: "low" | "medium" | "high" | string;
  last_evaluated_at: string;
  has_global_admin_role: boolean;
  high_privilege_role_count: number;
  total_active_sessions: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_login_country: string | null;
  last_failed_login_at: string | null;
  unusual_location: boolean;
  notes: string | null;
}

export type StartSessionInput = {
  userId: string;
  scopeContext: ScopeContext;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  geoCountry?: string | null;
  geoCity?: string | null;
};

export type UpdateSessionHeartbeatInput = {
  sessionId: string;
  ipAddress?: string | null;
  geoCountry?: string | null;
  geoCity?: string | null;
  lastActionKey?: string | null;
};

export type ActivityLogInput = {
  userId: string;
  sessionId?: string | null;
  scopeContext: ScopeContext;
  ipAddress?: string | null;
  actionKey: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, any>;
};

export type ChangeHistoryInput = {
  userId?: string | null;
  sessionId?: string | null;
  scopeContext: ScopeContext;
  entityType: string;
  entityId: string;
  changeType: "create" | "update" | "delete" | "login" | "security";
  summary?: string | null;
  beforeData?: any;
  afterData?: any;
};

export type UserRiskComputationInput = {
  userId: string;
  roles: { key: string }[];
  sessions: UserSessionRow[];
  lastLoginAt?: Date | null;
  lastLoginCountry?: string | null;
};
