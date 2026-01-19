import { getSql } from "../../db";
import { getInspectionById, listInspectionItems } from "../inspections/repository";
import type {
  Estimate,
  EstimateItem,
  EstimateItemStatus,
  EstimateStatus,
} from "./types";

function mapEstimateRow(row: any): Estimate {
  return {
    id: row.id,
    companyId: row.company_id,
    inspectionId: row.inspection_id,
    leadId: row.lead_id,
    carId: row.car_id,
    customerId: row.customer_id,
    status: row.status,
    currency: row.currency,
    vatRate: Number(row.vat_rate),
    totalCost: Number(row.total_cost),
    totalSale: Number(row.total_sale),
    totalDiscount: Number(row.total_discount),
    finalPrice: Number(row.final_price),
    vatAmount: Number(row.vat_amount),
    grandTotal: Number(row.grand_total),
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEstimateItemRow(row: any): EstimateItem {
  return {
    id: row.id,
    estimateId: row.estimate_id,
    inspectionItemId: row.inspection_item_id,
    lineNo: row.line_no,
    partName: row.part_name,
    description: row.description,
    type: row.type,
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    sale: Number(row.sale),
    gpPercent: row.gp_percent != null ? Number(row.gp_percent) : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createEstimateFromInspection(companyId: string, inspectionId: string): Promise<{
  estimate: Estimate;
  items: EstimateItem[];
}> {
  const sql = getSql();
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    throw new Error("Inspection not found");
  }
  const inspectionItems = await listInspectionItems(inspectionId);

  const vatRate = 5.0;

  const estRows = await sql`
    INSERT INTO estimates (
      company_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status,
      currency,
      vat_rate
    ) VALUES (
      ${companyId},
      ${inspectionId},
      ${inspection.leadId ?? null},
      ${inspection.carId ?? null},
      ${inspection.customerId ?? null},
      ${"draft" as EstimateStatus},
      ${null},
      ${vatRate}
    )
    RETURNING *
  `;
  const estimate = mapEstimateRow(estRows[0]);

  for (const [idx, item] of inspectionItems.entries()) {
    await sql`
      INSERT INTO estimate_items (
        estimate_id,
        inspection_item_id,
        line_no,
        part_name,
        description,
        type,
        quantity,
        cost,
        sale,
        gp_percent,
        status
      ) VALUES (
        ${estimate.id},
        ${item.id ?? null},
        ${item.lineNo ?? idx + 1},
        ${item.partName},
        ${item.laymanReason ?? item.techReason ?? null},
        ${"genuine"},
        ${1},
        ${0},
        ${0},
        ${null},
        ${"pending" as EstimateItemStatus}
      )
    `;
  }

  const items = await getEstimateItems(estimate.id);
  await recalculateEstimateTotals(estimate.id);
  const refreshed = await getEstimateWithItems(companyId, estimate.id);
  return {
    estimate: refreshed?.estimate ?? estimate,
    items: refreshed?.items ?? items,
  };
}

export async function createEstimateForLead(args: {
  companyId: string;
  leadId?: string | null;
  carId?: string | null;
  customerId?: string | null;
  status?: EstimateStatus;
  meta?: any;
}): Promise<Estimate> {
  const sql = getSql();
  const vatRate = 5.0;

  const rows = await sql/* sql */ `
    INSERT INTO estimates (
      company_id,
      inspection_id,
      lead_id,
      car_id,
      customer_id,
      status,
      currency,
      vat_rate,
      meta
    ) VALUES (
      ${args.companyId},
      ${null},
      ${args.leadId ?? null},
      ${args.carId ?? null},
      ${args.customerId ?? null},
      ${args.status ?? ("draft" as EstimateStatus)},
      ${null},
      ${vatRate},
      ${args.meta ?? null}
    )
    RETURNING *
  `;

  const estimate = mapEstimateRow(rows[0]);
  await recalculateEstimateTotals(estimate.id);
  const refreshed = await getEstimateWithItems(args.companyId, estimate.id);
  return refreshed?.estimate ?? estimate;
}

export async function getEstimateWithItems(
  companyId: string,
  estimateId: string
): Promise<{ estimate: Estimate; items: EstimateItem[] } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM estimates
    WHERE company_id = ${companyId} AND id = ${estimateId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const estimate = mapEstimateRow(rows[0]);
  const items = await getEstimateItems(estimateId);
  return { estimate, items };
}

export async function listEstimatesForCompany(
  companyId: string,
  opts: { status?: EstimateStatus; limit?: number } = {}
): Promise<Estimate[]> {
  const sql = getSql();
  const { status, limit = 100 } = opts;
  const where =
    status != null ? sql`company_id = ${companyId} AND status = ${status}` : sql`company_id = ${companyId}`;
  const rows = await sql`
    SELECT *
    FROM estimates
    WHERE ${where}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapEstimateRow);
}

export async function updateEstimateHeader(
  companyId: string,
  estimateId: string,
  patch: Partial<{
    status: EstimateStatus;
    vatRate: number;
    totalDiscount: number;
    currency: string | null;
    meta: any;
  }>
): Promise<void> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      status: patch.status,
      vat_rate: patch.vatRate,
      total_discount: patch.totalDiscount,
      currency: patch.currency,
      meta: patch.meta,
    }).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(updated).length === 0) {
    return;
  }
  await sql`
    UPDATE estimates
    SET ${sql(updated)}
    WHERE company_id = ${companyId} AND id = ${estimateId}
  `;
}

export async function replaceEstimateItems(
  estimateId: string,
  items: Array<{
    id?: string;
    lineNo?: number;
    inspectionItemId?: string | null;
    partName: string;
    description?: string | null;
    type: EstimateItem["type"];
    quantity?: number;
    cost?: number;
    sale?: number;
    gpPercent?: number | null;
    status?: EstimateItemStatus;
  }>
): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM estimate_items WHERE estimate_id = ${estimateId}`;
  if (!items.length) {
    await recalculateEstimateTotals(estimateId);
    return;
  }

  for (const [idx, item] of items.entries()) {
    await sql`
      INSERT INTO estimate_items (
        estimate_id,
        inspection_item_id,
        line_no,
        part_name,
        description,
        type,
        quantity,
        cost,
        sale,
        gp_percent,
        status
      ) VALUES (
        ${estimateId},
        ${item.inspectionItemId ?? null},
        ${item.lineNo ?? idx + 1},
        ${item.partName},
        ${item.description ?? null},
        ${item.type},
        ${item.quantity ?? 1},
        ${item.cost ?? 0},
        ${item.sale ?? 0},
        ${item.gpPercent ?? null},
        ${item.status ?? ("pending" as EstimateItemStatus)}
      )
    `;
  }

  await recalculateEstimateTotals(estimateId);
}

export async function recalculateEstimateTotals(estimateId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM estimate_items
    WHERE estimate_id = ${estimateId}
  `;

  let totalCost = 0;
  let totalSale = 0;

  for (const row of rows) {
    const item = mapEstimateItemRow(row);
    if (item.status === "rejected") continue;
    const qty = item.quantity ?? 0;
    totalCost += (item.cost ?? 0) * qty;
    totalSale += (item.sale ?? 0) * qty;
  }

  const estRows = await sql`SELECT vat_rate, total_discount FROM estimates WHERE id = ${estimateId} LIMIT 1`;
  const est = estRows[0];
  const vatRate = est ? Number(est.vat_rate) : 0;
  const totalDiscount = est ? Number(est.total_discount ?? 0) : 0;

  const finalPrice = totalSale - totalDiscount;
  const vatAmount = finalPrice * (vatRate / 100);
  const grandTotal = finalPrice + vatAmount;

  await sql`
    UPDATE estimates
    SET
      total_cost = ${totalCost},
      total_sale = ${totalSale},
      total_discount = ${totalDiscount},
      final_price = ${finalPrice},
      vat_amount = ${vatAmount},
      grand_total = ${grandTotal}
    WHERE id = ${estimateId}
  `;
}

async function getEstimateItems(estimateId: string): Promise<EstimateItem[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM estimate_items
    WHERE estimate_id = ${estimateId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapEstimateItemRow);
}
