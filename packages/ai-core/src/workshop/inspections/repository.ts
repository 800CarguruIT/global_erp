import { getSql } from "../../db";
import type { Inspection, InspectionItem, InspectionLineItem, InspectionStatus, LineItemStatus } from "./types";

function mapInspectionRow(row: any): Inspection {
  return {
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    inspectorEmployeeId: row.inspector_employee_id,
    advisorEmployeeId: row.advisor_employee_id,
    status: row.status,
    startAt: row.start_at,
    completeAt: row.complete_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancelRemarks: row.cancel_remarks,
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

function mapLineItemRow(row: any): InspectionLineItem {
  return {
    id: row.id,
    companyId: row.company_id,
    leadId: row.lead_id,
    inspectionId: row.inspection_id,
    jobCardId: row.job_card_id,
    isAdd: row.is_add,
    source: row.source,
    productId: row.product_id,
    productName: row.product_name,
    description: row.description,
    quantity: row.quantity,
    reason: row.reason,
    status: row.status,
    mediaFileId: row.media_file_id,
    partOrdered: row.part_ordered,
    orderStatus: row.order_status,
    quoteCosts:
      row.quote_costs ??
      row.quoteCosts ??
      undefined,
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

export async function listInspectionsForCustomer(
  companyId: string,
  customerId: string,
  opts: { status?: InspectionStatus; limit?: number } = {}
): Promise<Inspection[]> {
  const sql = getSql();
  const { status, limit = 100 } = opts;
  const where =
    status != null
      ? sql`company_id = ${companyId} AND customer_id = ${customerId} AND status = ${status}`
      : sql`company_id = ${companyId} AND customer_id = ${customerId}`;
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

export async function getLatestInspectionForLead(
  companyId: string,
  leadId: string
): Promise<Inspection | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM inspections
    WHERE company_id = ${companyId} AND lead_id = ${leadId}
    ORDER BY created_at DESC
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
  branchId?: string | null;
  inspectorEmployeeId?: string | null;
  advisorEmployeeId?: string | null;
  status?: InspectionStatus;
  startAt?: string | null;
  completeAt?: string | null;
  customerRemark?: string | null;
  agentRemark?: string | null;
  draftPayload?: any | null;
}): Promise<Inspection> {
  const sql = getSql();
  const status = args.status ?? ("pending" as InspectionStatus);
  const startAt = args.startAt ?? (status === "pending" ? new Date().toISOString() : null);
  const completeAt = args.completeAt ?? (status === "completed" ? new Date().toISOString() : null);
  const rows = await sql`
    INSERT INTO inspections (
      company_id,
      lead_id,
      car_id,
      customer_id,
      branch_id,
      inspector_employee_id,
      advisor_employee_id,
      status,
      start_at,
      complete_at,
      customer_remark,
      agent_remark,
      draft_payload
    ) VALUES (
      ${args.companyId},
      ${args.leadId ?? null},
      ${args.carId ?? null},
      ${args.customerId ?? null},
      ${args.branchId ?? null},
      ${args.inspectorEmployeeId ?? null},
      ${args.advisorEmployeeId ?? null},
      ${status},
      ${startAt},
      ${completeAt},
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
    startAt?: string | null;
    completeAt?: string | null;
    verifiedBy: string | null;
    verifiedAt: string | null;
    cancelledBy: string | null;
    cancelledAt: string | null;
    cancelRemarks: string | null;
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
    start_at: patch.startAt,
    complete_at:
      patch.completeAt ??
      (patch.status === "completed" ? new Date().toISOString() : undefined),
    verified_by: patch.verifiedBy,
    verified_at: patch.verifiedAt,
    cancelled_by: patch.cancelledBy,
    cancelled_at: patch.cancelledAt,
    cancel_remarks: patch.cancelRemarks,
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

  const cleaned = Object.fromEntries(
    Object.entries(updated).filter(([, value]) => value !== undefined)
  );

  await sql`
    UPDATE inspections
    SET ${sql(cleaned)}
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

export async function listInspectionLineItems(
  inspectionId: string,
  opts: { source?: "inspection" | "estimate"; isAdd?: 0 | 1 } = {}
): Promise<InspectionLineItem[]> {
  const sql = getSql();
  const sourceFilter = opts.source ? sql`AND source = ${opts.source}` : sql``;
  const isAddFilter = opts.isAdd !== undefined ? sql`AND is_add = ${opts.isAdd}` : sql``;
  const rows = await sql`
    SELECT *
    FROM line_items
    WHERE inspection_id = ${inspectionId}
      ${sourceFilter}
      ${isAddFilter}
    ORDER BY created_at ASC
  `;
  if (!rows.length) return [];

  const lineItemIds = rows.map((row: any) => row.id).filter(Boolean);
  let quoteStatusByLineItemId = new Map<string, string>();
  let quoteCostsByLineItemId = new Map<
    string,
    { oem?: number; oe?: number; aftm?: number; used?: number }
  >();
  if (lineItemIds.length) {
    const quoteStatusRows = await sql`
      SELECT
        source.line_item_id,
        MAX(
          CASE
            WHEN LOWER(COALESCE(source.status, '')) IN ('received', 'completed') THEN 3
            WHEN LOWER(COALESCE(source.status, '')) IN ('return', 'returned') THEN 2
            WHEN LOWER(COALESCE(source.status, '')) = 'ordered' THEN 1
            ELSE 0
          END
        ) AS status_rank
      FROM (
        SELECT
          li.id AS line_item_id,
          pq.status
        FROM line_items li
        INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        WHERE li.id = ANY(${lineItemIds})
        UNION ALL
        SELECT
          ei.inspection_item_id AS line_item_id,
          pq.status
        FROM estimate_items ei
        INNER JOIN part_quotes pq ON pq.estimate_item_id = ei.id
        WHERE ei.inspection_item_id = ANY(${lineItemIds})
      ) source
      GROUP BY source.line_item_id
    `;
    quoteStatusByLineItemId = new Map(
      quoteStatusRows.map((row: any) => {
        const rank = Number(row.status_rank ?? 0);
        const derived =
          rank >= 3 ? "Received" : rank === 2 ? "Returned" : rank === 1 ? "Ordered" : "";
        return [String(row.line_item_id), derived] as const;
      })
    );

    const quoteCostRows = await sql`
      SELECT
        line_item_id,
        MIN(oem) AS oem,
        MIN(oe) AS oe,
        MIN(aftm) AS aftm,
        MIN(used) AS used
      FROM part_quotes
      WHERE line_item_id = ANY(${lineItemIds})
      GROUP BY line_item_id
    `;
    quoteCostsByLineItemId = new Map(
      quoteCostRows.map((row: any) => {
        const costs: { oem?: number; oe?: number; aftm?: number; used?: number } = {};
        if (row.oem != null) costs.oem = Number(row.oem);
        if (row.oe != null) costs.oe = Number(row.oe);
        if (row.aftm != null) costs.aftm = Number(row.aftm);
        if (row.used != null) costs.used = Number(row.used);
        return [String(row.line_item_id), costs] as const;
      })
    );
  }

  const mergedRows = rows.map((row: any) => {
    const derivedStatus = quoteStatusByLineItemId.get(String(row.id));
    const quoteCosts = quoteCostsByLineItemId.get(String(row.id));
    if (!derivedStatus && !quoteCosts) return row;
    const next: any = {
      ...row,
      ...(derivedStatus
        ? {
            part_ordered: row.part_ordered ?? 1,
            order_status: derivedStatus,
          }
        : {}),
      ...(quoteCosts ? { quote_costs: quoteCosts } : {}),
    };
    return next;
  });
  return mergedRows.map(mapLineItemRow);
}

export async function createInspectionLineItem(args: {
  companyId: string;
  leadId?: string | null;
  inspectionId: string;
  source?: "inspection" | "estimate";
  isAdd?: 0 | 1;
  productId?: number | null;
  productName?: string | null;
  description?: string | null;
  quantity?: number | null;
  reason?: string | null;
  status?: LineItemStatus;
  mediaFileId?: string | null;
}): Promise<InspectionLineItem> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO line_items (
      company_id,
      lead_id,
      inspection_id,
      source,
      order_status,
      is_add,
      product_id,
      product_name,
      description,
      quantity,
      reason,
      status,
      media_file_id
    ) VALUES (
      ${args.companyId},
      ${args.leadId ?? null},
      ${args.inspectionId},
      ${args.source ?? "inspection"},
      ${"Pending"},
      ${args.isAdd ?? 0},
      ${args.productId ?? null},
      ${args.productName ?? null},
      ${args.description ?? null},
      ${args.quantity ?? 1},
      ${args.reason ?? null},
      ${args.status ?? "Pending"},
      ${args.mediaFileId ?? null}
    )
    RETURNING *
  `;
  return mapLineItemRow(rows[0]);
}

export async function updateInspectionLineItem(args: {
  companyId: string;
  lineItemId: string;
  patch: Partial<{
    isAdd?: 0 | 1;
    productId?: number | null;
    productName?: string | null;
    description?: string | null;
    quantity?: number | null;
    reason?: string | null;
    status?: LineItemStatus;
    mediaFileId?: string | null;
  }>;
}): Promise<InspectionLineItem | null> {
  const sql = getSql();
  const updated = {
    is_add: args.patch.isAdd,
    product_id: args.patch.productId,
    product_name: args.patch.productName,
    description: args.patch.description,
    quantity: args.patch.quantity,
    reason: args.patch.reason,
    status: args.patch.status,
    media_file_id: args.patch.mediaFileId,
  };
  const cleaned = Object.fromEntries(
    Object.entries(updated).filter(([, value]) => value !== undefined)
  );
  const rows = await sql`
    UPDATE line_items
    SET ${sql(cleaned)}
    WHERE company_id = ${args.companyId} AND id = ${args.lineItemId}
    RETURNING *
  `;
  if (!rows.length) return null;
  return mapLineItemRow(rows[0]);
}

export async function deleteInspectionLineItem(
  companyId: string,
  lineItemId: string
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM line_items
    WHERE company_id = ${companyId} AND id = ${lineItemId}
  `;
}

export async function markApprovedLineItemsOrdered(
  inspectionId: string
): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE line_items
    SET part_ordered = 1,
        order_status = 'Ordered'
    WHERE inspection_id = ${inspectionId} AND status = 'Approved'
    RETURNING id
  `;
  return rows.length;
}

export async function markLineItemsOrderedByNames(
  inspectionId: string,
  names: string[]
): Promise<number> {
  if (!names.length) return 0;
  const sql = getSql();
  const rows = await sql`
    UPDATE line_items
    SET part_ordered = 1,
        order_status = 'Ordered'
    WHERE inspection_id = ${inspectionId}
      AND product_name = ANY(${sql.array(names)})
    RETURNING id
  `;
  return rows.length;
}
