import nodemailer from "nodemailer";
import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const providerKey = "smtp";

export const smtpEmailProvider: ChannelProvider = {
  key: providerKey,
  channelType: "email",
  async sendMessage({ to, from, subject, body, htmlBody, integration }): Promise<SendMessageResult> {
    const creds = (integration.credentials as Record<string, unknown>) ?? {};
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};

    const host = String(creds.host ?? "").trim();
    const portRaw = creds.port ?? 0;
    const port = typeof portRaw === "string" ? Number(portRaw) : Number(portRaw);
    const username = typeof creds.username === "string" ? creds.username : undefined;
    const password = typeof creds.password === "string" ? creds.password : undefined;
    const useTls = Boolean(creds.useTls);
    const allowInsecureTls = Boolean((creds as any).allowInsecureTls);

    const fromEmail = (from ?? meta.defaultFromEmail) as string | undefined;
    const fromName = meta.defaultFromName as string | undefined;

    if (!host) return { success: false, error: "Missing SMTP host" };
    if (!port || Number.isNaN(port)) return { success: false, error: "Missing SMTP port" };
    if (!fromEmail) return { success: false, error: "Missing from email for SMTP" };

    const secure = port === 465;
    const requireTLS = !secure && useTls;
    const auth =
      username || password
        ? {
            user: username ?? "",
            pass: password ?? "",
          }
        : undefined;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth,
      ...(allowInsecureTls ? { tls: { rejectUnauthorized: false } } : {}),
    });

    const recipients = Array.isArray(to) ? to : [to];
    const payload = {
      from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
      to: recipients.join(", "),
      subject: subject ?? undefined,
      text: body ?? "",
      html: htmlBody ?? undefined,
    };

    try {
      const info = await transporter.sendMail(payload);
      return {
        success: true,
        messageId: info.messageId ?? `smtp-${Date.now()}`,
        providerResponse: { accepted: info.accepted, rejected: info.rejected, response: info.response },
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? "Failed to send via SMTP",
        providerResponse: { error: err },
      };
    }
  },
  async checkHealth(integration) {
    const creds = (integration.credentials as Record<string, unknown>) ?? {};
    if (!creds.host || !creds.port) return "degraded";
    return "unknown";
  },
};

registerChannelProvider(smtpEmailProvider);
