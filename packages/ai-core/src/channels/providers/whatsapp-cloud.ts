import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const whatsappCloudProvider: ChannelProvider = {
  key: "whatsapp-cloud",
  channelType: "whatsapp",
  async sendMessage({ to, body, integration }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};
    const accessToken = creds?.accessToken;
    const phoneNumberId = (meta as any)?.phoneNumberId;
    const baseUrl = (meta as any)?.apiBaseUrl ?? "https://graph.facebook.com/v17.0";

    if (!accessToken) {
      return { success: false, error: "Missing WhatsApp Cloud accessToken" };
    }
    if (!phoneNumberId) {
      return { success: false, error: "Missing phoneNumberId for WhatsApp Cloud" };
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body ?? "" },
    };

    try {
      const res = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const message =
          (raw as any)?.error?.message ?? `WhatsApp Cloud error (${res.status})`;
        return { success: false, error: message, providerResponse: raw };
      }

      return {
        success: true,
        messageId: (raw as any)?.messages?.[0]?.id ?? `whatsapp-${Date.now()}`,
        providerResponse: raw,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? "Failed to send via WhatsApp Cloud",
        providerResponse: { error: err },
      };
    }
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.accessToken) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(whatsappCloudProvider);
