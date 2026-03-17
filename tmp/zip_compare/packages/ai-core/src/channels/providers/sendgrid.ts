import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

export const sendgridProvider: ChannelProvider = {
  key: "sendgrid",
  channelType: "email",
  async sendMessage({ to, from, subject, body, htmlBody, integration }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};
    const apiKey = creds?.apiKey;
    const fromEmail = from ?? (meta as any)?.defaultFromEmail;
    const fromName = (meta as any)?.defaultFromName;

    if (!apiKey) {
      return { success: false, error: "Missing SendGrid apiKey" };
    }
    if (!fromEmail) {
      return { success: false, error: "Missing from email for SendGrid" };
    }

    const recipients = Array.isArray(to) ? to : [to];
    const payload = {
      from: {
        email: fromEmail,
        ...(fromName ? { name: fromName } : {}),
      },
      personalizations: [
        {
          to: recipients.map((r) => ({ email: r })),
          ...(subject ? { subject } : {}),
        },
      ],
      content: [
        { type: "text/plain", value: body ?? "" },
        ...(htmlBody ? [{ type: "text/html", value: htmlBody }] : []),
      ],
    };

    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const raw = await res.json().catch(async () => ({
          message: await res.text().catch(() => undefined),
        }));
        const message =
          (raw as any)?.errors?.[0]?.message ||
          (raw as any)?.message ||
          `SendGrid error (${res.status})`;
        return { success: false, error: message, providerResponse: raw };
      }

      const messageId = res.headers.get("x-message-id") ?? `sendgrid-${Date.now()}`;
      return {
        success: true,
        messageId,
        providerResponse: { status: res.status },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? "Failed to send via SendGrid",
        providerResponse: { error: err },
      };
    }
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.apiKey) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(sendgridProvider);
