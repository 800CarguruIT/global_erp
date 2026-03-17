import { getSql } from "../db";

export type CompanyAiProviderConfig = {
  companyId: string;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  isActive: boolean;
  updatedAt: string;
};

type CompanyAiProviderRow = {
  company_id: string;
  provider: string;
  base_url: string | null;
  api_key: string | null;
  is_active: boolean;
  updated_at: string;
};

function normalizeBaseUrl(baseUrl?: string | null): string | null {
  const raw = String(baseUrl ?? "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export async function getCompanyAiProviderConfig(
  companyId: string
): Promise<CompanyAiProviderConfig | null> {
  const sql = getSql();
  const rows = await sql<CompanyAiProviderRow[]>`
    SELECT company_id, provider, base_url, api_key, is_active, updated_at
    FROM company_ai_provider_config
    WHERE company_id = ${companyId}
      AND provider = 'openai'
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    companyId: row.company_id,
    provider: row.provider,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

export async function upsertCompanyAiProviderConfig(input: {
  companyId: string;
  baseUrl?: string | null;
  apiKey?: string | null;
  isActive?: boolean;
}) {
  const sql = getSql();
  const hasBaseUrl = Object.prototype.hasOwnProperty.call(input, "baseUrl");
  const hasApiKey = Object.prototype.hasOwnProperty.call(input, "apiKey");
  const normalizedBaseUrl = hasBaseUrl ? normalizeBaseUrl(input.baseUrl) : undefined;
  const normalizedApiKey = hasApiKey ? String(input.apiKey ?? "").trim() || null : undefined;
  const isActive = input.isActive ?? true;

  await sql`
    INSERT INTO company_ai_provider_config (company_id, provider, base_url, api_key, is_active)
    VALUES (
      ${input.companyId},
      'openai',
      ${normalizedBaseUrl ?? null},
      ${normalizedApiKey ?? null},
      ${isActive}
    )
    ON CONFLICT (company_id) DO UPDATE
    SET
      base_url = CASE
        WHEN ${hasBaseUrl}::boolean THEN ${normalizedBaseUrl ?? null}
        ELSE company_ai_provider_config.base_url
      END,
      api_key = CASE
        WHEN ${hasApiKey}::boolean THEN ${normalizedApiKey ?? null}
        ELSE company_ai_provider_config.api_key
      END,
      is_active = EXCLUDED.is_active,
      updated_at = now()
  `;

  return getCompanyAiProviderConfig(input.companyId);
}

export async function clearCompanyAiProviderConfig(companyId: string) {
  const sql = getSql();
  await sql`
    DELETE FROM company_ai_provider_config
    WHERE company_id = ${companyId}
      AND provider = 'openai'
  `;
}

export function maskApiKey(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length <= 8) return "********";
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}
