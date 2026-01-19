import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const twilioSmsProvider: ChannelProvider = {
  key: "twilio-sms",
  channelType: "sms",
  async sendMessage({ to, from, body, integration }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};
    const accountSid = creds?.accountSid;
    const authToken = creds?.authToken;
    const baseUrl = (meta as any)?.apiBaseUrl ?? creds?.apiBaseUrl ?? "https://api.twilio.com";
    const fromNumber = from ?? (meta as any)?.defaultFromNumber ?? creds?.defaultFromNumber;

    if (!accountSid || !authToken) {
      return { success: false, error: "Missing Twilio SMS credentials" };
    }
    if (!fromNumber) {
      return { success: false, error: "Missing from number for Twilio SMS" };
    }

    const recipients = Array.isArray(to) ? to : [to];
    const lastResult: SendMessageResult = { success: true };

    for (const recipient of recipients) {
      const payload = new URLSearchParams();
      payload.append("To", recipient);
      payload.append("From", fromNumber);
      payload.append("Body", body ?? "");

      try {
        const res = await fetch(
          `${baseUrl}/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString(
                "base64"
              )}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: payload.toString(),
          }
        );

        const raw = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          const message =
            (raw as any)?.message ?? `Twilio SMS error (${res.status})`;
          return { success: false, error: message, providerResponse: raw };
        }

        lastResult.messageId = (raw as any)?.sid ?? `twilio-sms-${Date.now()}`;
        lastResult.providerResponse = raw;
      } catch (err: any) {
        return {
          success: false,
          error: err?.message ?? "Failed to send via Twilio SMS",
          providerResponse: { error: err },
        };
      }
    }

    return lastResult;
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.accountSid || !creds?.authToken) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(twilioSmsProvider);
