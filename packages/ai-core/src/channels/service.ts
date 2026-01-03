import {
  ChannelIntegrationRow,
  SaveChannelIntegrationInput,
  SendMessageInput,
  SendMessageResult,
} from "./types";
import {
  getChannelIntegrationById,
  insertChannelIntegration,
  listChannelIntegrationsByScope,
  softDeleteChannelIntegration,
  updateChannelIntegration,
} from "./repository";
import { sendMessageForIntegration, getChannelProviderOrThrow } from "./providers";
import "./providers/email-smtp";
import "./providers/sms-generic";
import "./providers/whatsapp-generic";
import "./providers/meta-generic";
import "./providers/sendgrid";
import "./providers/twilio-sms";
import "./providers/infobip-sms";
import "./providers/messagebird-sms";
import "./providers/whatsapp-cloud";
import "./providers/ga4";
import "./providers/firebase-push";
import type { IntegrationHealth, IntegrationHealthStatus } from "./types";
import { getIntegrationHealthForIds, upsertIntegrationHealth } from "../shared/healthRepository";
import {
  createIntegrationEvent,
  markIntegrationEventStatus,
  type IntegrationEventStatus,
} from "../integrations/events";
import { getSql } from "../db";

export type { SaveChannelIntegrationInput, SendMessageInput, ChannelIntegrationRow } from "./types";

function validateSaveInputForScope(input: SaveChannelIntegrationInput) {
  if (input.scope === "global" && input.companyId) {
    throw new Error("Global integrations must not have companyId");
  }
  if (input.scope === "company" && !input.companyId) {
    throw new Error("Company integrations require companyId");
  }
}

export async function saveChannelIntegrationGlobal(
  input: Omit<SaveChannelIntegrationInput, "scope" | "companyId"> & { id?: string }
): Promise<ChannelIntegrationRow> {
  const payload: SaveChannelIntegrationInput = {
    ...input,
    scope: "global",
    companyId: null,
    isActive: input.isActive ?? true,
  };
  validateSaveInputForScope(payload);
  return payload.id
    ? updateChannelIntegration(payload.id, payload)
    : insertChannelIntegration(payload);
}

export async function saveChannelIntegrationForCompany(
  input: Omit<SaveChannelIntegrationInput, "scope"> & { id?: string }
): Promise<ChannelIntegrationRow> {
  const payload: SaveChannelIntegrationInput = {
    ...input,
    scope: "company",
    isActive: input.isActive ?? true,
  };
  validateSaveInputForScope(payload);
  return payload.id
    ? updateChannelIntegration(payload.id, payload)
    : insertChannelIntegration(payload);
}

export async function listIntegrationsForGlobal(): Promise<ChannelIntegrationRow[]> {
  return listChannelIntegrationsByScope("global");
}

export async function listIntegrationsForCompany(
  companyId: string
): Promise<ChannelIntegrationRow[]> {
  return listChannelIntegrationsByScope("company", companyId);
}

export async function getIntegrationByIdForScope(
  scope: "global" | "company",
  id: string,
  companyId?: string
): Promise<ChannelIntegrationRow | null> {
  const row = await getChannelIntegrationById(id);
  if (!row) return null;
  if (scope === "global") {
    if (row.scope !== "global") return null;
  } else {
    if (row.scope !== "company" || row.company_id !== companyId) return null;
  }
  return row;
}

export async function sendMessageWithIntegrationId(opts: {
  scope: "global" | "company";
  companyId?: string;
  integrationId: string;
  input: SendMessageInput;
}): Promise<SendMessageResult> {
  const integration = await getIntegrationByIdForScope(
    opts.scope,
    opts.integrationId,
    opts.companyId
  );
  if (!integration) throw new Error("Integration not found");
  if (!integration.is_active) throw new Error("Integration is inactive");

  const event = await createIntegrationEvent({
    integrationType: "channel",
    integrationId: integration.id,
    providerKey: integration.provider_key,
    direction: "outbound",
    eventType: "message_send",
    payload: { input: opts.input },
    status: "queued",
  });

  let result: SendMessageResult;
  try {
    result = await sendMessageForIntegration(integration, opts.input);
  } catch (err: any) {
    result = {
      success: false,
      error: err?.message ?? "Failed to send message",
    };
  }

  const status: IntegrationEventStatus = result.success === false ? "failed" : "success";
  await markIntegrationEventStatus(event.id, status, result.error ?? null, {
    input: opts.input,
    response: result,
  });

  return result;
}

export async function softDeleteIntegration(id: string): Promise<ChannelIntegrationRow> {
  return softDeleteChannelIntegration(id);
}

function inferHealthFromIntegration(
  integration: ChannelIntegrationRow,
  providerHasCheck: boolean
): { status: IntegrationHealthStatus; lastError?: string | null } {
  if (providerHasCheck) return { status: "unknown" };
  if (!integration.credentials || Object.keys(integration.credentials).length === 0) {
    return { status: "degraded", lastError: "Missing credentials" };
  }
  return { status: "unknown" };
}

export async function checkChannelIntegrationHealth(
  integrationId: string,
  scope: "global" | "company" = "global",
  companyId?: string
): Promise<IntegrationHealth> {
  const integration = await getIntegrationByIdForScope(scope, integrationId, companyId);
  if (!integration) throw new Error("Integration not found");
  const provider = getChannelProviderOrThrow(integration.provider_key);

  let status: IntegrationHealthStatus = "unknown";
  let lastError: string | null = null;

  if (provider.checkHealth) {
    try {
      status = await provider.checkHealth(integration);
    } catch (err: any) {
      status = "unreachable";
      lastError = err?.message || "Health check failed";
    }
  } else {
    const inferred = inferHealthFromIntegration(integration, !!provider.checkHealth);
    status = inferred.status;
    lastError = inferred.lastError ?? null;
  }

  const saved = await upsertIntegrationHealth({
    integrationType: "channel",
    integrationId,
    providerKey: integration.provider_key,
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

export async function getChannelIntegrationsHealth(
  ids: string[]
): Promise<IntegrationHealth[]> {
  const rows = await getIntegrationHealthForIds("channel", ids);
  return rows.map((r) => ({
    integrationId: r.integrationId,
    providerKey: r.providerKey,
    status: r.status,
    lastCheckedAt: r.lastCheckedAt,
    lastError: r.lastError,
  }));
}

async function getChannelIntegrationIdsForProvider(providerKey: string): Promise<string[]> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM integration_channels
    WHERE provider_key = ${providerKey}
      AND is_active = TRUE
  `;
  return (rows as any).rows ? (rows as any).rows.map((r: any) => r.id) : rows.map((r) => r.id);
}

export async function handleChannelWebhook(
  providerKey: string,
  payload: unknown,
  headers: Record<string, string> = {}
): Promise<void> {
  const targetIds = await getChannelIntegrationIdsForProvider(providerKey);
  if (!targetIds.length) return;

  for (const id of targetIds) {
    await createIntegrationEvent({
      integrationType: "channel",
      integrationId: id,
      providerKey,
      direction: "inbound",
      eventType: "webhook",
      payload: { headers, payload },
      status: "success",
    });
  }
}
