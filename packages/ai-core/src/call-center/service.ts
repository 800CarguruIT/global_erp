import { placeCallWithIntegrationId, listCompanyDialers, listGlobalDialers } from "../dialer/service";
import type { DialerIntegration, PlaceCallResult } from "../dialer/types";
import {
  getCallCenterDashboardData,
  getCallSessionById,
  insertWebhookCallSession,
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

function isPlaceholderRecordingUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.length === 0 || normalized === "unknown" || normalized === "null" || normalized === "undefined";
}

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
    direction: "outbound",
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
  if (normalized.includes("incoming")) return "ringing";
  if (normalized === "initiated" || normalized === "init") return "initiated";
  if (normalized.includes("answer")) return "in_progress";
  if (normalized === "in_progress" || normalized === "in-progress" || normalized === "progress") return "in_progress";
  if (normalized.includes("no answer") || normalized.includes("no_answer")) return "cancelled";
  if (normalized.includes("missed")) return "cancelled";
  if (normalized.includes("declin") || normalized.includes("reject")) return "cancelled";
  if (normalized.includes("busy")) return "failed";
  if (normalized.includes("hangup")) return "completed";
  if (normalized.includes("over") || normalized.includes("bye")) return "completed";
  if (normalized === "completed" || normalized === "finished" || normalized === "done") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return undefined;
}

export async function handleDialerWebhookUpdate(update: DialerWebhookUpdate): Promise<void> {
  const mappedStatus = mapProviderStatus(update.status);
  let callSessionId = await updateCallSessionStatusByProviderCallId(update.providerCallId, {
    status: mappedStatus,
    startedAt: update.startedAt,
    endedAt: update.endedAt,
    durationSeconds: update.durationSeconds ?? null,
    fromNumber: update.fromNumber ?? null,
    toNumber: update.toNumber ?? null,
    metadataPatch: {
      providerStatus: update.status,
      rawPayload: update.rawPayload,
    },
  });

  if (!callSessionId) {
    const scope = update.scope ?? (update.companyId ? "company" : "global");
    const session = await insertWebhookCallSession({
      providerKey: update.providerKey,
      providerCallId: update.providerCallId,
      status: mappedStatus ?? "ringing",
      direction: update.direction ?? "inbound",
      fromNumber: (update.fromNumber ?? "").trim() || "unknown",
      toNumber: (update.toNumber ?? "").trim() || "unknown",
      scope,
      companyId: scope === "company" ? update.companyId ?? null : null,
      branchId: scope === "company" ? update.branchId ?? null : null,
      startedAt: update.startedAt ?? null,
      endedAt: update.endedAt ?? null,
      durationSeconds: update.durationSeconds ?? null,
      metadata: {
        providerStatus: update.status,
        rawPayload: update.rawPayload ?? {},
      },
    });
    callSessionId = session.id;
  }

  const normalizedRecordingId = String(update.recordingId ?? "").trim();
  const normalizedRecordingUrl = String(update.recordingUrl ?? "").trim();
  if (callSessionId && (normalizedRecordingId || normalizedRecordingUrl)) {
    const safeRecordingUrl = isPlaceholderRecordingUrl(normalizedRecordingUrl) ? "" : normalizedRecordingUrl;
    await insertCallRecording({
      callSessionId,
      providerRecordingId: normalizedRecordingId || normalizedRecordingUrl,
      url: safeRecordingUrl,
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
