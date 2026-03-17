import admin from "firebase-admin";
import { createHash } from "crypto";
import { registerChannelProvider } from "../providers";
import type { ChannelProvider, SendMessageResult } from "../types";

const MAX_TOKENS_PER_BATCH = 500;

function normalizeServiceAccount(raw: unknown) {
  if (!raw) {
    throw new Error("Missing Firebase service account JSON");
  }
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error("Invalid Firebase service account JSON");
    }
  }
  return raw as Record<string, unknown>;
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function getAppName(projectId: string | undefined, clientEmail?: string) {
  const base = projectId ?? "default";
  const hash = createHash("sha1")
    .update(`${base}:${clientEmail ?? ""}`)
    .digest("hex")
    .slice(0, 8);
  return safeName(`fcm-${base}-${hash}`);
}

function getFirebaseApp(serviceAccount: Record<string, any>, projectId?: string) {
  const resolvedProjectId = projectId ?? serviceAccount?.project_id;
  const clientEmail = serviceAccount?.client_email as string | undefined;
  const appName = getAppName(resolvedProjectId, clientEmail);
  const existing = admin.apps.find((app) => app.name === appName);
  if (existing) return existing;

  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId: resolvedProjectId,
    },
    appName
  );
}

function normalizeTokens(to: string | string[]): string[] {
  const tokens = Array.isArray(to) ? to : [to];
  return tokens.map((token) => token.trim()).filter(Boolean);
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function toFcmData(payload: unknown): Record<string, string> | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const entries = Object.entries(payload as Record<string, unknown>);
  if (!entries.length) return undefined;
  const data: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (value === undefined || value === null) continue;
    data[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return Object.keys(data).length ? data : undefined;
}

export const firebasePushProvider: ChannelProvider = {
  key: "firebase-push",
  channelType: "messaging",
  async sendMessage({ integration, subject, body, to, customPayload }): Promise<SendMessageResult> {
    const creds = integration.credentials as any;
    const metadata = integration.metadata as Record<string, unknown> | null;
    const serviceAccount = normalizeServiceAccount(creds?.serviceAccountKeyJson);
    const app = getFirebaseApp(serviceAccount, metadata?.["projectId"] as string | undefined);
    const tokens = normalizeTokens(to);

    if (!tokens.length) {
      return { success: false, error: "Missing FCM device tokens" };
    }

    const notification = {
      title: subject ?? "Notification",
      body,
    };
    const data = toFcmData(customPayload);

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const batch of chunk(tokens, MAX_TOKENS_PER_BATCH)) {
      const response = await app.messaging().sendEachForMulticast({
        tokens: batch,
        notification,
        data,
      });

      successCount += response.successCount;
      failureCount += response.failureCount;
      response.responses.forEach((res) => {
        if (!res.success && res.error?.message) errors.push(res.error.message);
      });
    }

    return {
      success: successCount > 0,
      providerResponse: {
        successCount,
        failureCount,
        errors: errors.slice(0, 5),
      },
      error: successCount === 0 ? errors[0] ?? "Failed to send push notification" : undefined,
    };
  },
  async checkHealth(integration) {
    const creds = integration.credentials as any;
    if (!creds?.serviceAccountKeyJson) return "degraded";
    return "healthy";
  },
};

registerChannelProvider(firebasePushProvider);
