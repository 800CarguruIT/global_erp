import type {
  DialerIntegration,
  PlaceCallInput,
  PlaceCallResult,
  SaveDialerInput,
} from "./types";
import { getSql } from "../db";
import {
  getById,
  insert,
  listForCompany,
  listGlobal,
  update,
} from "./repository";
import {
  getDialerProvider,
  getDialerProviderOrThrow,
  placeCallForIntegration,
  registerDialerProvider,
} from "./providers";
import "./providers/example-twilio";
import "./providers/twilio";
import type { IntegrationHealth, IntegrationHealthStatus } from "./types";
import { upsertIntegrationHealth, getIntegrationHealthForIds } from "../shared/healthRepository";
import {
  createIntegrationEvent,
  markIntegrationEventStatus,
  type IntegrationEventStatus,
} from "../integrations/events";

export {
  getDialerProvider as getProvider,
  registerDialerProvider as registerProvider,
  getDialerProvider,
  getDialerProviderOrThrow,
  registerDialerProvider,
};

export async function saveDialerIntegration(
  input: SaveDialerInput
): Promise<DialerIntegration> {
  const isGlobal = input.isGlobal === true;
  const companyId = isGlobal ? null : input.companyId;

  if (isGlobal && companyId !== null) {
    throw new Error("Global dialer integrations must not have a companyId");
  }
  if (!isGlobal && !companyId) {
    throw new Error("Company dialer integrations require companyId");
  }

  const payload: SaveDialerInput = {
    ...input,
    isGlobal,
    companyId,
    isActive: input.isActive ?? true,
  };

  if (payload.id) return update(payload);
  return insert(payload);
}

export async function getDialerById(id: string): Promise<DialerIntegration | null> {
  return getById(id);
}

export async function listGlobalDialers(): Promise<DialerIntegration[]> {
  return listGlobal();
}

export async function listCompanyDialers(companyId: string): Promise<DialerIntegration[]> {
  return listForCompany(companyId);
}

export async function placeCallWithIntegrationId(
  id: string,
  opts: PlaceCallInput
): Promise<PlaceCallResult> {
  const integration = await getById(id);
  if (!integration || !integration.is_active) {
    throw new Error("Dialer integration not found or inactive");
  }

  const event = await createIntegrationEvent({
    integrationType: "dialer",
    integrationId: id,
    providerKey: integration.provider,
    direction: "outbound",
    eventType: "call_attempt",
    payload: { input: opts },
    status: "queued",
  });

  let result: PlaceCallResult;
  try {
    result = await placeCallForIntegration(integration, {
      ...opts,
      credentials: integration.credentials,
      integration,
    });
  } catch (err: any) {
    result = {
      success: false,
      error: err?.message ?? "Failed to place call",
      raw: { error: err },
    };
  }

  const status: IntegrationEventStatus = result.success === false ? "failed" : "success";
  await markIntegrationEventStatus(event.id, status, result.error ?? null, {
    input: opts,
    response: result,
  });

  return result;
}

async function getDialerIdsForProvider(providerKey: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM integration_dialers
    WHERE provider = ${providerKey}
      AND is_active = TRUE
  `;
  return (rows as any).rows ? (rows as any).rows.map((r: any) => r.id) : rows.map((r) => r.id);
}

export async function handleDialerWebhook(
  providerKey: string,
  payload: unknown,
  headers: Record<string, string> = {}
): Promise<void> {
  const targetIds = await getDialerIdsForProvider(providerKey);
  if (!targetIds.length) return;

  for (const id of targetIds) {
    await createIntegrationEvent({
      integrationType: "dialer",
      integrationId: id,
      providerKey,
      direction: "inbound",
      eventType: "webhook",
      payload: { headers, payload },
      status: "success",
    });
  }
}

function inferHealthFromIntegration(
  integration: DialerIntegration,
  providerHasCheck: boolean
): { status: IntegrationHealthStatus; lastError?: string | null } {
  if (providerHasCheck) return { status: "unknown" };
  if (!integration.credentials || Object.keys(integration.credentials).length === 0) {
    return { status: "degraded", lastError: "Missing credentials" };
  }
  return { status: "unknown" };
}

export async function checkDialerIntegrationHealth(
  id: string
): Promise<IntegrationHealth> {
  const integration = await getById(id);
  if (!integration) throw new Error("Integration not found");
  if (!integration.is_active) {
    return {
      integrationId: id,
      providerKey: integration.provider,
      status: "degraded",
      lastCheckedAt: new Date(),
      lastError: "Integration inactive",
    };
  }

  const provider = getDialerProvider(integration.provider);
  let status: IntegrationHealthStatus = "unknown";
  let lastError: string | null = null;

  if (provider?.checkHealth) {
    try {
      status = await provider.checkHealth(integration);
    } catch (err: any) {
      status = "unreachable";
      lastError = err?.message || "Health check failed";
    }
  } else {
    const inferred = inferHealthFromIntegration(integration, !!provider?.checkHealth);
    status = inferred.status;
    lastError = inferred.lastError ?? null;
  }

  const saved = await upsertIntegrationHealth({
    integrationType: "dialer",
    integrationId: id,
    providerKey: integration.provider,
    status,
    lastCheckedAt: new Date(),
    lastError,
  });

  return {
    integrationId: saved.integrationId,
    providerKey: saved.providerKey,
    status: saved.status,
    lastCheckedAt: saved.lastCheckedAt,
    lastError: saved.lastError,
  };
}

export async function getDialerIntegrationsHealth(
  ids: string[]
): Promise<IntegrationHealth[]> {
  const rows = await getIntegrationHealthForIds("dialer", ids);
  return rows.map((r) => ({
    integrationId: r.integrationId,
    providerKey: r.providerKey,
    status: r.status,
    lastCheckedAt: r.lastCheckedAt,
    lastError: r.lastError,
  }));
}

export async function placeCallViaTool(input: {
  integrationId: string;
  to: string;
  from?: string;
  callerId?: string;
  metadata?: unknown;
}): Promise<PlaceCallResult> {
  if (!input.integrationId) {
    throw new Error("integrationId is required");
  }

  return placeCallWithIntegrationId(input.integrationId, {
    to: input.to,
    from: input.from,
    callerId: input.callerId,
    customPayload: input.metadata,
  });
}
