import { getSql } from "../../db";
import type { Inspection, InspectionItem, InspectionStatus } from "./types";

function mapInspectionRow(row: any): Inspection {
  return {
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    inspectorEmployeeId: row.inspector_employee_id,
    advisorEmployeeId: row.advisor_employee_id,
    status: row.status,
    healthEngine: row.health_engine,
    healthTransmission: row.health_transmission,
    healthBrakes: row.health_brakes,
    healthSuspension: row.health_suspension,
    healthElectrical: row.health_electrical,
    overallHealth: row.overall_health,
    customerRemark: row.customer_remark,
    agentRemark: row.agent_remark,
    inspectorRemark: row.inspector_remark,
    inspectorRemarkLayman: row.inspector_remark_layman,
    aiSummaryMarkdown: row.ai_summary_markdown,
    aiSummaryPlain: row.ai_summary_plain,
    draftPayload: row.draft_payload,
    mediaSummary: row.media_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: any): InspectionItem {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    lineNo: row.line_no,
    category: row.category,
    partName: row.part_name,
    severity: row.severity,
    requiredAction: row.required_action,
    techReason: row.tech_reason,
    laymanReason: row.layman_reason,
    photoRefs: row.photo_refs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listInspectionsForCompany(
  companyId: string,
  opts: { status?: InspectionStatus; limit?: number } = {}
): Promise<Inspection[]> {
  const sql = getSql();
  const { status, limit = 100 } = opts;
  const where = status != null ? sql`company_id = ${companyId} AND status = ${status}` : sql`company_id = ${companyId}`;
  const rows = await sql`
    SELECT *
    FROM inspections
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapInspectionRow);
}

export async function getInspectionById(companyId: string, inspectionId: string): Promise<Inspection | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM inspections
    WHERE company_id = ${companyId} AND id = ${inspectionId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return mapInspectionRow(rows[0]);
}

export async function createInspection(args: {
  companyId: string;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  inspectorEmployeeId?: string | null;
  advisorEmployeeId?: string | null;
  status?: InspectionStatus;
  customerRemark?: string | null;
  agentRemark?: string | null;
  draftPayload?: any | null;
}): Promise<Inspection> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO inspections (
      company_id,
      lead_id,
      car_id,
      customer_id,
      inspector_employee_id,
      advisor_employee_id,
      status,
      customer_remark,
      agent_remark,
      draft_payload
    ) VALUES (
      ${args.companyId},
      ${args.leadId ?? null},
      ${args.carId ?? null},
      ${args.customerId ?? null},
      ${args.inspectorEmployeeId ?? null},
      ${args.advisorEmployeeId ?? null},
      ${args.status ?? ("draft" as InspectionStatus)},
      ${args.customerRemark ?? null},
      ${args.agentRemark ?? null},
      ${args.draftPayload ?? null}
    )
    RETURNING *
  `;
  return mapInspectionRow(rows[0]);
}

export async function updateInspectionPartial(
  companyId: string,
  inspectionId: string,
  patch: Partial<{
    status: InspectionStatus;
    healthEngine: number | null;
    healthTransmission: number | null;
    healthBrakes: number | null;
    healthSuspension: number | null;
    healthElectrical: number | null;
    overallHealth: number | null;
    customerRemark: string | null;
    agentRemark: string | null;
    inspectorRemark: string | null;
    inspectorRemarkLayman: string | null;
    aiSummaryMarkdown: string | null;
    aiSummaryPlain: string | null;
    draftPayload: any | null;
  }>
): Promise<void> {
  const sql = getSql();
  const updated = {
    status: patch.status,
    health_engine: patch.healthEngine,
    health_transmission: patch.healthTransmission,
    health_brakes: patch.healthBrakes,
    health_suspension: patch.healthSuspension,
    health_electrical: patch.healthElectrical,
    overall_health: patch.overallHealth,
    customer_remark: patch.customerRemark,
    agent_remark: patch.agentRemark,
    inspector_remark: patch.inspectorRemark,
    inspector_remark_layman: patch.inspectorRemarkLayman,
    ai_summary_markdown: patch.aiSummaryMarkdown,
    ai_summary_plain: patch.aiSummaryPlain,
    draft_payload: patch.draftPayload,
  };

  await sql`
    UPDATE inspections
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${inspectionId}
  `;
}

export async function listInspectionItems(inspectionId: string): Promise<InspectionItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM inspection_items
    WHERE inspection_id = ${inspectionId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapItemRow);
}

export async function replaceInspectionItems(
  inspectionId: string,
  items: Omit<InspectionItem, "id" | "createdAt" | "updatedAt">[]
): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM inspection_items WHERE inspection_id = ${inspectionId}`;
  if (!items.length) return;
  for (const item of items) {
    await sql`
      INSERT INTO inspection_items (
        inspection_id,
        line_no,
        category,
        part_name,
        severity,
        required_action,
        tech_reason,
        layman_reason,
        photo_refs
      ) VALUES (
        ${inspectionId},
        ${item.lineNo},
        ${item.category ?? null},
        ${item.partName},
        ${item.severity ?? null},
        ${item.requiredAction ?? null},
        ${item.techReason ?? null},
        ${item.laymanReason ?? null},
        ${item.photoRefs ?? null}
      )
    `;
  }
}
