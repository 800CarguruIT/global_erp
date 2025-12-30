export type CallScope = "global" | "company";

export type CallDirection = "outbound" | "inbound";

export type CallStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export type CallTargetType = "customer" | "employee" | "vendor" | "other";

export interface CallSession {
  id: string;
  scope: CallScope;
  companyId: string | null;
  branchId: string | null;
  createdByUserId: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  toEntityType: CallTargetType | null;
  toEntityId: string | null;
  providerKey: string;
  providerCallId: string | null;
  status: CallStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartOutboundCallInput {
  scope: CallScope;
  companyId?: string | null;
  branchId?: string | null;
  createdByUserId: string;
  fromNumber: string;
  toNumber: string;
  toEntityType?: CallTargetType | null;
  toEntityId?: string | null;
  providerKey: string;
  metadata?: Record<string, unknown>;
}

export interface ListCallsFilter {
  scope: CallScope;
  companyId?: string | null;
  branchId?: string | null;
  createdByUserId?: string;
  limit?: number;
}

export interface CallCenterDashboardFilter {
  scope: CallScope;
  companyId?: string | null;
  branchId?: string | null;
  from: Date;
  to: Date;
}

export interface CallCenterTotals {
  totalCalls: number;
  totalDurationSeconds: number;
  completedCalls: number;
  failedCalls: number;
  averageDurationSeconds: number | null;
}

export interface CallCenterStatusBreakdownItem {
  status: CallStatus;
  count: number;
}

export interface CallCenterDirectionBreakdownItem {
  direction: CallDirection;
  count: number;
}

export interface CallCenterUserBreakdownItem {
  createdByUserId: string;
  callCount: number;
  totalDurationSeconds: number;
}

export interface CallCenterDailyBreakdownItem {
  date: string; // YYYY-MM-DD
  callCount: number;
  totalDurationSeconds: number;
}

export interface CallCenterDashboardData {
  period: { from: Date; to: Date };
  totals: CallCenterTotals;
  byStatus: CallCenterStatusBreakdownItem[];
  byDirection: CallCenterDirectionBreakdownItem[];
  byUser: CallCenterUserBreakdownItem[];
  byDay: CallCenterDailyBreakdownItem[];
}

export interface DialerWebhookUpdate {
  providerKey: string;
  providerCallId: string;
  status: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  recordingUrl?: string | null;
  recordingId?: string | null;
  recordingDurationSeconds?: number | null;
  rawPayload?: unknown;
}
