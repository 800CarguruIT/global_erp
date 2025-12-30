import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const providerKey = "smtp";

export const smtpEmailProvider: ChannelProvider = {
  key: providerKey,
  channelType: "email",
  async sendMessage({ to, from, subject, body, htmlBody, integration }): Promise<SendMessageResult> {
    // TODO: integrate with SMTP provider using integration.credentials
    console.log("[smtp-email] sendMessage stub", {
      to,
      from,
      subject,
      body,
      htmlBody,
      integrationId: integration.id,
    });
    return {
      success: true,
      messageId: `smtp-fake-${Date.now()}`,
      providerResponse: { to, from, subject },
    };
  },
};

registerChannelProvider(smtpEmailProvider);
