import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

function digitsOnly(input: string): string {
  return String(input ?? "").replace(/\D+/g, "");
}

function toOnexRecipient(input: string, countryCode: string): string {
  const digits = digitsOnly(input);
  const cc = digitsOnly(countryCode);
  if (!digits) return "";
  if (!cc) return digits;
  if (digits.startsWith(cc)) return digits;
  return `${cc}${digits}`;
}

function buildClientSmsId(prefix: string): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${Date.now()}${random}`;
}

export const onexglobalSmsProvider: ChannelProvider = {
  key: "onexglobal-sms",
  channelType: "sms",
  async sendMessage({ to, from, body, integration }): Promise<SendMessageResult> {
    const creds = (integration.credentials ?? {}) as Record<string, unknown>;
    const meta = (integration.metadata as Record<string, unknown> | null) ?? {};

    const apiKey = String(creds.apiKey ?? "").trim();
    const apiBaseUrl = String(
      meta.apiBaseUrl ?? creds.apiBaseUrl ?? "https://api.int.onexglobal.io"
    ).trim();
    const endpointOverride = String(
      meta.endpointUrl ?? creds.endpointUrl ?? ""
    ).trim();
    const sender = String(
      from ??
        meta.defaultFrom ??
        meta.defaultFromNumber ??
        meta.senderId ??
        meta.from ??
        creds.defaultFrom ??
        creds.defaultFromNumber ??
        creds.senderId ??
        creds.from ??
        ""
    ).trim();
    const countryCode = String(meta.countryCode ?? creds.countryCode ?? "971").trim();
    const clientSmsIdPrefix = String(meta.clientSmsIdPrefix ?? "onex-").trim();

    if (!apiKey) return { success: false, error: "Missing Onexglobal API key" };
    if (!sender) return { success: false, error: "Missing default From (sender)" };

    const recipients = (Array.isArray(to) ? to : [to]).map((r) => String(r ?? "").trim()).filter(Boolean);
    if (!recipients.length) return { success: false, error: "Missing recipient number" };

    const listSms = recipients.map((recipient) => ({
      from: sender,
      to: toOnexRecipient(recipient, countryCode),
      body: String(body ?? ""),
      clientsmsid: buildClientSmsId(clientSmsIdPrefix),
    }));

    if (listSms.some((m) => !m.to)) {
      return { success: false, error: "Invalid recipient number after normalization" };
    }

    try {
      const normalizedBase = apiBaseUrl.replace(/\/+$/, "");
      const endpoint =
        endpointOverride ||
        (/(\/api\/jsmslist)$/i.test(normalizedBase)
          ? normalizedBase
          : `${normalizedBase}/api/jsmslist`);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          key: apiKey,
          listsms: listSms,
        }),
      });

      const rawText = await res.text();
      let raw: any = {};
      try {
        raw = rawText ? JSON.parse(rawText) : {};
      } catch {
        raw = { rawText: rawText.slice(0, 1000) };
      }
      if (!res.ok) {
        const message =
          String((raw as any)?.message ?? (raw as any)?.error ?? "").trim() ||
          `Onexglobal SMS error (${res.status})`;
        return { success: false, error: message, providerResponse: raw };
      }

      const messageId =
        String((raw as any)?.messageId ?? (raw as any)?.id ?? "").trim() ||
        listSms[0]?.clientsmsid ||
        `onexglobal-sms-${Date.now()}`;

      return {
        success: true,
        messageId,
        providerResponse: raw,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? "Failed to send via Onexglobal SMS",
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

registerChannelProvider(onexglobalSmsProvider);
