import { getSql } from "../../db";
import type { CampaignBuilderGraphRow, CampaignBuilderScope, UpsertCampaignBuilderGraphInput } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getCampaignBuilderGraph(
  scope: CampaignBuilderScope,
  companyId?: string | null,
  campaignId?: string | null
): Promise<CampaignBuilderGraphRow | null> {
  const sql = getSql();
  const res = await sql<CampaignBuilderGraphRow[]>`
    SELECT *
    FROM campaign_builder_graphs
    WHERE scope = ${scope}
      AND company_id IS NOT DISTINCT FROM ${companyId ?? null}
      AND campaign_id IS NOT DISTINCT FROM ${campaignId ?? null}
    LIMIT 1
  `;
  const row = rowsFrom(res)[0];
  return row ?? null;
}

export async function upsertCampaignBuilderGraph(
  input: UpsertCampaignBuilderGraphInput
): Promise<CampaignBuilderGraphRow> {
  const sql = getSql();
  const companyId = input.companyId ?? null;
  const campaignId = input.campaignId ?? null;
  const res = await sql<CampaignBuilderGraphRow[]>`
    INSERT INTO campaign_builder_graphs (scope, company_id, campaign_id, graph)
    VALUES (${input.scope}, ${companyId}, ${campaignId}, ${input.graph})
    ON CONFLICT (
      scope,
      COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    DO UPDATE
      SET graph = EXCLUDED.graph,
          updated_at = NOW()
    RETURNING *
  `;
  const row = rowsFrom(res)[0];
  if (!row) {
    throw new Error("Failed to upsert campaign builder graph");
  }
  return row;
}
