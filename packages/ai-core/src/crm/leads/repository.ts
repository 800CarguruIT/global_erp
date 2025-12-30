import { getSql } from "../../db";
import type { Lead, LeadEvent, LeadStatus } from "./types";

export type CreateLeadInput = {
  companyId: string;
  customerId?: string | null;
  carId?: string | null;
  branchId?: string | null;
  assignedUserId?: string | null;
  serviceType?: string | null;
  assignedAt?: string | null;
  recoveryDirection?: string | null;
  recoveryFlow?: string | null;
  pickupFrom?: string | null;
  dropoffTo?: string | null;
  pickupGoogleLocation?: string | null;
  dropoffGoogleLocation?: string | null;
  customerDetailsRequested?: boolean | null;
  customerDetailsApproved?: boolean | null;
  agentEmployeeId?: string | null;
  leadType?: Lead["leadType"];
  source?: string | null;
  leadStage?: string | null;
};

let leadAssignmentColumnsSupported: boolean | null = null;
async function ensureLeadAssignmentColumns(): Promise<boolean> {
  if (leadAssignmentColumnsSupported !== null) return leadAssignmentColumnsSupported;
  const sql = getSql();
  try {
    const res = await sql/* sql */ `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'leads'
        AND column_name IN (
          'branch_id',
          'assigned_user_id',
          'service_type',
          'assigned_at',
          'customer_details_requested',
          'customer_details_approved',
          'recovery_direction',
          'recovery_flow',
          'pickup_from',
          'dropoff_to',
          'pickup_google_location',
          'dropoff_google_location'
        )
    `;
    const names = (res as any)?.map((r: any) => r.column_name) ?? [];
    const missing = [
      "branch_id",
      "assigned_user_id",
      "service_type",
      "assigned_at",
      "customer_details_requested",
      "customer_details_approved",
      "recovery_direction",
      "recovery_flow",
      "pickup_from",
      "dropoff_to",
      "pickup_google_location",
      "dropoff_google_location",
    ].filter((c) => !names.includes(c));
    if (missing.length) {
      // add columns if they don't exist; keep null defaults to avoid migrations blocking
      await sql/* sql */ `
        ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS branch_id uuid NULL,
        ADD COLUMN IF NOT EXISTS assigned_user_id uuid NULL,
        ADD COLUMN IF NOT EXISTS service_type text NULL,
        ADD COLUMN IF NOT EXISTS assigned_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS customer_details_requested boolean NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS customer_details_approved boolean NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS recovery_direction text NULL,
        ADD COLUMN IF NOT EXISTS recovery_flow text NULL,
        ADD COLUMN IF NOT EXISTS pickup_from text NULL,
        ADD COLUMN IF NOT EXISTS dropoff_to text NULL,
        ADD COLUMN IF NOT EXISTS pickup_google_location text NULL,
        ADD COLUMN IF NOT EXISTS dropoff_google_location text NULL
      `;
    }
    leadAssignmentColumnsSupported = true;
  } catch {
    leadAssignmentColumnsSupported = false;
  }
  return leadAssignmentColumnsSupported;
}

export async function listLeadsForCompany(companyId: string): Promise<Lead[]> {
  const sql = getSql();
  await releaseExpiredAssignments(companyId, 5);
  const rows =
    await sql/* sql */ `
      SELECT
        l.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        car.plate_number AS car_plate_number,
        car.model AS car_model,
        e.full_name AS agent_name,
        l.customer_details_requested,
        l.customer_details_approved,
        l.recovery_direction,
        l.recovery_flow,
        l.pickup_from,
        l.dropoff_to
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      LEFT JOIN employees e ON e.id = l.agent_employee_id
      WHERE l.company_id = ${companyId}
      ORDER BY l.created_at DESC
    `;
  return rows.map(mapLeadRow);
}

export async function getLeadById(companyId: string, leadId: string): Promise<Lead | null> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `
      SELECT
        l.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        car.plate_number AS car_plate_number,
        car.model AS car_model,
        e.full_name AS agent_name,
        l.customer_details_requested,
        l.customer_details_approved,
        l.recovery_direction,
        l.recovery_flow,
        l.pickup_from,
        l.dropoff_to
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      LEFT JOIN employees e ON e.id = l.agent_employee_id
      WHERE l.company_id = ${companyId} AND l.id = ${leadId}
      LIMIT 1
    `;
  const row = rows[0];
  return row ? mapLeadRow(row) : null;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const sql = getSql();
  const leadType = input.leadType ?? "rsa";
  const leadStatus: LeadStatus = "open";
  const leadStage = input.leadStage ?? "new";
  const supportsAssignments = await ensureLeadAssignmentColumns();
  const rows = supportsAssignments
    ? await sql/* sql */ `
        INSERT INTO leads (
          company_id,
          customer_id,
          car_id,
          branch_id,
          assigned_user_id,
          service_type,
          assigned_at,
          recovery_direction,
          recovery_flow,
          pickup_from,
          dropoff_to,
          pickup_google_location,
          dropoff_google_location,
          customer_details_requested,
          customer_details_approved,
          agent_employee_id,
          lead_type,
          lead_status,
          lead_stage,
          source,
          is_locked
        )
        VALUES (
          ${input.companyId},
          ${input.customerId ?? null},
          ${input.carId ?? null},
          ${input.branchId ?? null},
          ${input.assignedUserId ?? null},
          ${input.serviceType ?? null},
          ${input.assignedAt ?? null},
          ${input.recoveryDirection ?? null},
          ${input.recoveryFlow ?? null},
          ${input.pickupFrom ?? null},
          ${input.dropoffTo ?? null},
          ${input.pickupGoogleLocation ?? null},
          ${input.dropoffGoogleLocation ?? null},
          ${input.customerDetailsRequested ?? false},
          ${input.customerDetailsApproved ?? false},
          ${input.agentEmployeeId ?? null},
          ${leadType},
          ${leadStatus},
          ${leadStage},
          ${input.source ?? null},
          ${false}
        )
        RETURNING *
      `
    : await sql/* sql */ `
        INSERT INTO leads (
          company_id,
          customer_id,
          car_id,
          agent_employee_id,
          lead_type,
          lead_status,
          lead_stage,
          source,
          is_locked
        )
        VALUES (
          ${input.companyId},
          ${input.customerId ?? null},
          ${input.carId ?? null},
          ${input.agentEmployeeId ?? null},
          ${leadType},
          ${leadStatus},
          ${leadStage},
          ${input.source ?? null},
          ${false}
        )
        RETURNING *
      `;
  return mapLeadRow(rows[0]);
}

export async function listLeadEvents(companyId: string, leadId: string): Promise<LeadEvent[]> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `
      SELECT le.*, COALESCE(u.full_name, u.email, le.actor_user_id::text) AS actor_name
      FROM lead_events le
      LEFT JOIN users u ON u.id = le.actor_user_id
      WHERE le.company_id = ${companyId} AND le.lead_id = ${leadId}
      ORDER BY le.created_at ASC
    `;
  return rows.map(mapLeadEventRow);
}

function mapLeadRow(row: any): Lead {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    carId: row.car_id,
    branchId: row.branch_id ?? null,
    assignedUserId: row.assigned_user_id ?? null,
    serviceType: row.service_type ?? null,
    assignedAt: row.assigned_at ? new Date(row.assigned_at).toISOString() : null,
    recoveryDirection: row.recovery_direction ?? null,
    recoveryFlow: row.recovery_flow ?? null,
    pickupFrom: row.pickup_from ?? null,
    dropoffTo: row.dropoff_to ?? null,
    pickupGoogleLocation: row.pickup_google_location ?? null,
    dropoffGoogleLocation: row.dropoff_google_location ?? null,
    agentEmployeeId: row.agent_employee_id,
    leadType: row.lead_type,
    leadStatus: row.lead_status,
    leadStage: row.lead_stage,
    source: row.source,
    slaMinutes: row.sla_minutes,
    firstResponseAt: row.first_response_at,
  lastActivityAt: row.last_activity_at,
  closedAt: row.closed_at,
  isLocked: row.is_locked,
  healthScore: row.health_score,
  sentimentScore: row.sentiment_score,
  customerFeedback: row.customer_feedback,
  agentRemark: row.agent_remark,
  customerRemark: row.customer_remark,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    carPlateNumber: row.car_plate_number,
    carModel: row.car_model,
    agentName: row.agent_name,
    customerDetailsRequested: row.customer_details_requested ?? false,
    customerDetailsApproved: row.customer_details_approved ?? false,
  };
}

function mapLeadEventRow(row: any): LeadEvent {
  return {
    id: row.id,
    leadId: row.lead_id,
    companyId: row.company_id,
    actorUserId: row.actor_user_id,
    actorEmployeeId: row.actor_employee_id,
    actorName: row.actor_name ?? null,
    eventType: row.event_type,
    eventPayload: row.event_payload,
    createdAt: row.created_at,
  };
}

export async function appendLeadEvent(args: {
  companyId: string;
  leadId: string;
  actorUserId?: string | null;
  actorEmployeeId?: string | null;
  eventType: string;
  eventPayload?: any;
}): Promise<void> {
  const sql = getSql();
  const { companyId, leadId, actorUserId = null, actorEmployeeId = null, eventType, eventPayload = null } = args;
  await sql/* sql */ `
    INSERT INTO lead_events (
      lead_id,
      company_id,
      actor_user_id,
      actor_employee_id,
      event_type,
      event_payload
    )
    VALUES (
      ${leadId},
      ${companyId},
      ${actorUserId},
      ${actorEmployeeId},
      ${eventType},
      ${eventPayload}
    )
  `;
}

function computeHealthScoreFromSla(args: {
  slaMinutes: number | null;
  createdAt: Date;
  closedAt: Date | null;
  sentimentScore: number | null;
}): number | null {
  const { slaMinutes, createdAt, closedAt, sentimentScore } = args;
  if (!slaMinutes || slaMinutes <= 0) {
    return 70;
  }
  const now = closedAt ?? new Date();
  const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

  let base: number;
  const ratio = elapsedMinutes / slaMinutes;
  if (ratio <= 0.5) base = 95;
  else if (ratio <= 1) base = 75;
  else if (ratio <= 2) base = 50;
  else base = 25;

  let sentimentAdj = 0;
  if (typeof sentimentScore === "number") {
    if (sentimentScore > 30) sentimentAdj = 5;
    else if (sentimentScore < -30) sentimentAdj = -15;
  }

  const score = Math.max(0, Math.min(100, base + sentimentAdj));
  return score;
}

export async function releaseExpiredAssignments(companyId: string, timeoutMinutes = 5): Promise<void> {
  const sql = getSql();
  const supported = await ensureLeadAssignmentColumns();
  if (!supported) return;
  try {
    await sql/* sql */ `
      UPDATE leads
      SET branch_id = NULL, assigned_user_id = NULL, assigned_at = NULL
      WHERE company_id = ${companyId}
        AND lead_type = 'rsa'
        AND lead_status = 'open'
        AND lead_stage IN ('new', 'assigned')
        AND assigned_at IS NOT NULL
        AND assigned_at < now() - (${timeoutMinutes} || ' minutes')::interval
    `;
  } catch (err: any) {
    if (err?.code === "42703") {
      // column missing, skip silently
      leadAssignmentColumnsSupported = false;
      return;
    }
    throw err;
  }
}

export async function updateLeadPartial(
  companyId: string,
  leadId: string,
  patch: {
    leadStatus?: LeadStatus;
    leadStage?: string;
    branchId?: string | null;
    assignedUserId?: string | null;
    serviceType?: string | null;
    assignedAt?: string | null;
    recoveryDirection?: string | null;
    recoveryFlow?: string | null;
    pickupFrom?: string | null;
    dropoffTo?: string | null;
    customerDetailsRequested?: boolean;
    customerDetailsApproved?: boolean;
    isArchived?: boolean;
    agentRemark?: string | null;
    customerRemark?: string | null;
    customerFeedback?: string | null;
    sentimentScore?: number | null;
  }
): Promise<void> {
  const supportsAssignments = await ensureLeadAssignmentColumns();
  const current = await getLeadById(companyId, leadId);
  if (!current) {
    throw new Error("Lead not found");
  }
  if (current.isLocked) {
    throw new Error("Lead is closed and cannot be edited");
  }

  const archiveStage = patch.isArchived ? "archived" : undefined;
  const newStatus = patch.isArchived ? "closed" : patch.leadStatus ?? current.leadStatus;
  const newStage = archiveStage ?? patch.leadStage ?? current.leadStage;
  const newAgentRemark = patch.agentRemark !== undefined ? patch.agentRemark : current.agentRemark ?? null;
  const newCustomerRemark =
    patch.customerRemark !== undefined ? patch.customerRemark : current.customerRemark ?? null;
  const newCustomerFeedback =
    patch.customerFeedback !== undefined ? patch.customerFeedback : current.customerFeedback ?? null;
  const newSentimentScore =
    patch.sentimentScore !== undefined ? patch.sentimentScore : current.sentimentScore ?? null;
  const newBranchId = supportsAssignments
    ? patch.branchId !== undefined
      ? patch.branchId
      : current.branchId ?? null
    : null;
  const newAssignedUserId =
    supportsAssignments && patch.assignedUserId !== undefined
      ? patch.assignedUserId
      : supportsAssignments
        ? current.assignedUserId ?? null
        : null;
  const newServiceType =
    supportsAssignments && patch.serviceType !== undefined ? patch.serviceType : supportsAssignments ? current.serviceType ?? null : null;
  const newRecoveryDirection =
    supportsAssignments && patch.recoveryDirection !== undefined
      ? patch.recoveryDirection
      : supportsAssignments
        ? current.recoveryDirection ?? null
        : null;
  const newRecoveryFlow =
    supportsAssignments && patch.recoveryFlow !== undefined
      ? patch.recoveryFlow
      : supportsAssignments
        ? current.recoveryFlow ?? null
        : null;
  const newPickupFrom =
    supportsAssignments && patch.pickupFrom !== undefined ? patch.pickupFrom : supportsAssignments ? current.pickupFrom ?? null : null;
  const newDropoffTo =
    supportsAssignments && patch.dropoffTo !== undefined ? patch.dropoffTo : supportsAssignments ? current.dropoffTo ?? null : null;
  const newPickupGoogle =
    supportsAssignments && (patch as any).pickupGoogleLocation !== undefined
      ? (patch as any).pickupGoogleLocation
      : supportsAssignments
        ? (current as any).pickupGoogleLocation ?? null
        : null;
  const newDropoffGoogle =
    supportsAssignments && (patch as any).dropoffGoogleLocation !== undefined
      ? (patch as any).dropoffGoogleLocation
      : supportsAssignments
        ? (current as any).dropoffGoogleLocation ?? null
        : null;
  const newAssignedAt =
    supportsAssignments && patch.assignedAt !== undefined
      ? patch.assignedAt
      : supportsAssignments && current.assignedAt && newAssignedUserId
        ? current.assignedAt
        : null;
  const newCustomerRequested =
    supportsAssignments && patch.customerDetailsRequested !== undefined
      ? patch.customerDetailsRequested
      : supportsAssignments
        ? current.customerDetailsRequested ?? false
        : false;
  const newCustomerApproved =
    supportsAssignments && patch.customerDetailsApproved !== undefined
      ? patch.customerDetailsApproved
      : supportsAssignments
        ? current.customerDetailsApproved ?? false
        : false;

  const newClosedAt =
    newStatus === "closed_won" || newStatus === "lost"
      ? current.closedAt ?? new Date().toISOString()
      : current.closedAt;

  const healthScore = computeHealthScoreFromSla({
    slaMinutes: current.slaMinutes,
    createdAt: new Date(current.createdAt),
    closedAt: newClosedAt ? new Date(newClosedAt) : null,
    sentimentScore: newSentimentScore,
  });

  const sql = getSql();
  if (supportsAssignments) {
    await sql/* sql */ `
      UPDATE leads
      SET
        lead_status = ${newStatus},
        lead_stage = ${newStage},
        branch_id = ${newBranchId},
        assigned_user_id = ${newAssignedUserId},
        service_type = ${newServiceType},
        recovery_direction = ${newRecoveryDirection},
        recovery_flow = ${newRecoveryFlow},
        pickup_from = ${newPickupFrom},
        dropoff_to = ${newDropoffTo},
        pickup_google_location = ${newPickupGoogle},
        dropoff_google_location = ${newDropoffGoogle},
        assigned_at = ${newAssignedUserId ? newAssignedAt ?? new Date().toISOString() : null},
        customer_details_requested = ${newCustomerRequested},
        customer_details_approved = ${newCustomerApproved},
        agent_remark = ${newAgentRemark},
        customer_remark = ${newCustomerRemark},
        customer_feedback = ${newCustomerFeedback},
        sentiment_score = ${newSentimentScore},
        closed_at = ${newClosedAt},
        health_score = ${healthScore},
        updated_at = now()
      WHERE company_id = ${companyId} AND id = ${leadId}
    `;
  } else {
    await sql/* sql */ `
      UPDATE leads
      SET
        lead_status = ${newStatus},
        lead_stage = ${newStage},
        agent_remark = ${newAgentRemark},
        customer_remark = ${newCustomerRemark},
        customer_feedback = ${newCustomerFeedback},
        sentiment_score = ${newSentimentScore},
        closed_at = ${newClosedAt},
        health_score = ${healthScore},
        updated_at = now()
      WHERE company_id = ${companyId} AND id = ${leadId}
    `;
  }
}

export async function lockLead(companyId: string, leadId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    UPDATE leads
    SET
      lead_status = 'closed',
      is_locked = TRUE,
      closed_at = COALESCE(closed_at, now()),
      updated_at = now()
    WHERE company_id = ${companyId} AND id = ${leadId}
  `;
}

export async function deleteLead(companyId: string, leadId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM lead_events WHERE company_id = ${companyId} AND lead_id = ${leadId}
  `;
  await sql/* sql */ `
    DELETE FROM leads WHERE company_id = ${companyId} AND id = ${leadId}
  `;
}
