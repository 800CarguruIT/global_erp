import { getSql } from "../../db";
import { routeLead } from "./engine";
import { appendLeadEvent } from "../../crm/leads/repository";

/**
 * Trigger auto-assignment of an advisor to a lead after car check-in.
 * Uses the PIS engine to route the lead to the best available advisor.
 *
 * Guards:
 * - Skip if lead already has an advisor assigned
 * - Skip if lead already has a queue entry (prevent duplicates)
 *
 * Pipeline value is calculated from the linked estimate (if any).
 */
export async function triggerAutoAssignOnCarIn(
  companyId: string,
  leadId: string,
): Promise<{ triggered: boolean; queueId?: string; offeredTo?: string }> {
  const sql = getSql();

  // Guard: check if lead already has an advisor assigned
  const [lead] = await sql<
    { agent_employee_id: string | null; assigned_user_id: string | null }[]
  >`
    SELECT agent_employee_id, assigned_user_id
    FROM leads
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;
  if (!lead) return { triggered: false };
  if (lead.agent_employee_id || lead.assigned_user_id) {
    return { triggered: false };
  }

  // Guard: check if lead already has an active queue entry
  const existing = await sql`
    SELECT id FROM pis_lead_queue
    WHERE lead_id = ${leadId} AND company_id = ${companyId}
      AND status NOT IN ('completed', 'failed')
    LIMIT 1
  `;
  if (existing.length > 0) {
    return { triggered: false };
  }

  // Calculate pipeline value from linked estimate
  const [estRow] = await sql<{ grand_total: number | null }[]>`
    SELECT grand_total FROM estimates
    WHERE lead_id = ${leadId} AND company_id = ${companyId}
    ORDER BY created_at DESC LIMIT 1
  `.catch(() => [{ grand_total: null }] as { grand_total: number | null }[]);
  const pipelineValue = Number(estRow?.grand_total ?? 0);

  // Route lead through PIS engine
  const result = await routeLead(companyId, leadId, pipelineValue);

  if (!result) {
    // No advisor available -- log event for visibility
    await appendLeadEvent({
      companyId,
      leadId,
      eventType: "advisor_auto_assign_no_advisor",
      eventPayload: { reason: "No available advisors" },
      actorUserId: null,
    }).catch(() => {});
    return { triggered: true };
  }

  // Log lead event
  await appendLeadEvent({
    companyId,
    leadId,
    eventType: "advisor_auto_assigned",
    eventPayload: {
      queueId: result.queueId,
      offeredTo: result.offeredTo,
      offeredToName: result.offeredToName,
      tier: result.tier,
      acceptWindowMin: result.acceptWindowMin,
      pipelineValue,
    },
    actorUserId: null,
  }).catch(() => {});

  return {
    triggered: true,
    queueId: result.queueId,
    offeredTo: result.offeredTo,
  };
}

/**
 * Called when an advisor accepts a lead from the queue.
 * Sets the advisor fields on the lead record.
 */
export async function applyAdvisorToLead(
  companyId: string,
  leadId: string,
  advisorUserId: string,
): Promise<void> {
  const sql = getSql();

  // Resolve employee_id from user
  const [user] = await sql<{ employee_id: string | null }[]>`
    SELECT employee_id FROM users WHERE id = ${advisorUserId}
  `;
  const employeeId = user?.employee_id ?? null;

  await sql`
    UPDATE leads
    SET
      agent_employee_id = ${employeeId},
      assigned_user_id = ${advisorUserId},
      assigned_at = now(),
      updated_at = now()
    WHERE id = ${leadId} AND company_id = ${companyId}
  `;

  await appendLeadEvent({
    companyId,
    leadId,
    eventType: "advisor_accepted",
    eventPayload: {
      advisorUserId,
      employeeId,
    },
    actorUserId: advisorUserId,
  }).catch(() => {});
}
