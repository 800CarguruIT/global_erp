export type AuthType = "sip" | "api_key" | "oauth2" | (string & {});

export interface DialerIntegration {
  id: string;
  provider: string;
  label: string;
  auth_type: AuthType;
  credentials: any;
  is_global: boolean;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DialerMetadata {
  id: string;
  dialer_id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface DialerWebhook {
  id: string;
  dialer_id: string;
  event: string;
  url: string;
  secret: string | null;
  created_at: string;
}

export interface SaveDialerInput {
  id?: string;
  provider: string;
  label: string;
  authType: AuthType;
  credentials: any;
  isGlobal: boolean;
  companyId: string | null;
  isActive?: boolean;
  metadata?: Record<string, string>;
  webhooks?: Array<{
    event: string;
    url: string;
    secret?: string;
  }>;
}

export type DialerRow = DialerIntegration;

export interface PlaceCallInput {
  to: string;
  from?: string;
  callerId?: string;
  customPayload?: unknown;
  credentials?: any;
  integration?: DialerIntegration;
}

export interface PlaceCallResult {
  callId?: string;
  success: boolean;
  error?: string;
  raw?: unknown;
  providerResponse?: unknown;
}

export type IntegrationHealthStatus = "healthy" | "degraded" | "unreachable" | "unknown";

export interface IntegrationHealth {
  integrationId: string;
  status: IntegrationHealthStatus;
  lastCheckedAt: Date;
  lastError?: string | null;
  providerKey: string;
}

export interface DialerProvider {
  key: string;
  placeCall: (params: {
    to: string;
    from?: string;
    callerId?: string;
    customPayload?: unknown;
    credentials: any;
    integration: DialerIntegration;
  }) => Promise<PlaceCallResult>;
  checkHealth?: (integration: DialerIntegration) => Promise<IntegrationHealthStatus>;
}
