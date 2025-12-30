import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const providerKey = "generic-sms";

export const genericSmsProvider: ChannelProvider = {
  key: providerKey,
  channelType: "sms",
  async sendMessage({ to, from, body, integration }): Promise<SendMessageResult> {
    // TODO: integrate with SMS provider using integration.credentials
    console.log("[generic-sms] sendMessage stub", {
      to,
      from,
      body,
      integrationId: integration.id,
    });
    return {
      success: true,
      messageId: `sms-fake-${Date.now()}`,
      providerResponse: { to, from },
    };
  },
};

registerChannelProvider(genericSmsProvider);
