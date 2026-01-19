import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const messageBirdSmsProvider: ChannelProvider = {
  key: "messagebird-sms",
  channelType: "sms",
  async sendMessage({ to, from, body, integration }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};
    const accessKey = creds?.accessKey;
    const baseUrl = (meta as any)?.apiBaseUrl ?? creds?.apiBaseUrl ?? "https://rest.messagebird.com";
    const originator = from ?? (meta as any)?.defaultFrom ?? creds?.defaultFrom;

    if (!accessKey) return { success: false, error: "Missing MessageBird access key" };
    if (!originator) return { success: false, error: "Missing default From (originator)" };

    const recipients = Array.isArray(to) ? to : [to];
    const lastResult: SendMessageResult = { success: true };

    for (const recipient of recipients) {
      const payload = new URLSearchParams();
      payload.append("originator", originator);
      payload.append("recipients", recipient);
      payload.append("body", body ?? "");

      try {
        const res = await fetch(`${baseUrl}/messages`, {
          method: "POST",
          headers: {
            Authorization: `AccessKey ${accessKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: payload.toString(),
        });

        const raw = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const message =
            (raw as any)?.errors?.[0]?.description ??
            (raw as any)?.message ??
            `MessageBird SMS error (${res.status})`;
          return { success: false, error: message, providerResponse: raw };
        }

        const messageId = (raw as any)?.id ?? `messagebird-sms-${Date.now()}`;
        lastResult.messageId = messageId;
        lastResult.providerResponse = raw;
      } catch (err: any) {
        return {
          success: false,
          error: err?.message ?? "Failed to send via MessageBird SMS",
          providerResponse: { error: err },
        };
      }
    }

    return lastResult;
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.accessKey) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(messageBirdSmsProvider);
