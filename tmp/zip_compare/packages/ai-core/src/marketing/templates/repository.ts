import { getSql } from "../../db";
import type {
  CreateMarketingTemplateInput,
  MarketingTemplateRow,
  MarketingTemplateType,
  UpdateMarketingTemplateInput,
} from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function listTemplatesForCompany(
  companyId: string,
  type?: MarketingTemplateType
): Promise<MarketingTemplateRow[]> {
  const sql = getSql();
  if (type) {
    const res = await sql<MarketingTemplateRow[]>`
      SELECT *
      FROM marketing_templates
      WHERE company_id = ${companyId} AND type = ${type}
      ORDER BY created_at DESC
    `;
    return rowsFrom(res);
  }

  const res = await sql<MarketingTemplateRow[]>`
    SELECT *
    FROM marketing_templates
    WHERE company_id = ${companyId}
    ORDER BY created_at DESC
  `;
  return rowsFrom(res);
}

export async function getTemplateById(
  companyId: string,
  id: string
): Promise<MarketingTemplateRow | null> {
  const sql = getSql();
  const res = await sql<MarketingTemplateRow[]>`
    SELECT *
    FROM marketing_templates
    WHERE company_id = ${companyId} AND id = ${id}
    LIMIT 1
  `;
  const row = rowsFrom(res)[0];
  return row ?? null;
}

export async function insertTemplate(
  input: CreateMarketingTemplateInput
): Promise<MarketingTemplateRow> {
  const sql = getSql();
  const res = await sql<MarketingTemplateRow[]>`
    INSERT INTO marketing_templates (
      company_id,
      type,
      provider_key,
      name,
      status,
      content,
      provider_status,
      provider_template_id,
      published_at
    )
    VALUES (
      ${input.companyId},
      ${input.type},
      ${input.providerKey},
      ${input.name},
      ${input.status ?? "draft"},
      ${input.content ?? {}},
      ${input.providerStatus ?? null},
      ${input.providerTemplateId ?? null},
      NULL
    )
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) {
    throw new Error("Failed to insert marketing template");
  }
  return row;
}

export async function updateTemplate(
  input: UpdateMarketingTemplateInput
): Promise<MarketingTemplateRow> {
  const sql = getSql();
  const res = await sql<MarketingTemplateRow[]>`
    UPDATE marketing_templates
    SET
      provider_key = COALESCE(${input.providerKey ?? null}, provider_key),
      name = COALESCE(${input.name ?? null}, name),
      status = COALESCE(${input.status ?? null}, status),
      content = COALESCE(${input.content ?? null}, content),
      provider_status = COALESCE(${input.providerStatus ?? null}, provider_status),
      provider_template_id = COALESCE(${input.providerTemplateId ?? null}, provider_template_id),
      published_at = COALESCE(${input.publishedAt ?? null}, published_at),
      updated_at = NOW()
    WHERE company_id = ${input.companyId} AND id = ${input.id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) {
    throw new Error("Marketing template not found");
  }
  return row;
}

export async function deleteTemplate(
  companyId: string,
  id: string
): Promise<MarketingTemplateRow> {
  const sql = getSql();
  const res = await sql<MarketingTemplateRow[]>`
    DELETE FROM marketing_templates
    WHERE company_id = ${companyId} AND id = ${id}
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) {
    throw new Error("Marketing template not found");
  }
  return row;
}
