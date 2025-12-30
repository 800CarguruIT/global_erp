import { getSql } from "../../db";
import type { CampaignBuilderGraphRow, CampaignBuilderScope, UpsertCampaignBuilderGraphInput } from "./types";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function getCampaignBuilderGraph(
  scope: CampaignBuilderScope,
  companyId?: string | null
): Promise<CampaignBuilderGraphRow | null> {
  const sql = getSql();
  const res = await sql<CampaignBuilderGraphRow[]>`
    SELECT *
    FROM campaign_builder_graphs
    WHERE scope = ${scope} AND company_id IS NOT DISTINCT FROM ${companyId ?? null}
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
  const res = await sql<CampaignBuilderGraphRow[]>`
    INSERT INTO campaign_builder_graphs (scope, company_id, graph)
    VALUES (${input.scope}, ${companyId}, ${input.graph})
    ON CONFLICT (scope, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid))
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
