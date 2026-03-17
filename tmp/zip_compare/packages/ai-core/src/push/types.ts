export type PushScope = "global" | "company";

export interface PushDeviceTokenRow {
  id: string;
  scope: PushScope;
  company_id: string | null;
  user_id: string | null;
  device_token: string;
  platform: string | null;
  device_id: string | null;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertPushDeviceTokenInput {
  scope: PushScope;
  companyId?: string | null;
  userId?: string | null;
  deviceToken: string;
  platform?: string | null;
  deviceId?: string | null;
  isActive?: boolean;
}

export interface SendPushInput {
  scope: PushScope;
  companyId?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  integrationId?: string | null;
}

export interface SendPushResult {
  success: boolean;
  integrationId: string;
  sentCount: number;
  failureCount: number;
  error?: string;
  providerResponse?: unknown;
}
