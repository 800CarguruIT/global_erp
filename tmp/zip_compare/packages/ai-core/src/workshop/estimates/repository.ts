import { getSql } from "../../db";
import { getInspectionById } from "../inspections/repository";
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

function isLegacyEstimateMeta(meta: any): boolean {
  return String(meta?.legacy_source ?? "").trim().toLowerCase() === "carguru2.estimates";
}

function toEstimateItemStatus(raw?: string | null): EstimateItemStatus {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  if (normalized === "inquiry") return "inquiry";
  return "pending";
}

function toLineItemStatus(raw?: EstimateItemStatus | string | null): "Pending" | "Approved" | "Inquiry" | "Rejected" {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "inquiry") return "Inquiry";
  return "Pending";
}

function mapLineItemTypeToEstimateType(raw?: string | null): EstimateItem["type"] {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "oem") return "oem";
  if (normalized === "aftm" || normalized === "aftermarket") return "aftermarket";
  if (normalized === "used") return "used";
  if (normalized === "repair") return "repair";
  return "genuine";
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

  const items = await getEstimateItems(companyId, estimate.id, false, estimate.inspectionId ?? null);
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
  const legacyEstimate = isLegacyEstimateMeta(rows[0]?.meta);
  const items = await getEstimateItems(companyId, estimateId, legacyEstimate, estimate.inspectionId ?? null);
  const costRows = legacyEstimate
    ? await sql`
        SELECT
          li.id AS line_item_id,
          MIN(pq.oem) AS oem,
          MIN(pq.oe) AS oe,
          MIN(pq.aftm) AS aftm,
          MIN(pq.used) AS used
        FROM line_items li
        INNER JOIN estimates e
          ON e.id = ${estimateId}
          AND e.company_id = ${companyId}
          AND e.inspection_id = li.inspection_id
          AND li.company_id = e.company_id
        LEFT JOIN part_quotes pq
          ON pq.company_id = ${companyId}
          AND pq.line_item_id = li.id
          AND (pq.estimate_id IS NULL OR pq.estimate_id = ${estimateId})
        WHERE COALESCE(li.is_add, 0) = 0
        GROUP BY li.id
      `
    : await sql`
        SELECT
          ei.id AS estimate_item_id,
          MIN(pq.oem) AS oem,
          MIN(pq.oe) AS oe,
          MIN(pq.aftm) AS aftm,
          MIN(pq.used) AS used
        FROM estimate_items ei
        LEFT JOIN part_quotes pq
          ON pq.company_id = ${companyId}
          AND (
            pq.estimate_item_id = ei.id
            OR (ei.inspection_item_id IS NOT NULL AND pq.line_item_id = ei.inspection_item_id)
          )
          AND (
            pq.estimate_id IS NULL
            OR pq.estimate_id = ${estimateId}
          )
        WHERE ei.estimate_id = ${estimateId}
        GROUP BY ei.id
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
    const key = legacyEstimate ? row.line_item_id : row.estimate_item_id;
    if (Object.keys(costs).length > 0 && key) {
      quoteCostMap[key] = costs;
    }
  }

  const legacyQuoteTables = await sql`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quotes'
      ) AS has_quotes,
      EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quote_items'
      ) AS has_quote_items
  `;
  const hasLegacyQuoteTables =
    Boolean(legacyQuoteTables[0]?.has_quotes) && Boolean(legacyQuoteTables[0]?.has_quote_items);
  const vendorQuoteRows = hasLegacyQuoteTables
    ? await sql`
        SELECT
          qi.estimate_item_id,
          qi.part_type,
          qi.unit_price
        FROM quotes q
        INNER JOIN quote_items qi ON qi.quote_id = q.id
        WHERE q.company_id = ${companyId}
          AND q.estimate_id = ${estimateId}
          AND q.quote_type = ${"vendor_part" as QuoteType}
      `
    : [];
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
  const legacyGuard = sql`
    (
      COALESCE(meta->>'legacy_source', '') <> 'carguru2.estimates'
      OR COALESCE(
        NULLIF(regexp_replace(COALESCE(meta->>'legacy_account_id', ''), '[^0-9-]', '', 'g'), ''),
        '0'
      )::bigint > 0
    )
  `;
  const where =
    status != null
      ? sql`company_id = ${companyId} AND customer_id = ${customerId} AND status = ${status} AND ${legacyGuard}`
      : sql`company_id = ${companyId} AND customer_id = ${customerId} AND ${legacyGuard}`;
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
    approvedSale?: number | null;
    discount?: number | null;
    discountPercent?: number | null;
  }>
): Promise<void> {
  const sql = getSql();
  const estimateRows = await sql`
    SELECT company_id, inspection_id, meta
    FROM estimates
    WHERE id = ${estimateId}
    LIMIT 1
  `;
  const estimate = estimateRows[0];
  const legacyEstimate = isLegacyEstimateMeta(estimate?.meta);
  if (!legacyEstimate) {
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
    return;
  }

  if (!estimate?.inspection_id) {
    await recalculateEstimateTotals(estimateId);
    return;
  }
  const companyId = String(estimate.company_id);
  const inspectionId = String(estimate.inspection_id);

  for (const [idx, item] of items.entries()) {
    const inspectionItemId = item.inspectionItemId ?? null;
    const partDescription = item.description ?? null;
    const qty = item.quantity ?? 1;
    const approvedType = item.approvedType ?? null;
    const status = toLineItemStatus(item.status ?? ("pending" as EstimateItemStatus));
    const approvedCost = Number(item.approvedCost ?? item.cost ?? 0) || 0;
    const approvedSale = Number(item.approvedSale ?? item.sale ?? approvedCost) || 0;
    const discountAmount = Number(item.discount ?? 0) || 0;
    const discountPercent =
      Number(item.discountPercent ?? (approvedSale > 0 ? (discountAmount / approvedSale) * 100 : 0)) || 0;

    const targetLineItemId = inspectionItemId ?? item.id ?? null;
    if (targetLineItemId) {
      await sql`
        UPDATE line_items
        SET
          product_name = ${item.partName},
          description = ${partDescription},
          quantity = ${qty},
          status = ${status},
          approved_type = ${approvedType},
          approved_cost = ${approvedCost},
          approved_sale = ${approvedSale},
          discount_amount = ${discountAmount},
          discount_percent = ${discountPercent},
          source = COALESCE(source, 'estimate'),
          updated_at = NOW()
        WHERE id = ${targetLineItemId}
          AND company_id = ${companyId}
          AND inspection_id = ${inspectionId}
      `;
    } else {
      await sql`
        INSERT INTO line_items (
          company_id,
          inspection_id,
          lead_id,
          source,
          is_add,
          product_name,
          description,
          quantity,
          reason,
          status,
          approved_type,
          approved_cost,
          approved_sale,
          discount_amount,
          discount_percent
        ) VALUES (
          ${companyId},
          ${inspectionId},
          (
            SELECT lead_id
            FROM estimates
            WHERE id = ${estimateId}
            LIMIT 1
          ),
          ${"estimate"},
          ${0},
          ${item.partName},
          ${partDescription},
          ${qty},
          ${partDescription},
          ${status},
          ${approvedType},
          ${approvedCost},
          ${approvedSale},
          ${discountAmount},
          ${discountPercent}
        )
      `;
    }
  }

  await recalculateEstimateTotals(estimateId);
}

export async function recalculateEstimateTotals(estimateId: string): Promise<void> {
  const sql = getSql();
  const estimateRows = await sql`
    SELECT company_id, inspection_id, vat_rate, total_discount, meta
    FROM estimates
    WHERE id = ${estimateId}
    LIMIT 1
  `;
  if (!estimateRows.length) return;
  const estimate = estimateRows[0];
  const legacyEstimate = isLegacyEstimateMeta(estimate?.meta);
  if (!legacyEstimate) {
    const rows = await sql`
      SELECT *
      FROM estimate_items
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
    const vatRate = Number(estimate.vat_rate ?? 0);
    const totalDiscount = Number(estimate.total_discount ?? 0);
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
    return;
  }

  const rows = await sql`
    SELECT
      li.id,
      li.quantity,
      li.status,
      li.approved_type,
      li.approved_cost,
      li.approved_sale,
      li.discount_amount,
      pq.oem,
      pq.oe,
      pq.aftm,
      pq.used
    FROM line_items li
    LEFT JOIN LATERAL (
      SELECT
        MIN(pq.oem) AS oem,
        MIN(pq.oe) AS oe,
        MIN(pq.aftm) AS aftm,
        MIN(pq.used) AS used
      FROM part_quotes pq
      WHERE pq.company_id = ${estimate.company_id}
        AND (
          pq.line_item_id = li.id
          OR (pq.estimate_id = ${estimateId} AND pq.line_item_id IS NULL)
        )
    ) pq ON TRUE
    WHERE li.company_id = ${estimate.company_id}
      AND li.inspection_id = ${estimate.inspection_id}
      AND COALESCE(li.is_add, 0) = 0
  `;

  let totalCost = 0;
  let totalSale = 0;
  let totalDiscountLines = 0;

  for (const row of rows) {
    const status = toEstimateItemStatus(row.status);
    if (status === "rejected") continue;
    const qty = Number(row.quantity ?? 0);
    const approvedType = String(row.approved_type ?? "").trim().toLowerCase();
    const unitCost =
      approvedType === "oem"
        ? Number(row.oem ?? 0)
        : approvedType === "oe"
        ? Number(row.oe ?? 0)
        : approvedType === "aftm"
        ? Number(row.aftm ?? 0)
        : approvedType === "used"
        ? Number(row.used ?? 0)
        : 0;
    const approvedCost = Number(row.approved_cost ?? unitCost * qty);
    const approvedSale = Number(row.approved_sale ?? approvedCost);
    const lineDiscount = Number(row.discount_amount ?? 0);
    totalCost += approvedCost;
    totalSale += approvedSale;
    totalDiscountLines += lineDiscount;
  }

  const vatRate = Number(estimate.vat_rate ?? 0);
  const totalDiscount = totalDiscountLines;

  const finalPrice = Math.max(0, totalSale - totalDiscount);
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

async function getEstimateItems(
  companyId: string,
  estimateId: string,
  legacyEstimate: boolean,
  inspectionIdHint?: string | null
): Promise<EstimateItem[]> {
  const sql = getSql();
  if (!legacyEstimate) {
    const rows = await sql`
      SELECT *
      FROM estimate_items
      WHERE estimate_id = ${estimateId}
      ORDER BY line_no ASC
    `;
    return rows.map(mapEstimateItemRow);
  }
  const inspectionId = inspectionIdHint;
  if (!inspectionId) return [];
  const rows = await sql`
    SELECT
      li.id,
      ${estimateId}::uuid AS estimate_id,
      li.id AS inspection_item_id,
      ROW_NUMBER() OVER (ORDER BY li.created_at ASC, li.id ASC) AS line_no,
      COALESCE(li.product_name, 'Item') AS part_name,
      li.description,
      COALESCE(
        NULLIF(LOWER(li.approved_type), ''),
        'genuine'
      ) AS type,
      COALESCE(li.quantity, 1)::numeric AS quantity,
      COALESCE(li.approved_cost, 0)::numeric AS cost,
      COALESCE(li.approved_sale, li.approved_cost, 0)::numeric AS sale,
      NULL::numeric AS gp_percent,
      LOWER(COALESCE(li.status, 'pending')) AS status,
      li.created_at,
      li.updated_at,
      li.approved_type,
      COALESCE(li.approved_cost, 0)::numeric AS approved_cost,
      COALESCE(li.approved_sale, li.approved_cost, 0)::numeric AS approved_sale,
      COALESCE(li.discount_amount, 0)::numeric AS discount_amount,
      COALESCE(li.discount_percent, 0)::numeric AS discount_percent
    FROM line_items li
    WHERE li.company_id = ${companyId}
      AND li.inspection_id = ${inspectionId}
      AND COALESCE(li.is_add, 0) = 0
    ORDER BY line_no ASC
  `;
  return rows.map((row: any) => {
    const mappedType = mapLineItemTypeToEstimateType(row.type);
    return {
      id: row.id,
      estimateId: row.estimate_id,
      inspectionItemId: row.inspection_item_id,
      lineNo: Number(row.line_no),
      partName: row.part_name,
      description: row.description,
      type: mappedType,
      quantity: Number(row.quantity ?? 0),
      cost: Number(row.cost ?? 0),
      sale: Number(row.sale ?? 0),
      gpPercent: row.gp_percent != null ? Number(row.gp_percent) : null,
      status: toEstimateItemStatus(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedType: row.approved_type as EstimateItemCostType | null,
      approvedCost: row.approved_cost != null ? Number(row.approved_cost) : null,
      approvedSale: row.approved_sale != null ? Number(row.approved_sale) : null,
      discount: row.discount_amount != null ? Number(row.discount_amount) : 0,
      discountPercent: row.discount_percent != null ? Number(row.discount_percent) : 0,
      subTotal:
        row.approved_sale != null
          ? Number(row.approved_sale) - Number(row.discount_amount ?? 0)
          : null,
    } as EstimateItem;
  });
}
