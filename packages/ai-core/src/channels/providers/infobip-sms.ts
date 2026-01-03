import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const infobipSmsProvider: ChannelProvider = {
  key: "infobip-sms",
  channelType: "sms",
  async sendMessage({ to, from, body, integration }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};
    const apiKey = creds?.apiKey;
    const baseUrl = (meta as any)?.apiBaseUrl ?? creds?.apiBaseUrl ?? "https://api.infobip.com";
    const sender = from ?? (meta as any)?.defaultFrom ?? creds?.defaultFrom;

    if (!apiKey) return { success: false, error: "Missing Infobip API key" };
    if (!sender) return { success: false, error: "Missing default From (sender)" };

    const recipients = Array.isArray(to) ? to : [to];
    const lastResult: SendMessageResult = { success: true };

    for (const recipient of recipients) {
      const payload = {
        messages: [
          {
            from: sender,
            destinations: [{ to: recipient }],
            text: body ?? "",
          },
        ],
      };

      try {
        const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
          method: "POST",
          headers: {
            Authorization: `App ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const raw = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const message =
            (raw as any)?.requestError?.serviceException?.text ??
            (raw as any)?.requestError?.text ??
            (raw as any)?.message ??
            `Infobip SMS error (${res.status})`;
          return { success: false, error: message, providerResponse: raw };
        }

        const messageId =
          (raw as any)?.messages?.[0]?.messageId ?? `infobip-sms-${Date.now()}`;
        lastResult.messageId = messageId;
        lastResult.providerResponse = raw;
      } catch (err: any) {
        return {
          success: false,
          error: err?.message ?? "Failed to send via Infobip SMS",
          providerResponse: { error: err },
        };
      }
    }

    return lastResult;
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.apiKey) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(infobipSmsProvider);
