import { getSql } from "../../db";
import { getEstimateWithItems } from "../estimates/repository";
import type { WorkLineStatus, WorkOrder, WorkOrderItem, WorkOrderStatus } from "./types";
import type { LeadType } from "../../crm/leads/types";

function mapWorkOrderRow(row: any): WorkOrder {
  return {
    id: row.id,
    companyId: row.company_id,
    estimateId: row.estimate_id,
    inspectionId: row.inspection_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    branchId: row.branch_id,
    status: row.status,
    queueReason: row.queue_reason,
    workStartedAt: row.work_started_at,
    workCompletedAt: row.work_completed_at,
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkOrderItemRow(row: any): WorkOrderItem {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    estimateItemId: row.estimate_item_id,
    lineNo: row.line_no,
    partName: row.part_name,
    description: row.description,
    isPart: row.is_part,
    isLabor: row.is_labor,
    requiredQty: Number(row.required_qty),
    issuedQty: Number(row.issued_qty),
    workStatus: row.work_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createWorkOrderFromEstimate(companyId: string, estimateId: string): Promise<{ workOrder: WorkOrder; items: WorkOrderItem[] }> {
  const sql = getSql();
  const estimateData = await getEstimateWithItems(companyId, estimateId);
  if (!estimateData) throw new Error("Estimate not found");
  const { estimate, items } = estimateData;
  const itemsToCopy = (items as any[]).filter((item) => item.status === "approved");

  const woRows = await sql`
    INSERT INTO work_orders (
      company_id,
      estimate_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status
    ) VALUES (
      ${companyId},
      ${estimateId},
      ${estimate.inspectionId ?? null},
      ${estimate.leadId ?? null},
      ${estimate.carId ?? null},
      ${estimate.customerId ?? null},
      ${"quoting" as WorkOrderStatus}
    )
    RETURNING *
  `;
  const workOrder = mapWorkOrderRow(woRows[0]);

  for (const [idx, item] of itemsToCopy.entries()) {
    const lineStatus: WorkLineStatus =
      item.procurementStatus === "received" || item.procurementStatus === "issued" ? "ready" : "waiting_parts";
    await sql`
      INSERT INTO work_order_items (
        work_order_id,
        estimate_item_id,
        line_no,
        part_name,
        description,
        is_part,
        is_labor,
        required_qty,
        issued_qty,
        work_status
      ) VALUES (
        ${workOrder.id},
        ${item.id},
        ${item.lineNo ?? idx + 1},
        ${item.partName},
        ${item.description ?? null},
        ${item.isPart ?? true},
        ${item.isLabor ?? false},
        ${item.quantity ?? 1},
        ${item.issuedQty ?? 0},
        ${lineStatus}
      )
    `;
  }

  const itemsInserted = await getWorkOrderItems(workOrder.id);
  return { workOrder, items: itemsInserted };
}

export async function createWorkOrderForInspection(
  companyId: string,
  inspectionId: string,
  leadId: string | null,
  carId: string | null,
  customerId: string | null
): Promise<WorkOrder> {
  const sql = getSql();
  const woRows = await sql/* sql */ `
    INSERT INTO work_orders (
      company_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status
    ) VALUES (
      ${companyId},
      ${inspectionId},
      ${leadId ?? null},
      ${carId ?? null},
      ${customerId ?? null},
      ${"quoting" as WorkOrderStatus}
    )
    RETURNING *
  `;
  return mapWorkOrderRow(woRows[0]);
}

export async function listWorkOrdersForCompany(
  companyId: string,
  opts: { status?: WorkOrderStatus; branchId?: string | null } = {}
): Promise<WorkOrder[]> {
  const sql = getSql();
  const { status, branchId } = opts;
  const whereParts: any[] = [sql`company_id = ${companyId}`];
  if (status) whereParts.push(sql`status = ${status}`);
  if (branchId) whereParts.push(sql`branch_id = ${branchId}`);
  const where =
    whereParts.length === 1
      ? whereParts[0]
      : whereParts.reduce((acc, fragment, idx) => (idx === 0 ? fragment : sql`${acc} AND ${fragment}`));

  const rows = await sql`
    SELECT * FROM work_orders
    WHERE ${where}
    ORDER BY updated_at DESC
  `;
  return rows.map(mapWorkOrderRow);
}

export async function getWorkOrderWithItems(
  companyId: string,
  workOrderId: string
): Promise<{ workOrder: WorkOrder; items: WorkOrderItem[] } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM work_orders
    WHERE company_id = ${companyId} AND id = ${workOrderId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const workOrder = mapWorkOrderRow(rows[0]);
  const items = await getWorkOrderItems(workOrderId);
  return { workOrder, items };
}

export async function updateWorkOrderHeader(
  companyId: string,
  workOrderId: string,
  patch: Partial<{
    status: WorkOrderStatus;
    branchId: string | null;
    queueReason: string | null;
    workStartedAt: string | null;
    workCompletedAt: string | null;
    meta: any;
  }>
): Promise<void> {
  const sql = getSql();
  const updated = {
    status: patch.status,
    branch_id: patch.branchId,
    queue_reason: patch.queueReason,
    work_started_at: patch.workStartedAt,
    work_completed_at: patch.workCompletedAt,
    meta: patch.meta,
  };
  await sql`
    UPDATE work_orders
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${workOrderId}
  `;
}

export async function updateWorkOrderItemsStatuses(
  companyId: string,
  workOrderId: string,
  items: Array<{ id: string; workStatus?: WorkLineStatus; issuedQty?: number }>
): Promise<void> {
  const sql = getSql();
  for (const item of items) {
    const issuedValue = item.issuedQty != null ? item.issuedQty : null;
    await sql`
      UPDATE work_order_items
      SET
        work_status = ${item.workStatus ?? null},
        issued_qty = COALESCE(${issuedValue}, issued_qty)
      WHERE id = ${item.id} AND work_order_id = ${workOrderId}
    `;
  }

  const remaining = await sql`
    SELECT COUNT(*) AS pending_count
    FROM work_order_items
    WHERE work_order_id = ${workOrderId} AND work_status <> 'completed'
  `;
  const pendingCount = Number(remaining[0]?.pending_count ?? 0);
  if (pendingCount === 0) {
    await sql`
      UPDATE work_orders
      SET status = 'completed', work_completed_at = now()
      WHERE company_id = ${companyId} AND id = ${workOrderId}
    `;
  }
}

export async function attachMediaToWorkOrderItem(args: {
  companyId: string;
  workOrderId: string;
  workOrderItemId: string | null;
  kind: string;
  fileRef: string;
  note?: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO work_order_media (
      work_order_id,
      work_order_item_id,
      kind,
      file_ref,
      note
    ) VALUES (
      ${args.workOrderId},
      ${args.workOrderItemId},
      ${args.kind},
      ${args.fileRef},
      ${args.note ?? null}
    )
  `;
}

async function getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM work_order_items
    WHERE work_order_id = ${workOrderId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapWorkOrderItemRow);
}
