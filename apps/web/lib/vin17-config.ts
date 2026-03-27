import { getSql } from "@repo/ai-core/db";

export type Vin17RuntimeConfig = {
  baseUrl: string;
  username: string;
  password: string;
  usernameParam?: string;
  signatureParam?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCredentials(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }
  return {};
}

export async function getVin17ConfigForCompany(companyId: string): Promise<Vin17RuntimeConfig | null> {
  const sql = getSql();
  const rows = await sql<{
    credentials: Record<string, unknown> | null;
  }[]>`
    SELECT credentials
    FROM integration_dialers
    WHERE provider = 'vin17'
      AND company_id = ${companyId}
      AND is_active = TRUE
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  const credentials = normalizeCredentials(row?.credentials);
  if (!Object.keys(credentials).length) return null;

  const baseUrl = clean(credentials.baseUrl ?? credentials.apiBaseUrl);
  const username = clean(credentials.username ?? credentials.user);
  const password = clean(credentials.password ?? credentials.pass);
  const usernameParam = clean(credentials.usernameParam);
  const signatureParam = clean(credentials.signatureParam);

  if (!baseUrl || !username || !password) return null;

  return {
    baseUrl,
    username,
    password,
    usernameParam: usernameParam || undefined,
    signatureParam: signatureParam || undefined,
  };
}
