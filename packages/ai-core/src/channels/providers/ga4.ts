import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const ga4Provider: ChannelProvider = {
  key: "ga4",
  channelType: "analytics",
  async sendMessage({ integration }): Promise<SendMessageResult> {
    const creds = integration.credentials;
    const meta = integration.metadata as Record<string, unknown> | null;
    console.log("[ga4] stub sendMessage (no-op)", {
      serviceAccountKeyJson: (creds as any)?.serviceAccountKeyJson ? "present" : "missing",
      propertyId: meta?.["propertyId"],
    });
    return {
      success: true,
      messageId: `ga4-demo-${Date.now()}`,
      providerResponse: {},
    };
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.serviceAccountKeyJson) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(ga4Provider);
