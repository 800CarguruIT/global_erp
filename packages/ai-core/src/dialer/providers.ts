import type {
  DialerIntegration,
  DialerProvider,
  PlaceCallInput,
  PlaceCallResult,
} from "./types";

const providers = new Map<string, DialerProvider>();

export function registerDialerProvider(provider: DialerProvider): void {
  providers.set(provider.key, provider);
}

export function getDialerProvider(key: string): DialerProvider | undefined {
  return providers.get(key);
}

export function getDialerProviderOrThrow(key: string): DialerProvider {
  const provider = providers.get(key);
  if (provider) return provider;
  throw new Error(`No dialer provider registered for key "${key}".`);
}

function unimplementedProvider(key: string): DialerProvider {
  return {
    key,
    async placeCall({ integration }) {
      return {
        success: false,
        error: `No dialer provider registered for key "${key}".`,
        raw: { integrationId: integration.id },
      };
    },
  };
}

export async function placeCallForIntegration(
  integration: DialerIntegration,
  input: PlaceCallInput
): Promise<PlaceCallResult> {
  const provider = getDialerProvider(integration.provider) ?? unimplementedProvider(integration.provider);
  return provider.placeCall({
    to: input.to,
    from: input.from,
    callerId: input.callerId,
    customPayload: input.customPayload,
    credentials: input.credentials ?? integration.credentials,
    integration,
  });
}

// Backward-compatible aliases if existing imports are used elsewhere
export const registerProvider = registerDialerProvider;
export const getProvider = getDialerProvider;
