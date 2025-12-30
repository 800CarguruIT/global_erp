import { placeCallWithIntegrationId, listCompanyDialers, listGlobalDialers } from "../dialer/service";
import type { DialerIntegration, PlaceCallResult } from "../dialer/types";
import {
  getCallCenterDashboardData,
  getCallSessionById,
  insertCallRecording,
  insertCallSession,
  listCallSessions,
  listCallRecordingsBySessionIds,
  updateCallSessionStatusByProviderCallId,
} from "./repository";
import type {
  CallCenterDashboardFilter,
  CallSession,
  CallStatus,
  DialerWebhookUpdate,
  ListCallsFilter,
  StartOutboundCallInput,
} from "./types";

function ensureScope(input: StartOutboundCallInput) {
  if (input.scope === "company" && !input.companyId) {
    throw new Error("companyId is required for company scope");
  }
}

async function findDialerIntegration(
  scope: "global" | "company",
  providerKey: string,
  companyId?: string | null
): Promise<DialerIntegration | null> {
  const integrations =
    scope === "global" ? await listGlobalDialers() : await listCompanyDialers(companyId ?? "");
  const active = integrations.find((i) => i.provider === providerKey && i.is_active);
  return active ?? null;
}

export async function startOutboundCall(input: StartOutboundCallInput): Promise<CallSession> {
  ensureScope(input);
  const integration = await findDialerIntegration(input.scope, input.providerKey, input.companyId ?? null);
  if (!integration) {
    throw new Error(`No active dialer integration found for provider ${input.providerKey}`);
  }

  const contextMetadata = {
    scope: input.scope,
    companyId: input.companyId ?? null,
    branchId: input.branchId ?? null,
    createdByUserId: input.createdByUserId,
    toEntityType: input.toEntityType ?? null,
    toEntityId: input.toEntityId ?? null,
    requestMetadata: input.metadata ?? {},
  };

  let providerResult: PlaceCallResult = { success: false, error: "Unknown error" };
  try {
    providerResult = await placeCallWithIntegrationId(integration.id, {
      to: input.toNumber,
      from: input.fromNumber,
      customPayload: contextMetadata,
    });
  } catch (err: any) {
    providerResult = { success: false, error: err?.message ?? "Failed to place call", raw: err };
  }

  const status: CallStatus = providerResult.success === false ? "failed" : "initiated";
  const session = await insertCallSession({
    ...input,
    providerCallId: providerResult.callId ?? null,
    status,
    metadata: contextMetadata,
    providerResponse: providerResult,
  });

  return session;
}

export async function listRecentCalls(filter: ListCallsFilter): Promise<CallSession[]> {
  const normalized: ListCallsFilter = {
    ...filter,
    limit: filter.limit ?? 50,
  };
  return listCallSessions(normalized);
}

function mapProviderStatus(status: string | undefined): CallStatus | undefined {
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized.includes("ring")) return "ringing";
  if (normalized === "initiated" || normalized === "init") return "initiated";
  if (normalized === "in_progress" || normalized === "in-progress" || normalized === "progress") return "in_progress";
  if (normalized === "completed" || normalized === "finished" || normalized === "done") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return undefined;
}

export async function handleDialerWebhookUpdate(update: DialerWebhookUpdate): Promise<void> {
  const mappedStatus = mapProviderStatus(update.status);
  const callSessionId = await updateCallSessionStatusByProviderCallId(update.providerCallId, {
    status: mappedStatus,
    startedAt: update.startedAt,
    endedAt: update.endedAt,
    durationSeconds: update.durationSeconds ?? null,
    metadataPatch: {
      providerStatus: update.status,
      rawPayload: update.rawPayload,
    },
  });

  if (callSessionId && (update.recordingId || update.recordingUrl)) {
    await insertCallRecording({
      callSessionId,
      providerRecordingId: update.recordingId ?? update.recordingUrl ?? "unknown",
      url: update.recordingUrl ?? "",
      durationSeconds: update.recordingDurationSeconds ?? null,
    });
  }
}

export async function getCallSession(id: string): Promise<CallSession | null> {
  return getCallSessionById(id);
}

export async function getDashboardData(filter: CallCenterDashboardFilter) {
  if (filter.scope === "company" && !filter.companyId) {
    throw new Error("companyId is required for company scope");
  }
  if (filter.from > filter.to) {
    throw new Error("from must be before to");
  }
  return getCallCenterDashboardData(filter);
}

export async function listRecordingsForSessions(sessionIds: string[]) {
  return listCallRecordingsBySessionIds(sessionIds);
}
