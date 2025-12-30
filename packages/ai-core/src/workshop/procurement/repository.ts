import { getSql } from "../../db";
import { getQuoteWithItems } from "../quotes/repository";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderType,
} from "./types";
import { receivePartsForEstimateItem } from "../parts/repository";

function mapPoRow(row: any): PurchaseOrder {
  return {
    id: row.id,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    vendorContact: row.vendor_contact,
    poNumber: row.po_number,
    poType: row.po_type,
    sourceType: row.source_type,
    quoteId: row.quote_id,
    status: row.status,
    currency: row.currency,
    expectedDate: row.expected_date,
    notes: row.notes,
    totalCost: Number(row.total_cost),
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: any): PurchaseOrderItem {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    lineNo: row.line_no,
    estimateItemId: row.estimate_item_id,
    partsCatalogId: row.parts_catalog_id,
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    receivedQty: Number(row.received_qty),
    status: row.status,
  };
}

async function getPoItems(poId: string): Promise<PurchaseOrderItem[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM purchase_order_items
    WHERE purchase_order_id = ${poId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapItemRow);
}

async function recalcTotals(poId: string): Promise<void> {
  const sql = getSql();
  const rows = await sql/* sql */ `SELECT total_cost FROM purchase_order_items WHERE purchase_order_id = ${poId}`;
  const total = rows.reduce((sum: number, r: any) => sum + Number(r.total_cost ?? 0), 0);
  await sql/* sql */ `
    UPDATE purchase_orders
    SET total_cost = ${total}
    WHERE id = ${poId}
  `;
}

async function nextPoNumber(companyId: string): Promise<string> {
  const sql = getSql();
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const rows = await sql/* sql */ `
    SELECT po_number FROM purchase_orders
    WHERE company_id = ${companyId} AND po_number LIKE ${prefix + "%"}
    ORDER BY po_number DESC
    LIMIT 1
  `;
  if (!rows.length) return `${prefix}0001`;
  const lastRow = rows[0];
  const last = (lastRow?.po_number as string | undefined) ?? "";
  const num = last ? parseInt(last.replace(prefix, "")) || 0 : 0;
  return `${prefix}${(num + 1).toString().padStart(4, "0")}`;
}

export async function createPoFromVendorQuote(
  companyId: string,
  quoteId: string,
  poType: PurchaseOrderType = "po",
  createdBy?: string | null
): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[] }> {
  const sql = getSql();
  const quoteData = await getQuoteWithItems(companyId, quoteId);
  if (!quoteData || quoteData.quote.quoteType !== "vendor_part") throw new Error("Quote not found");
  if (quoteData.quote.status !== "approved") throw new Error("Quote not approved");

  const poNumber = await nextPoNumber(companyId);
  const poRows = await sql/* sql */ `
    INSERT INTO purchase_orders (
      company_id,
      vendor_id,
      vendor_name,
      po_number,
      po_type,
      source_type,
      quote_id,
      status,
      currency,
      created_by
    ) VALUES (
      ${companyId},
      ${quoteData.quote.vendorId ?? null},
      ${quoteData.quote.vendorId ? null : quoteData.quote.meta?.vendorName ?? null},
      ${poNumber},
      ${poType},
      ${"quote"},
      ${quoteId},
      ${"draft" as PurchaseOrderStatus},
      ${quoteData.quote.currency ?? null},
      ${createdBy ?? null}
    )
    RETURNING *
  `;
  const po = mapPoRow(poRows[0]);

  for (const [idx, item] of quoteData.items.entries()) {
    const qty = item.quantity ?? 0;
    const unit = item.unitPrice ?? 0;
    await sql/* sql */ `
      INSERT INTO purchase_order_items (
        purchase_order_id,
        line_no,
        estimate_item_id,
        name,
        description,
        quantity,
        unit_cost,
        total_cost,
        status
      ) VALUES (
        ${po.id},
        ${item.lineNo ?? idx + 1},
        ${item.estimateItemId ?? null},
        ${item.name},
        ${item.description ?? null},
        ${qty},
        ${unit},
        ${qty * unit},
        ${"pending"}
      )
    `;
  }

  await recalcTotals(po.id);
  const items = await getPoItems(po.id);
  return { po, items };
}

export async function createManualPo(args: {
  companyId: string;
  poType: PurchaseOrderType;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorContact?: string | null;
  currency?: string | null;
  createdBy?: string | null;
  items?: Array<{
    name: string;
    description?: string | null;
    quantity?: number;
    unitCost?: number;
  }>;
}): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[] }> {
  const sql = getSql();
  const poNumber = await nextPoNumber(args.companyId);
  const poRows = await sql/* sql */ `
    INSERT INTO purchase_orders (
      company_id,
      vendor_id,
      vendor_name,
      vendor_contact,
      po_number,
      po_type,
      source_type,
      status,
      currency,
      created_by
    ) VALUES (
      ${args.companyId},
      ${args.vendorId ?? null},
      ${args.vendorName ?? null},
      ${args.vendorContact ?? null},
      ${poNumber},
      ${args.poType},
      ${"manual"},
      ${"draft" as PurchaseOrderStatus},
      ${args.currency ?? null},
      ${args.createdBy ?? null}
    )
    RETURNING *
  `;
  const po = mapPoRow(poRows[0]);

  const items = args.items ?? [];
  for (const [idx, item] of items.entries()) {
    const qty = item.quantity ?? 0;
    const unit = item.unitCost ?? 0;
    await sql/* sql */ `
      INSERT INTO purchase_order_items (
        purchase_order_id,
        line_no,
        name,
        description,
        quantity,
        unit_cost,
        total_cost,
        status
      ) VALUES (
        ${po.id},
        ${idx + 1},
        ${item.name},
        ${item.description ?? null},
        ${qty},
        ${unit},
        ${qty * unit},
        ${"pending"}
      )
    `;
  }

  await recalcTotals(po.id);
  const poItems = await getPoItems(po.id);
  return { po, items: poItems };
}

export async function listPurchaseOrders(
  companyId: string,
  opts: { status?: PurchaseOrderStatus; vendorId?: string | null } = {}
): Promise<PurchaseOrder[]> {
  const sql = getSql();
  const where =
    opts.status && opts.vendorId !== undefined
      ? sql`company_id = ${companyId} AND status = ${opts.status} AND vendor_id = ${opts.vendorId}`
      : opts.status
      ? sql`company_id = ${companyId} AND status = ${opts.status}`
      : opts.vendorId !== undefined
      ? sql`company_id = ${companyId} AND vendor_id = ${opts.vendorId}`
      : sql`company_id = ${companyId}`;

  const rows = await sql/* sql */ `
    SELECT * FROM purchase_orders
    WHERE ${where}
    ORDER BY updated_at DESC
  `;
  return rows.map(mapPoRow);
}

export async function getPurchaseOrderWithItems(
  companyId: string,
  poId: string
): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[] } | null> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM purchase_orders WHERE company_id = ${companyId} AND id = ${poId} LIMIT 1`;
  if (!rows.length) return null;
  const po = mapPoRow(rows[0]);
  const items = await getPoItems(poId);
  return { po, items };
}

export async function updatePurchaseOrderHeader(
  companyId: string,
  poId: string,
  patch: Partial<{
    status: PurchaseOrderStatus;
    expectedDate: string | null;
    notes: string | null;
    poType: PurchaseOrderType;
    vendorName: string | null;
    vendorContact: string | null;
  }>
): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    UPDATE purchase_orders
    SET ${sql({
      status: patch.status,
      expected_date: patch.expectedDate,
      notes: patch.notes,
      po_type: patch.poType,
      vendor_name: patch.vendorName,
      vendor_contact: patch.vendorContact,
    })}
    WHERE company_id = ${companyId} AND id = ${poId}
  `;
}

export async function replacePurchaseOrderItems(
  companyId: string,
  poId: string,
  items: Array<{
    id?: string;
    lineNo?: number;
    name: string;
    description?: string | null;
    quantity?: number;
    unitCost?: number;
  }>
): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `DELETE FROM purchase_order_items WHERE purchase_order_id = ${poId}`;
  for (const [idx, item] of items.entries()) {
    const qty = item.quantity ?? 0;
    const unit = item.unitCost ?? 0;
    await sql/* sql */ `
      INSERT INTO purchase_order_items (
        purchase_order_id,
        line_no,
        name,
        description,
        quantity,
        unit_cost,
        total_cost,
        status
      ) VALUES (
        ${poId},
        ${item.lineNo ?? idx + 1},
        ${item.name},
        ${item.description ?? null},
        ${qty},
        ${unit},
        ${qty * unit},
        ${"pending"}
      )
    `;
  }
  await recalcTotals(poId);
}

export async function receivePoItems(
  companyId: string,
  poId: string,
  items: Array<{ itemId: string; quantity: number }>
): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[] }> {
  const sql = getSql();
  for (const entry of items) {
    const rows = await sql/* sql */ `
      SELECT * FROM purchase_order_items WHERE id = ${entry.itemId} AND purchase_order_id = ${poId} LIMIT 1
    `;
    if (!rows.length) continue;
    const current = mapItemRow(rows[0]);
    const newReceived = Number(current.receivedQty ?? 0) + Number(entry.quantity ?? 0);
    const status =
      newReceived <= 0
        ? "pending"
        : newReceived < (current.quantity ?? 0)
        ? "partial"
        : "received";
    await sql/* sql */ `
      UPDATE purchase_order_items
      SET received_qty = ${newReceived},
          status = ${status}
      WHERE id = ${current.id}
    `;

    // push to inventory based on linked estimate item
    if (current.estimateItemId) {
      try {
        await receivePartsForEstimateItem(companyId, current.estimateItemId, {
          partNumber: (current as any).partNumber ?? null,
          brand: (current as any).brand ?? null,
          description: current.description ?? null,
          quantity: entry.quantity,
          costPerUnit: current.unitCost,
        } as any);
      } catch {
        // ignore inventory errors to not block PO receive
      }
    }
  }

  // update header status
  const poItems = await getPoItems(poId);
  const allReceived = poItems.length > 0 && poItems.every((i) => i.status === "received");
  const anyReceived = poItems.some((i) => i.status === "partial" || i.status === "received");
  const newStatus: PurchaseOrderStatus = allReceived ? "received" : anyReceived ? "partially_received" : "issued";
  await sql/* sql */ `
    UPDATE purchase_orders
    SET status = ${newStatus}
    WHERE id = ${poId}
  `;

  const poRow = await sql/* sql */ `SELECT * FROM purchase_orders WHERE id = ${poId} LIMIT 1`;
  return { po: mapPoRow(poRow[0]), items: poItems };
}
