import { registerDialerProvider } from "../providers";
import type { DialerProvider, PlaceCallResult } from "../types";

const providerKey = "twilio";

export const twilioProvider: DialerProvider = {
  key: providerKey,
  async placeCall({ to, from, callerId, customPayload, credentials, integration }): Promise<PlaceCallResult> {
    const accountSid = (credentials as any)?.accountSid;
    const authToken = (credentials as any)?.authToken;
    const meta = (integration as any)?.metadata ?? (customPayload as any)?.metadata ?? {};
    const baseUrl = meta.apiBaseUrl ?? (credentials as any)?.apiBaseUrl ?? "https://api.twilio.com";
    const defaultFrom =
      from ?? meta.defaultFromNumber ?? (credentials as any)?.defaultFromNumber;

    if (!accountSid || !authToken) {
      return { success: false, error: "Missing Twilio credentials (accountSid/authToken)" };
    }
    if (!defaultFrom) {
      return { success: false, error: "Missing from number for Twilio call" };
    }

    const twimlUrl =
      meta.twimlUrl ?? (customPayload as any)?.twimlUrl ?? "https://demo.twilio.com/docs/voice.xml";

    const body = new URLSearchParams();
    body.append("To", to);
    body.append("From", defaultFrom);
    body.append("Url", twimlUrl);
    if (callerId) body.append("CallerId", callerId);

    try {
      const res = await fetch(
        `${baseUrl}/2010-04-01/Accounts/${accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        }
      );

      const raw = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        const message =
          (raw as any)?.message ?? `Twilio API error (${res.status})`;
        return { success: false, error: message, raw };
      }

      return {
        success: true,
        callId: (raw as any)?.sid ?? `twilio-${Date.now()}`,
        providerResponse: raw,
        raw,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message ?? "Failed to place call via Twilio",
        raw: { error: err },
      };
    }
  },
};

registerDialerProvider(twilioProvider);
