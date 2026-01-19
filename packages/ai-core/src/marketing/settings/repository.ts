import { getSql } from "../../db";
import type { CompanyMarketingSettings } from "./types";

export async function getCompanyMarketingSettings(
  companyId: string
): Promise<CompanyMarketingSettings | null> {
  const sql = getSql();
  const rows = await sql<CompanyMarketingSettings[]>`
    SELECT
      company_id as "companyId",
      easycron_api_key as "easycronApiKey",
      easycron_timezone as "easycronTimezone",
      schedule_launch as "scheduleLaunch",
      schedule_delay as "scheduleDelay",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM marketing_company_settings
    WHERE company_id = ${companyId}
  `;
  return rows[0] ?? null;
}

export async function upsertCompanyMarketingSettings(
  companyId: string,
  input: Partial<CompanyMarketingSettings>
): Promise<CompanyMarketingSettings> {
  const sql = getSql();
  const rows = await sql<CompanyMarketingSettings[]>`
    INSERT INTO marketing_company_settings (
      company_id,
      easycron_api_key,
      easycron_timezone,
      schedule_launch,
      schedule_delay
    )
    VALUES (
      ${companyId},
      ${input.easycronApiKey ?? null},
      ${input.easycronTimezone ?? null},
      ${input.scheduleLaunch ?? true},
      ${input.scheduleDelay ?? true}
    )
    ON CONFLICT (company_id) DO UPDATE SET
      easycron_api_key = EXCLUDED.easycron_api_key,
      easycron_timezone = EXCLUDED.easycron_timezone,
      schedule_launch = EXCLUDED.schedule_launch,
      schedule_delay = EXCLUDED.schedule_delay
    RETURNING
      company_id as "companyId",
      easycron_api_key as "easycronApiKey",
      easycron_timezone as "easycronTimezone",
      schedule_launch as "scheduleLaunch",
      schedule_delay as "scheduleDelay",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const saved = rows[0];
  if (!saved) {
    throw new Error("Failed to save marketing settings");
  }
  return saved;
}
