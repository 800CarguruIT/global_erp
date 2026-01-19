import { getSql } from "../../db";
import { getEstimateWithItems } from "../estimates/repository";
import { getWorkOrderWithItems, updateWorkOrderHeader } from "../workorders/repository";
import type { Quote, QuoteItem, QuoteStatus, QuoteType } from "./types";

function mapQuoteRow(row: any): Quote {
  return {
    id: row.id,
    companyId: row.company_id,
    quoteType: row.quote_type,
    status: row.status,
    estimateId: row.estimate_id,
    workOrderId: row.work_order_id,
    vendorId: row.vendor_id,
    branchId: row.branch_id,
    currency: row.currency,
    totalAmount: Number(row.total_amount),
    validUntil: row.valid_until,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    meta: row.meta,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuoteItemRow(row: any): QuoteItem {
  return {
    id: row.id,
    quoteId: row.quote_id,
    lineNo: row.line_no,
    estimateItemId: row.estimate_item_id,
    workOrderItemId: row.work_order_item_id,
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    partNumber: row.part_number,
    brand: row.brand,
    partType: row.part_type,
    etaDays: row.eta_days,
    laborHours: row.labor_hours,
    laborRate: row.labor_rate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM quote_items
    WHERE quote_id = ${quoteId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapQuoteItemRow);
}

async function recalcQuoteTotal(quoteId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql/* sql */ `SELECT total_price FROM quote_items WHERE quote_id = ${quoteId}`;
  const total = rows.reduce((sum: number, r: any) => sum + Number(r.total_price ?? 0), 0);
  await sql/* sql */ `
    UPDATE quotes
    SET total_amount = ${total}
    WHERE id = ${quoteId}
  `;
}

export async function createVendorQuoteForEstimate(
  companyId: string,
  estimateId: string,
  vendorId: string
): Promise<{ quote: Quote; items: QuoteItem[] }> {
  const sql = getSql();
  const est = await getEstimateWithItems(companyId, estimateId);
  if (!est) throw new Error("Estimate not found");

  const quoteRows = await sql/* sql */ `
    INSERT INTO quotes (
      company_id,
      quote_type,
      status,
      estimate_id,
      vendor_id
    ) VALUES (
      ${companyId},
      ${"vendor_part" as QuoteType},
      ${"draft" as QuoteStatus},
      ${estimateId},
      ${vendorId}
    )
    RETURNING *
  `;
  const quote = mapQuoteRow(quoteRows[0]);

  const partItems = (est.items ?? []).filter((it) => (it as any).isPart !== false && it.status === "approved");
  for (const [idx, item] of partItems.entries()) {
    const qty = item.quantity ?? 1;
    const unit = 0;
    await sql/* sql */ `
      INSERT INTO quote_items (
        quote_id,
        line_no,
        estimate_item_id,
        name,
        description,
        quantity,
        unit_price,
        total_price,
        part_number,
        brand,
        part_type
      ) VALUES (
        ${quote.id},
        ${item.lineNo ?? idx + 1},
        ${item.id},
        ${item.partName},
        ${item.description ?? null},
        ${qty},
        ${unit},
        ${unit * qty},
        ${(item as any).partNumber ?? null},
        ${(item as any).brand ?? null},
        ${(item as any).type ?? null}
      )
    `;
  }

  await recalcQuoteTotal(quote.id);
  const items = await getQuoteItems(quote.id);
  return { quote, items };
}

export async function createBranchLaborQuoteForWorkOrder(
  companyId: string,
  workOrderId: string,
  branchId: string
): Promise<{ quote: Quote; items: QuoteItem[] }> {
  const sql = getSql();
  const wo = await getWorkOrderWithItems(companyId, workOrderId);
  if (!wo) throw new Error("Work order not found");

  const quoteRows = await sql/* sql */ `
    INSERT INTO quotes (
      company_id,
      quote_type,
      status,
      work_order_id,
      branch_id
    ) VALUES (
      ${companyId},
      ${"branch_labor" as QuoteType},
      ${"open" as QuoteStatus},
      ${workOrderId},
      ${branchId}
    )
    RETURNING *
  `;
  const quote = mapQuoteRow(quoteRows[0]);

  await sql/* sql */ `
    INSERT INTO quote_items (
      quote_id,
      line_no,
      work_order_item_id,
      name,
      description,
      quantity,
      unit_price,
      total_price
    ) VALUES (
      ${quote.id},
      ${1},
      ${null},
      ${`Labor for work order ${workOrderId}`},
      ${null},
      ${1},
      ${0},
      ${0}
    )
  `;

  const items = await getQuoteItems(quote.id);
  return { quote, items };
}

export async function listQuotesForCompany(
  companyId: string,
  opts: { type?: QuoteType; status?: QuoteStatus } = {}
): Promise<Quote[]> {
  const sql = getSql();
  const where =
    opts.type && opts.status
      ? sql`company_id = ${companyId} AND quote_type = ${opts.type} AND status = ${opts.status}`
      : opts.type
      ? sql`company_id = ${companyId} AND quote_type = ${opts.type}`
      : opts.status
      ? sql`company_id = ${companyId} AND status = ${opts.status}`
      : sql`company_id = ${companyId}`;

  const rows = await sql/* sql */ `
    SELECT * FROM quotes
    WHERE ${where}
    ORDER BY updated_at DESC
  `;
  return rows.map(mapQuoteRow);
}

export async function getQuoteWithItems(
  companyId: string,
  quoteId: string
): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM quotes WHERE company_id = ${companyId} AND id = ${quoteId} LIMIT 1`;
  if (!rows.length) return null;
  const quote = mapQuoteRow(rows[0]);
  const items = await getQuoteItems(quote.id);
  return { quote, items };
}

export async function updateVendorQuote(
  companyId: string,
  quoteId: string,
  args: {
    headerPatch?: Partial<{ status: QuoteStatus; validUntil: string | null }>;
    items?: Array<Partial<QuoteItem>>;
  }
): Promise<void> {
  const sql = getSql();
  if (args.headerPatch) {
    const { headerPatch } = args;
    await sql/* sql */ `
      UPDATE quotes
      SET ${sql({
        status: headerPatch.status,
        valid_until: headerPatch.validUntil,
      })}
      WHERE company_id = ${companyId} AND id = ${quoteId}
    `;
  }

  if (args.items?.length) {
    for (const item of args.items) {
      if (!item.id) continue;
      const qty = item.quantity ?? 0;
      const unit = item.unitPrice ?? 0;
      const total = qty * unit;
      await sql/* sql */ `
        UPDATE quote_items
        SET ${sql({
          part_number: item.partNumber,
          brand: item.brand,
          part_type: item.partType,
          eta_days: item.etaDays,
          unit_price: unit,
          quantity: qty,
          total_price: total,
        })}
        WHERE id = ${item.id}
      `;
    }
  }

  await recalcQuoteTotal(quoteId);
}

export async function approveVendorQuote(
  companyId: string,
  quoteId: string,
  approverUserId: string | null
): Promise<void> {
  const sql = getSql();
  const data = await getQuoteWithItems(companyId, quoteId);
  if (!data || data.quote.quoteType !== "vendor_part") throw new Error("Invalid quote");

  await sql/* sql */ `
    UPDATE quotes
    SET status = ${"approved" as QuoteStatus},
        approved_by = ${approverUserId},
        approved_at = now()
    WHERE id = ${quoteId}
  `;

  // push costs to estimate_items
  for (const item of data.items) {
    if (!item.estimateItemId) continue;
    await sql/* sql */ `
      UPDATE estimate_items
      SET cost = ${item.unitPrice}
      WHERE id = ${item.estimateItemId}
    `;
  }
}

export async function updateBranchQuote(
  companyId: string,
  quoteId: string,
  args: {
    headerPatch?: Partial<{ status: QuoteStatus; validUntil: string | null }>;
    item?: Partial<QuoteItem>;
    metaPatch?: Record<string, unknown>;
  }
): Promise<void> {
  const sql = getSql();
  const shouldUpdateHeader = args.headerPatch && (args.headerPatch.status !== undefined || args.headerPatch.validUntil !== undefined);
  const shouldUpdateMeta = args.metaPatch && Object.keys(args.metaPatch).length > 0;
  const shouldUpdateItem = !!args.item;

  const current = shouldUpdateMeta || shouldUpdateItem ? await getQuoteWithItems(companyId, quoteId) : null;

  if (shouldUpdateHeader || shouldUpdateMeta) {
    const mergedMeta =
      shouldUpdateMeta && current?.quote
        ? { ...(current.quote.meta ?? {}), ...(args.metaPatch ?? {}) }
        : shouldUpdateMeta
        ? { ...(args.metaPatch ?? {}) }
        : undefined;

    const updatePayload: Record<string, unknown> = {};
    if (args.headerPatch?.status !== undefined) updatePayload.status = args.headerPatch.status;
    if (args.headerPatch?.validUntil !== undefined) updatePayload.valid_until = args.headerPatch.validUntil;
    if (mergedMeta !== undefined) updatePayload.meta = mergedMeta;

    if (Object.keys(updatePayload).length) {
      await sql/* sql */ `
        UPDATE quotes
        SET ${sql(updatePayload)}
        WHERE company_id = ${companyId} AND id = ${quoteId}
      `;
    }
  }

  if (shouldUpdateItem) {
    const itemRow = current?.items?.[0] ?? (await getQuoteItems(quoteId))[0];
    const qty = args.item?.laborHours ?? args.item?.quantity ?? itemRow?.quantity ?? 1;
    const rate = args.item?.laborRate ?? args.item?.unitPrice ?? itemRow?.unitPrice ?? 0;
    const total = qty * rate;
    await sql/* sql */ `
      UPDATE quote_items
      SET ${sql({
        labor_hours: args.item?.laborHours ?? qty,
        labor_rate: args.item?.laborRate ?? rate,
        unit_price: rate,
        total_price: total,
      })}
      WHERE quote_id = ${quoteId}
    `;

    await recalcQuoteTotal(quoteId);
  }
}

export async function approveBranchQuote(
  companyId: string,
  quoteId: string,
  approverUserId: string | null
): Promise<void> {
  const sql = getSql();
  const data = await getQuoteWithItems(companyId, quoteId);
  if (!data || data.quote.quoteType !== "branch_labor") throw new Error("Invalid quote");

  await sql/* sql */ `
    UPDATE quotes
    SET status = ${"approved" as QuoteStatus},
        approved_by = ${approverUserId},
        approved_at = now()
    WHERE id = ${quoteId}
  `;

  // Set labor cost on work order
  if (data.quote.workOrderId) {
    await updateWorkOrderHeader(companyId, data.quote.workOrderId, {
      branchId: data.quote.branchId ?? null,
      meta: null,
    });
    const total = data.quote.totalAmount ?? 0;
    await sql/* sql */ `
      UPDATE work_orders
      SET labor_cost = ${total},
          status = CASE WHEN status = 'quoting' THEN 'queue' ELSE status END
      WHERE id = ${data.quote.workOrderId}
    `;
  }
}
