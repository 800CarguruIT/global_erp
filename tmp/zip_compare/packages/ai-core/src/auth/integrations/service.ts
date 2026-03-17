import nodeCrypto from "crypto";
import {
  getActiveIntegrationClientByClientId,
  touchIntegrationClientLastUsed,
} from "./repository";
import type { IntegrationClientIdentity } from "./types";

type IntegrationClientEnvRecord = {
  clientId: string;
  clientSecret: string;
  companyId?: string | null;
  scopes?: string[];
  isActive?: boolean;
};

type ScryptHashParts = {
  salt: Buffer;
  digest: Buffer;
};

function parseEnvClients(): IntegrationClientEnvRecord[] {
  const raw = process.env.INTEGRATION_API_CLIENTS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const clients: IntegrationClientEnvRecord[] = [];
    for (const item of parsed) {
      const clientId = item?.clientId?.toString().trim();
      const clientSecret = item?.clientSecret?.toString();
      if (!clientId || !clientSecret) continue;
      const scopes = Array.isArray(item?.scopes)
        ? item.scopes
            .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean)
        : [];
      clients.push({
        clientId,
        clientSecret,
        companyId: item?.companyId?.toString?.() ?? null,
        scopes,
        isActive: item?.isActive !== false,
      });
    }
    return clients;
  } catch {
    return [];
  }
}

function parseScryptHash(value: string): ScryptHashParts | null {
  const [scheme, version, saltB64, digestB64] = value.split(":");
  if (scheme !== "scrypt" || version !== "v1" || !saltB64 || !digestB64) {
    return null;
  }
  try {
    return {
      salt: Buffer.from(saltB64, "base64"),
      digest: Buffer.from(digestB64, "base64"),
    };
  } catch {
    return null;
  }
}

function normalizeScopes(scopes?: string[] | null): string[] {
  return (scopes ?? []).map((scope) => scope.trim()).filter(Boolean);
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return nodeCrypto.timingSafeEqual(a, b);
}

function verifySecretAgainstScryptHash(secret: string, storedHash: string): boolean {
  const parsed = parseScryptHash(storedHash);
  if (!parsed) return false;
  const candidate = nodeCrypto.scryptSync(secret, parsed.salt, parsed.digest.length);
  return safeEqual(candidate, parsed.digest);
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: string }).code === "42P01";
}

function fallbackEnvClient(clientId: string, clientSecret: string): IntegrationClientIdentity | null {
  const client = parseEnvClients().find(
    (item) => item.clientId === clientId && item.isActive !== false
  );
  if (!client) return null;
  if (client.clientSecret !== clientSecret) return null;
  return {
    clientId: client.clientId,
    companyId: client.companyId ?? null,
    scopes: normalizeScopes(client.scopes),
  };
}

export function createIntegrationClientSecretHash(secret: string): string {
  const salt = nodeCrypto.randomBytes(16);
  const digest = nodeCrypto.scryptSync(secret, salt, 32);
  return `scrypt:v1:${salt.toString("base64")}:${digest.toString("base64")}`;
}

export async function validateIntegrationClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<IntegrationClientIdentity | null> {
  try {
    const row = await getActiveIntegrationClientByClientId(clientId);
    if (!row) {
      return fallbackEnvClient(clientId, clientSecret);
    }
    if (!verifySecretAgainstScryptHash(clientSecret, row.client_secret_hash)) {
      return null;
    }
    return {
      clientId: row.client_id,
      companyId: row.company_id,
      scopes: normalizeScopes(row.scopes),
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return fallbackEnvClient(clientId, clientSecret);
    }
    throw error;
  }
}

export async function markIntegrationClientUsed(clientId: string): Promise<void> {
  try {
    await touchIntegrationClientLastUsed(clientId);
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}
