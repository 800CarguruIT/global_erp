// Example Twilio-style provider stub. Replace with real API calls later.
import type { DialerProvider, IntegrationHealthStatus, PlaceCallResult } from "../types";
import { registerDialerProvider } from "../providers";

const providerKey = "twilio";

export const twilioDialerProvider: DialerProvider = {
  key: providerKey,
  async placeCall({ to, from, callerId, customPayload, credentials, integration }): Promise<PlaceCallResult> {
    // TODO: integrate Twilio REST API here using credentials (accountSid, authToken, from number, etc.)
    // For now, just return a fake call id and echo inputs for observability.
    console.log("[twilio] placeCall stub", {
      to,
      from,
      callerId,
      customPayload,
      credentials,
      integrationId: integration.id,
    });
    return {
      success: true,
      callId: `twilio-fake-${Date.now()}`,
      raw: { to, from, callerId, customPayload },
    };
  },
  async checkHealth(integration): Promise<IntegrationHealthStatus> {
    const creds = integration.credentials as any;
    if (!creds?.accountSid || !creds?.authToken) {
      return "degraded";
    }
    return "healthy";
  },
};

// Auto-register on module load so imports are enough to activate.
registerDialerProvider(twilioDialerProvider);
