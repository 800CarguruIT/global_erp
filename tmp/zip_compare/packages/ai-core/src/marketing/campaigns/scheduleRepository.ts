import { getSql } from "../../db";
import type {
  CampaignScheduleRow,
  CreateCampaignScheduleInput,
  UpdateCampaignScheduleJobInput,
} from "./scheduleTypes";

function rowsFrom<T>(result: T[] | { rows: T[] }): T[] {
  return (result as any).rows ?? (result as any);
}

export async function upsertCampaignSchedule(
  input: CreateCampaignScheduleInput
): Promise<CampaignScheduleRow> {
  const sql = getSql();
  const res = await sql<CampaignScheduleRow[]>`
    INSERT INTO marketing_campaign_schedules (
      company_id,
      campaign_id,
      node_id,
      node_key,
      run_at,
      status
    )
    VALUES (
      ${input.companyId ?? null},
      ${input.campaignId},
      ${input.nodeId},
      ${input.nodeKey},
      ${input.runAt},
      ${input.status ?? "pending"}
    )
    ON CONFLICT (campaign_id, node_id, run_at)
    DO UPDATE SET
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING
      id,
      company_id as "companyId",
      campaign_id as "campaignId",
      node_id as "nodeId",
      node_key as "nodeKey",
      run_at as "runAt",
      status,
      easycron_job_id as "easycronJobId",
      easycron_payload as "easycronPayload",
      last_run_at as "lastRunAt",
      error,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  const row = rowsFrom(res)[0];
  if (!row) {
    throw new Error("Failed to save campaign schedule");
  }
  return row;
}

export async function updateCampaignScheduleJob(
  id: string,
  input: UpdateCampaignScheduleJobInput
): Promise<CampaignScheduleRow | null> {
  const sql = getSql();
  const keepError = input.error === undefined;
  const res = await sql<CampaignScheduleRow[]>`
    UPDATE marketing_campaign_schedules
    SET
      easycron_job_id = COALESCE(${input.easycronJobId ?? null}, easycron_job_id),
      easycron_payload = COALESCE(${input.easycronPayload ?? null}, easycron_payload),
      status = COALESCE(${input.status ?? null}, status),
      error = CASE WHEN ${keepError} THEN error ELSE ${input.error ?? null} END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      company_id as "companyId",
      campaign_id as "campaignId",
      node_id as "nodeId",
      node_key as "nodeKey",
      run_at as "runAt",
      status,
      easycron_job_id as "easycronJobId",
      easycron_payload as "easycronPayload",
      last_run_at as "lastRunAt",
      error,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return rowsFrom(res)[0] ?? null;
}

export async function markCampaignScheduleRun(
  id: string,
  status: string
): Promise<CampaignScheduleRow | null> {
  const sql = getSql();
  const res = await sql<CampaignScheduleRow[]>`
    UPDATE marketing_campaign_schedules
    SET
      status = ${status},
      last_run_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING
      id,
      company_id as "companyId",
      campaign_id as "campaignId",
      node_id as "nodeId",
      node_key as "nodeKey",
      run_at as "runAt",
      status,
      easycron_job_id as "easycronJobId",
      easycron_payload as "easycronPayload",
      last_run_at as "lastRunAt",
      error,
      created_at as "createdAt",
      updated_at as "updatedAt"
  `;
  return rowsFrom(res)[0] ?? null;
}

export async function getCampaignScheduleById(
  id: string
): Promise<CampaignScheduleRow | null> {
  const sql = getSql();
  const res = await sql<CampaignScheduleRow[]>`
    SELECT
      id,
      company_id as "companyId",
      campaign_id as "campaignId",
      node_id as "nodeId",
      node_key as "nodeKey",
      run_at as "runAt",
      status,
      easycron_job_id as "easycronJobId",
      easycron_payload as "easycronPayload",
      last_run_at as "lastRunAt",
      error,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM marketing_campaign_schedules
    WHERE id = ${id}
    LIMIT 1
  `;
  return rowsFrom(res)[0] ?? null;
}

export async function getLatestCampaignScheduleByNode(
  companyId: string,
  campaignId: string,
  nodeId: string
): Promise<CampaignScheduleRow | null> {
  const sql = getSql();
  const res = await sql<CampaignScheduleRow[]>`
    SELECT
      id,
      company_id as "companyId",
      campaign_id as "campaignId",
      node_id as "nodeId",
      node_key as "nodeKey",
      run_at as "runAt",
      status,
      easycron_job_id as "easycronJobId",
      easycron_payload as "easycronPayload",
      last_run_at as "lastRunAt",
      error,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM marketing_campaign_schedules
    WHERE company_id IS NOT DISTINCT FROM ${companyId}
      AND campaign_id = ${campaignId}
      AND node_id = ${nodeId}
    ORDER BY run_at DESC
    LIMIT 1
  `;
  return rowsFrom(res)[0] ?? null;
}
