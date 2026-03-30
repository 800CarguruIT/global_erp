import { getSql } from "../../db";
import type { LeadQueueItem } from "../types";

export async function getQueueItems(companyId: string, status?: string): Promise<LeadQueueItem[]> {
  const sql = getSql();
  const rows = status
    ? await sql<any[]>`
        SELECT q.*, u.full_name as offered_to_name
        FROM pis_lead_queue q
        LEFT JOIN users u ON u.id = q.offered_to_user_id
        WHERE q.company_id = ${companyId} AND q.status = ${status}
        ORDER BY q.created_at DESC LIMIT 100
      `
    : await sql<any[]>`
        SELECT q.*, u.full_name as offered_to_name
        FROM pis_lead_queue q
        LEFT JOIN users u ON u.id = q.offered_to_user_id
        WHERE q.company_id = ${companyId}
        ORDER BY q.created_at DESC LIMIT 100
      `;

  return rows.map(r => ({
    id: r.id,
    leadId: r.lead_id,
    leadName: `Lead ${(r.lead_id as string)?.slice(0, 8) ?? ""}`,
    status: r.status,
    currentTier: r.current_tier,
    cascadeCount: r.cascade_count,
    offeredTo: r.offered_to_user_id,
    offeredToName: r.offered_to_name,
    offeredAt: r.offered_at,
    acceptedAt: r.accepted_at,
    lockedUntil: r.locked_until,
    pipelineValue: Number(r.pipeline_value ?? 0),
    createdAt: r.created_at,
  }));
}

export async function getQueueHistory(companyId: string, queueId?: string): Promise<any[]> {
  const sql = getSql();
  const rows = queueId
    ? await sql<any[]>`
        SELECT h.*, u.full_name as advisor_name
        FROM pis_lead_queue_history h
        LEFT JOIN users u ON u.id = h.advisor_user_id
        WHERE h.company_id = ${companyId} AND h.queue_id = ${queueId}
        ORDER BY h.created_at DESC
      `
    : await sql<any[]>`
        SELECT h.*, u.full_name as advisor_name
        FROM pis_lead_queue_history h
        LEFT JOIN users u ON u.id = h.advisor_user_id
        WHERE h.company_id = ${companyId}
        ORDER BY h.created_at DESC LIMIT 200
      `;

  return rows.map(r => ({
    id: r.id,
    queueId: r.queue_id,
    advisorName: r.advisor_name,
    action: r.action,
    tierAtAction: r.tier_at_action,
    penaltyPoints: Number(r.penalty_points ?? 0),
    detail: r.detail,
    createdAt: r.created_at,
  }));
}

export async function createQueueEntry(companyId: string, leadId: string, pipelineValue: number = 0): Promise<string> {
  const sql = getSql();
  const rows = await sql<{id: string}[]>`
    INSERT INTO pis_lead_queue (company_id, lead_id, status, pipeline_value)
    VALUES (${companyId}, ${leadId}, 'pending', ${pipelineValue})
    RETURNING id
  `;
  return rows[0].id;
}

export async function updateQueueEntry(queueId: string, updates: Record<string, unknown>): Promise<void> {
  const sql = getSql();
  const { status, offered_to_user_id, offered_at, accepted_at, locked_until, first_call_at, released_at, cascade_count, current_tier } = updates as any;
  await sql`
    UPDATE pis_lead_queue SET
      status = COALESCE(${status ?? null}, status),
      offered_to_user_id = COALESCE(${offered_to_user_id ?? null}, offered_to_user_id),
      offered_at = COALESCE(${offered_at ?? null}, offered_at),
      accepted_at = COALESCE(${accepted_at ?? null}, accepted_at),
      locked_until = COALESCE(${locked_until ?? null}, locked_until),
      first_call_at = COALESCE(${first_call_at ?? null}, first_call_at),
      released_at = COALESCE(${released_at ?? null}, released_at),
      cascade_count = COALESCE(${cascade_count ?? null}, cascade_count),
      current_tier = COALESCE(${current_tier ?? null}, current_tier),
      updated_at = now()
    WHERE id = ${queueId}
  `;
}

export async function addHistory(companyId: string, queueId: string, leadId: string, advisorUserId: string | null, action: string, tier: number | null, penalty: number = 0, detail: Record<string, unknown> | null = null): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO pis_lead_queue_history (company_id, queue_id, lead_id, advisor_user_id, action, tier_at_action, penalty_points, detail)
    VALUES (${companyId}, ${queueId}, ${leadId}, ${advisorUserId}, ${action}, ${tier}, ${penalty}, ${detail ? JSON.stringify(detail) : null}::jsonb)
  `;
}