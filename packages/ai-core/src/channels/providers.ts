import { ChannelIntegrationRow, ChannelProvider, SendMessageInput, SendMessageResult } from "./types";

const providers = new Map<string, ChannelProvider>();

export function registerChannelProvider(provider: ChannelProvider): void {
  providers.set(provider.key, provider);
}

export function getChannelProvider(key: string): ChannelProvider | undefined {
  return providers.get(key);
}

export function getChannelProviderOrThrow(key: string): ChannelProvider {
  const provider = providers.get(key);
  if (provider) return provider;
  throw new Error(`No channel provider registered for key "${key}".`);
}

export async function sendMessageForIntegration(
  integration: ChannelIntegrationRow,
  input: SendMessageInput
): Promise<SendMessageResult> {
  const provider = getChannelProviderOrThrow(integration.provider_key);
  if (provider.channelType !== integration.channel_type) {
    throw new Error(
      `Provider channelType mismatch: expected ${integration.channel_type}, got ${provider.channelType}`
    );
  }
  return provider.sendMessage({
    ...input,
    integration,
  });
}
