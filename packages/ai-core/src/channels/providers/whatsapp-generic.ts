import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const providerKey = "generic-whatsapp";

export const genericWhatsappProvider: ChannelProvider = {
  key: providerKey,
  channelType: "whatsapp",
  async sendMessage({ to, body, mediaUrl, integration }): Promise<SendMessageResult> {
    // TODO: integrate with WhatsApp provider using integration.credentials
    console.log("[generic-whatsapp] sendMessage stub", {
      to,
      body,
      mediaUrl,
      integrationId: integration.id,
    });
    return {
      success: true,
      messageId: `whatsapp-fake-${Date.now()}`,
      providerResponse: { to, mediaUrl },
    };
  },
};

registerChannelProvider(genericWhatsappProvider);
