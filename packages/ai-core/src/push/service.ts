import type { SendMessageResult } from "../channels/types";
import {
  getIntegrationByIdForScope,
  listIntegrationsForCompany,
  listIntegrationsForGlobal,
  sendMessageWithIntegrationId,
} from "../channels/service";
import {
  deactivatePushDeviceToken,
  listActivePushTokensByScope,
  upsertPushDeviceToken,
} from "./repository";
import type {
  PushDeviceTokenRow,
  SendPushInput,
  SendPushResult,
  UpsertPushDeviceTokenInput,
} from "./types";

const PROVIDER_KEY = "firebase-push";

function validateScope(input: { scope: "global" | "company"; companyId?: string | null }) {
  if (input.scope === "company" && !input.companyId) {
    throw new Error("companyId is required for company scope");
  }
  if (input.scope === "global" && input.companyId) {
    throw new Error("companyId must be null for global scope");
  }
}

export async function registerPushDeviceToken(
  input: UpsertPushDeviceTokenInput
): Promise<PushDeviceTokenRow> {
  validateScope(input);
  return upsertPushDeviceToken(input);
}

export async function unregisterPushDeviceToken(
  deviceToken: string,
  userId?: string | null
): Promise<PushDeviceTokenRow | null> {
  return deactivatePushDeviceToken(deviceToken, userId);
}

export async function listActiveDeviceTokens(
  scope: "global" | "company",
  companyId?: string | null,
  userId?: string | null
): Promise<PushDeviceTokenRow[]> {
  validateScope({ scope, companyId });
  return listActivePushTokensByScope(scope, companyId, userId);
}

async function resolveFirebaseIntegrationId(
  scope: "global" | "company",
  companyId?: string | null,
  integrationId?: string | null
): Promise<string> {
  validateScope({ scope, companyId });
  if (integrationId) {
    const existing = await getIntegrationByIdForScope(scope, integrationId, companyId ?? undefined);
    if (!existing || !existing.is_active) {
      throw new Error("Integration not found or inactive");
    }
    if (existing.provider_key !== PROVIDER_KEY) {
      throw new Error(`Integration provider mismatch (expected ${PROVIDER_KEY})`);
    }
    return existing.id;
  }

  const integrations =
    scope === "global"
      ? await listIntegrationsForGlobal()
      : await listIntegrationsForCompany(companyId!);
  const match = integrations.find(
    (row) => row.is_active && row.provider_key === PROVIDER_KEY
  );
  if (!match) {
    throw new Error("No active Firebase push integration found");
  }
  return match.id;
}

function summarizeSendResult(
  integrationId: string,
  tokensCount: number,
  result: SendMessageResult
): SendPushResult {
  const providerResponse = result.providerResponse as any;
  const successCount =
    typeof providerResponse?.successCount === "number"
      ? providerResponse.successCount
      : result.success
        ? tokensCount
        : 0;
  const failureCount =
    typeof providerResponse?.failureCount === "number"
      ? providerResponse.failureCount
      : result.success
        ? 0
        : tokensCount;

  return {
    success: result.success !== false,
    integrationId,
    sentCount: successCount,
    failureCount,
    error: result.error ?? undefined,
    providerResponse: result.providerResponse,
  };
}

export async function sendPushNotification(input: SendPushInput): Promise<SendPushResult> {
  validateScope(input);
  const tokens = await listActiveDeviceTokens(input.scope, input.companyId, input.userId);
  const deviceTokens = tokens.map((row) => row.device_token).filter(Boolean);

  const integrationId = await resolveFirebaseIntegrationId(
    input.scope,
    input.companyId,
    input.integrationId ?? null
  );

  if (!deviceTokens.length) {
    return {
      success: false,
      integrationId,
      sentCount: 0,
      failureCount: 0,
      error: "No active device tokens found",
    };
  }

  const result = await sendMessageWithIntegrationId({
    scope: input.scope,
    companyId: input.companyId ?? undefined,
    integrationId,
    input: {
      to: deviceTokens,
      subject: input.title,
      body: input.body,
      customPayload: input.data ?? undefined,
    },
  });

  return summarizeSendResult(integrationId, deviceTokens.length, result);
}
