import { getSql } from "../../db";
import { getInspectionById, listInspectionItems } from "../inspections/repository";
import type { QuoteType } from "../quotes/types";
import type {
  Estimate,
  EstimateItem,
  EstimateItemCostType,
  EstimateItemQuoteCosts,
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

const ESTIMATE_ITEM_COST_COLUMNS: EstimateItemCostType[] = ["oem", "oe", "aftm", "used"];

const VENDOR_PART_TYPE_TO_COST_TYPE: Record<string, EstimateItemCostType> = {
  genuine: "oe",
  original: "oe",
  oe: "oe",
  oem: "oem",
  aftermarket: "aftm",
  used: "used",
};

function mapVendorPartType(partType?: string | null): EstimateItemCostType | null {
  if (!partType) return null;
  const normalized = partType.trim().toLowerCase();
  if (!normalized) return null;
  return VENDOR_PART_TYPE_TO_COST_TYPE[normalized] ?? null;
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
    approvedType: row.approved_type as EstimateItemCostType | null,
    approvedCost: row.approved_cost != null ? Number(row.approved_cost) : null,
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
  const costRows = await sql`
    SELECT
      estimate_item_id,
      MIN(oem) AS oem,
      MIN(oe) AS oe,
      MIN(aftm) AS aftm,
      MIN(used) AS used
    FROM part_quotes
    WHERE company_id = ${companyId} AND estimate_id = ${estimateId}
    GROUP BY estimate_item_id
  `;
  const quoteCostMap: Record<string, EstimateItemQuoteCosts | undefined> = {};
  for (const row of costRows) {
    const costs: EstimateItemQuoteCosts = {};
    for (const column of ESTIMATE_ITEM_COST_COLUMNS) {
      const value = row[column];
      if (value != null) {
        costs[column] = Number(value);
      }
    }
    if (Object.keys(costs).length > 0) {
      quoteCostMap[row.estimate_item_id] = costs;
    }
  }

  const vendorQuoteRows = await sql`
    SELECT
      qi.estimate_item_id,
      qi.part_type,
      qi.unit_price
    FROM quotes q
    INNER JOIN quote_items qi ON qi.quote_id = q.id
    WHERE q.company_id = ${companyId}
      AND q.estimate_id = ${estimateId}
      AND q.quote_type = ${"vendor_part" as QuoteType}
  `;
  const vendorQuoteCostMap: Record<string, EstimateItemQuoteCosts | undefined> = {};
  for (const row of vendorQuoteRows) {
    const costKey = mapVendorPartType(row.part_type);
    if (!costKey) continue;
    const estimateItemId = row.estimate_item_id;
    if (!estimateItemId) continue;
    const unitPrice = row.unit_price;
    if (unitPrice == null) continue;
    const amount = Number(unitPrice);
    if (Number.isNaN(amount)) continue;
    const existing = vendorQuoteCostMap[estimateItemId] ?? (vendorQuoteCostMap[estimateItemId] = {});
    const previous = existing[costKey];
    if (previous == null || amount < previous) {
      existing[costKey] = amount;
    }
  }
  const enrichedItems = items.map((item) => {
    const baseCosts = quoteCostMap[item.id];
    const vendorCosts = vendorQuoteCostMap[item.id];
    const combinedCosts =
      baseCosts || vendorCosts
        ? {
            ...(baseCosts ?? {}),
            ...(vendorCosts ?? {}),
          }
        : undefined;
    return {
      ...item,
      quoteCosts: combinedCosts && Object.keys(combinedCosts).length ? combinedCosts : undefined,
    };
  });
  return { estimate, items: enrichedItems };
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

export async function listEstimatesForCustomer(
  companyId: string,
  customerId: string,
  opts: { status?: EstimateStatus; limit?: number } = {}
): Promise<Estimate[]> {
  const sql = getSql();
  const { status, limit = 100 } = opts;
  const where =
    status != null
      ? sql`company_id = ${companyId} AND customer_id = ${customerId} AND status = ${status}`
      : sql`company_id = ${companyId} AND customer_id = ${customerId}`;
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
    approvedType?: EstimateItemCostType | null;
    approvedCost?: number | null;
  }>
): Promise<void> {
  const sql = getSql();
  if (!items.length) {
    await sql`DELETE FROM estimate_items WHERE estimate_id = ${estimateId}`;
    await recalculateEstimateTotals(estimateId);
    return;
  }

  const existingRows = await sql`
    SELECT id
    FROM estimate_items
    WHERE estimate_id = ${estimateId}
  `;
  const existingIds = existingRows.map((row: any) => row.id as string);
  const existingIdSet = new Set(existingIds);
  const keepIds = new Set(items.map((item) => item.id).filter((id): id is string => Boolean(id)));
  const deleteIds = existingIds.filter((id) => !keepIds.has(id));
  if (deleteIds.length > 0) {
    await sql`
      DELETE FROM estimate_items
      WHERE estimate_id = ${estimateId} AND id = ANY(${deleteIds})
    `;
  }

  for (const [idx, item] of items.entries()) {
    const inspectionItemId = item.inspectionItemId ?? null;
    const lineNo = item.lineNo ?? idx + 1;
    const partDescription = item.description ?? null;
    const qty = item.quantity ?? 1;
    const cost = item.cost ?? 0;
    const sale = item.sale ?? 0;
    const gpPercent = item.gpPercent ?? null;
    const approvedCost = item.approvedCost ?? null;
    const approvedType = item.approvedType ?? null;
    const status = item.status ?? ("pending" as EstimateItemStatus);

    if (item.id && existingIdSet.has(item.id)) {
      await sql`
        UPDATE estimate_items
        SET
          inspection_item_id = ${inspectionItemId},
          line_no = ${lineNo},
          part_name = ${item.partName},
          description = ${partDescription},
          type = ${item.type},
          quantity = ${qty},
          cost = ${cost},
          sale = ${sale},
          gp_percent = ${gpPercent},
          approved_cost = ${approvedCost},
          approved_type = ${approvedType},
          status = ${status}
        WHERE id = ${item.id} AND estimate_id = ${estimateId}
      `;
    } else {
      await sql`
        INSERT INTO estimate_items (
          id,
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
          approved_cost,
          approved_type,
          status
        ) VALUES (
          COALESCE(${item.id ?? null}, gen_random_uuid()),
          ${estimateId},
          ${inspectionItemId},
          ${lineNo},
          ${item.partName},
          ${partDescription},
          ${item.type},
          ${qty},
          ${cost},
          ${sale},
          ${gpPercent},
          ${approvedCost},
          ${approvedType},
          ${status}
        )
      `;
    }
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
