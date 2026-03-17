export type ChannelType =
  | "email"
  | "sms"
  | "whatsapp"
  | "meta"
  | "messaging"
  | "ads"
  | "analytics"
  | "social";

export type AuthType = "api_key" | "oauth2" | "basic" | (string & {});

export interface ChannelIntegrationRow {
  id: string;
  scope: "global" | "company";
  company_id: string | null;
  name: string;
  channel_type: ChannelType;
  provider_key: string;
  auth_type: AuthType;
  credentials: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  webhooks: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveChannelIntegrationInput {
  scope: "global" | "company";
  companyId?: string | null;
  id?: string;
  name: string;
  channelType: ChannelType;
  providerKey: string;
  authType: AuthType;
  credentials: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
  webhooks?: Record<string, unknown> | null;
  isActive?: boolean;
}

export interface SendMessageInput {
  to: string | string[];
  from?: string | null;
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  mediaUrl?: string | string[] | null;
  customPayload?: unknown;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  providerResponse?: unknown;
  error?: string;
}

export type IntegrationHealthStatus = "healthy" | "degraded" | "unreachable" | "unknown";

export interface IntegrationHealth {
  integrationId: string;
  status: IntegrationHealthStatus;
  lastCheckedAt: Date;
  lastError?: string | null;
  providerKey: string;
}

export interface ChannelProvider {
  key: string;
  channelType: ChannelType;
  sendMessage: (
    input: SendMessageInput & { integration: ChannelIntegrationRow }
  ) => Promise<SendMessageResult>;
  checkHealth?: (integration: ChannelIntegrationRow) => Promise<IntegrationHealthStatus>;
}
