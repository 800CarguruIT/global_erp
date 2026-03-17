// packages/ai-core/src/integrations.ts

import { getSql } from "../db";

export type IntegrationChannel = {
  key: string;
  label: string;
  category: string;
  description: string | null;
  globalEnabled: boolean;
};

export type CompanyIntegration = {
  id: number;
  companyId: number;
  channelKey: string;
  name: string;
  provider: string;
  isPrimary: boolean;
  enabled: boolean;
  settings: unknown;
};

export type ResolvedIntegration = {
  fromCompanyId: number; // which company actually owns it
  channelKey: string;
  name: string;
  provider: string;
  settings: unknown;
  isPrimary: boolean;
};

/**
 * Platform / Global company ID.
 * By default 1, can be overridden via env.
 */
export const PLATFORM_COMPANY_ID: number = Number(
  process.env.PLATFORM_COMPANY_ID ?? 1
);

/**
 * Load the master list of channels.
 */
export async function getIntegrationChannels(): Promise<IntegrationChannel[]> {
  const sql = getSql();

  const rows = await sql<{
    key: string;
    label: string;
    category: string;
    description: string | null;
    global_enabled: boolean;
  }[]>`
    SELECT key, label, category, description, global_enabled
    FROM integration_channels
    ORDER BY category, label
  `;

  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    category: row.category,
    description: row.description,
    globalEnabled: row.global_enabled,
  }));
}

/**
 * Load all integrations for a given company.
 */
export async function getCompanyIntegrations(
  companyId: number
): Promise<CompanyIntegration[]> {
  const sql = getSql();

  const rows = await sql<{
    id: number;
    company_id: number;
    channel_key: string;
    name: string;
    provider: string;
    is_primary: boolean;
    enabled: boolean;
    settings: unknown;
  }[]>`
    SELECT id, company_id, channel_key, name, provider, is_primary, enabled, settings
    FROM company_integrations
    WHERE company_id = ${companyId}
    ORDER BY channel_key, is_primary DESC, name
  `;

  return rows.map((row) => ({
    id: row.id,
    companyId: row.company_id,
    channelKey: row.channel_key,
    name: row.name,
    provider: row.provider,
    isPrimary: row.is_primary,
    enabled: row.enabled,
    settings: row.settings,
  }));
}

/**
 * Helper: get the primary integration for a company+channel.
 */
async function getPrimaryIntegrationFor(
  companyId: number,
  channelKey: string
): Promise<CompanyIntegration | null> {
  const sql = getSql();

  const rows = await sql<{
    id: number;
    company_id: number;
    channel_key: string;
    name: string;
    provider: string;
    is_primary: boolean;
    enabled: boolean;
    settings: unknown;
  }[]>`
    SELECT id, company_id, channel_key, name, provider, is_primary, enabled, settings
    FROM company_integrations
    WHERE company_id = ${companyId}
      AND channel_key = ${channelKey}
      AND is_primary = TRUE
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    companyId: row.company_id,
    channelKey: row.channel_key,
    name: row.name,
    provider: row.provider,
    isPrimary: row.is_primary,
    enabled: row.enabled,
    settings: row.settings,
  };
}

/**
 * Resolve which integration to use for a company & channel:
 *  1) If channel is globally disabled -> return null
 *  2) Try company primary (enabled)
 *  3) Fallback to platform primary (enabled)
 *  4) Else null
 */
export async function resolveIntegration(
  companyId: number,
  channelKey: string
): Promise<ResolvedIntegration | null> {
  // 1) Check global channel switch
  const channels = await getIntegrationChannels();
  const channel = channels.find((c) => c.key === channelKey);

  if (!channel) {
    console.warn(`resolveIntegration: unknown channel "${channelKey}"`);
    return null;
  }

  if (!channel.globalEnabled) {
    // globally killed
    return null;
  }

  // 2) Company primary (if exists & enabled)
  const companyPrimary = await getPrimaryIntegrationFor(companyId, channelKey);
  if (companyPrimary && companyPrimary.enabled) {
    return {
      fromCompanyId: companyPrimary.companyId,
      channelKey: companyPrimary.channelKey,
      name: companyPrimary.name,
      provider: companyPrimary.provider,
      settings: companyPrimary.settings,
      isPrimary: true,
    };
  }

  // 3) Fallback to platform
  const platformPrimary = await getPrimaryIntegrationFor(
    PLATFORM_COMPANY_ID,
    channelKey
  );
  if (platformPrimary && platformPrimary.enabled) {
    return {
      fromCompanyId: platformPrimary.companyId,
      channelKey: platformPrimary.channelKey,
      name: platformPrimary.name,
      provider: platformPrimary.provider,
      settings: platformPrimary.settings,
      isPrimary: true,
    };
  }

  // 4) Nothing available
  return null;
}
