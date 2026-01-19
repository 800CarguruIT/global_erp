import { getSql } from "../../db";
import { getWorkOrderWithItems } from "../workorders/repository";
import type {
  QualityCheck,
  QualityCheckItem,
  QualityCheckItemStatus,
  QualityCheckStatus,
} from "./types";

function mapQcRow(row: any): QualityCheck {
  return {
    id: row.id,
    companyId: row.company_id,
    workOrderId: row.work_order_id,
    estimateId: row.estimate_id,
    inspectionId: row.inspection_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    status: row.status,
    testDriveDone: row.test_drive_done,
    washDone: row.wash_done,
    qcRemarks: row.qc_remarks,
    qcVideoRef: row.qc_video_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQcItemRow(row: any): QualityCheckItem {
  return {
    id: row.id,
    qualityCheckId: row.quality_check_id,
    workOrderItemId: row.work_order_item_id,
    lineNo: row.line_no,
    qcStatus: row.qc_status,
    qcNote: row.qc_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createQualityCheckForWorkOrder(companyId: string, workOrderId: string): Promise<{
  qc: QualityCheck;
  items: QualityCheckItem[];
}> {
  const sql = getSql();
  const woData = await getWorkOrderWithItems(companyId, workOrderId);
  if (!woData) throw new Error("Work order not found");
  const { workOrder, items } = woData;

  const qcRows = await sql`
    INSERT INTO quality_checks (
      company_id,
      work_order_id,
      estimate_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status
    ) VALUES (
      ${companyId},
      ${workOrderId},
      ${workOrder.estimateId ?? null},
      ${workOrder.inspectionId ?? null},
      ${workOrder.leadId ?? null},
      ${workOrder.carId ?? null},
      ${workOrder.customerId ?? null},
      ${"queue" as QualityCheckStatus}
    )
    RETURNING *
  `;
  const qc = mapQcRow(qcRows[0]);

  for (const [idx, item] of items.entries()) {
    await sql`
      INSERT INTO quality_check_items (
        quality_check_id,
        work_order_item_id,
        line_no,
        qc_status
      ) VALUES (
        ${qc.id},
        ${item.id},
        ${item.lineNo ?? idx + 1},
        ${"pending" as QualityCheckItemStatus}
      )
    `;
  }

  const qcItems = await getQualityCheckItems(qc.id);
  return { qc, items: qcItems };
}

export async function getQualityCheckWithItems(
  companyId: string,
  qcId: string
): Promise<{ qc: QualityCheck; items: QualityCheckItem[] } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM quality_checks
    WHERE company_id = ${companyId} AND id = ${qcId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const qc = mapQcRow(rows[0]);
  const items = await getQualityCheckItems(qcId);
  return { qc, items };
}

export async function listQualityChecksForCompany(
  companyId: string,
  opts: { status?: QualityCheckStatus } = {}
): Promise<QualityCheck[]> {
  const sql = getSql();
  const whereParts: any[] = [sql`company_id = ${companyId}`];
  if (opts.status) whereParts.push(sql`status = ${opts.status}`);
  const where =
    whereParts.length === 1
      ? whereParts[0]
      : whereParts.reduce((acc, frag, idx) => (idx === 0 ? frag : sql`${acc} AND ${frag}`));

  const rows = await sql`
    SELECT *
    FROM quality_checks
    WHERE ${where}
    ORDER BY updated_at DESC
  `;
  return rows.map(mapQcRow);
}

export async function updateQualityCheckHeader(
  companyId: string,
  qcId: string,
  patch: Partial<{
    status: QualityCheckStatus;
    testDriveDone: boolean;
    washDone: boolean;
    qcRemarks: string | null;
    qcVideoRef: string | null;
  }>
): Promise<void> {
  const sql = getSql();
  const updated = {
    status: patch.status,
    test_drive_done: patch.testDriveDone,
    wash_done: patch.washDone,
    qc_remarks: patch.qcRemarks,
    qc_video_ref: patch.qcVideoRef,
  };
  await sql`
    UPDATE quality_checks
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${qcId}
  `;
}

export async function updateQualityCheckItems(
  companyId: string,
  qcId: string,
  items: Array<{ id: string; qcStatus?: QualityCheckItemStatus; qcNote?: string | null }>
): Promise<void> {
  const sql = getSql();
  for (const item of items) {
    await sql`
      UPDATE quality_check_items
      SET
        qc_status = ${item.qcStatus ?? null},
        qc_note = ${item.qcNote ?? null}
      WHERE id = ${item.id} AND quality_check_id = ${qcId}
    `;
  }
}

export async function completeQualityCheck(companyId: string, qcId: string): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE quality_checks
    SET status = 'completed'
    WHERE company_id = ${companyId} AND id = ${qcId}
  `;

  const rows = await sql`
    SELECT work_order_id FROM quality_checks
    WHERE id = ${qcId} AND company_id = ${companyId}
    LIMIT 1
  `;
  if (rows.length) {
    const woId = rows[0]?.work_order_id as string | undefined;
    if (woId) {
      await sql`
        UPDATE work_orders
        SET status = 'completed', updated_at = now()
        WHERE id = ${woId} AND company_id = ${companyId}
      `;
    }
  }
}

async function getQualityCheckItems(qcId: string): Promise<QualityCheckItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM quality_check_items
    WHERE quality_check_id = ${qcId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapQcItemRow);
}
