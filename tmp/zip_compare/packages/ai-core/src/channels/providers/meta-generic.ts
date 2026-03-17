import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const providerKey = "meta";

export const metaGenericProvider: ChannelProvider = {
  key: providerKey,
  channelType: "meta",
  async sendMessage({ to, subject, body, integration }): Promise<SendMessageResult> {
    // TODO: integrate with Meta/Facebook messaging API using integration.credentials
    console.log("[meta] sendMessage stub", {
      to,
      subject,
      body,
      integrationId: integration.id,
    });
    return {
      success: true,
      messageId: `meta-fake-${Date.now()}`,
      providerResponse: { to, subject },
    };
  },
};

registerChannelProvider(metaGenericProvider);
