import { getSql } from "../../db";
import { getQuoteWithItems } from "../quotes/repository";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderType,
} from "./types";
import { receivePartsForEstimateItem, receivePartsForInventoryRequestItem } from "../parts/repository";

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
    inventoryRequestItemId: row.inventory_request_item_id,
    partsCatalogId: row.parts_catalog_id,
    name: row.name,
    description: row.description,
    quantity: Number(row.quantity),
    unitCost: Number(row.unit_cost),
    totalCost: Number(row.total_cost),
    receivedQty: Number(row.received_qty),
    movedToInventory: Boolean(row.moved_to_inventory),
    inventoryTypeId: row.req_inventory_type_id,
    categoryId: row.req_category_id,
    subcategoryId: row.req_subcategory_id,
    makeId: row.req_make_id,
    modelId: row.req_model_id,
    yearId: row.req_year_id,
    partType: row.req_part_type,
    unit: row.req_unit,
    partBrand: row.req_part_brand,
    category: row.req_category,
    subcategory: row.req_subcategory,
    status: row.status,
  };
}

async function getPoItems(poId: string): Promise<PurchaseOrderItem[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT
      poi.*,
      EXISTS (
        SELECT 1
        FROM inventory_movements im
        WHERE im.purchase_order_id = poi.purchase_order_id
          AND im.source_id = poi.inventory_request_item_id
          AND im.source_type = 'receipt'
          AND im.direction = 'in'
      ) AS has_movement,
      iori.part_brand AS req_part_brand,
      iori.part_type AS req_part_type,
      iori.unit AS req_unit,
      iori.category AS req_category,
      iori.subcategory AS req_subcategory,
      iori.inventory_type_id AS req_inventory_type_id,
      iori.category_id AS req_category_id,
      iori.subcategory_id AS req_subcategory_id,
      iori.make_id AS req_make_id,
      iori.model_id AS req_model_id,
      iori.year_id AS req_year_id
    FROM purchase_order_items poi
    LEFT JOIN inventory_order_request_items iori
      ON iori.id = poi.inventory_request_item_id
    WHERE poi.purchase_order_id = ${poId}
    ORDER BY poi.line_no ASC
  `;
  return rows.map((row: any) => ({
    ...mapItemRow(row),
    movedToInventory: Boolean(row.moved_to_inventory) || Boolean(row.has_movement),
  }));
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

export async function nextPoNumberPreview(companyId: string): Promise<string> {
  const sql = getSql();
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `PO-${yy}${mm}${dd}-`;
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

async function nextPoNumber(companyId: string): Promise<string> {
  return nextPoNumberPreview(companyId);
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
    partsCatalogId?: string | null;
    inventoryRequestItemId?: string | null;
    quoteId?: string | null;
    lineStatus?: "Received" | "Return" | null;
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
    const lineStatus = item.lineStatus?.toLowerCase();
    const poItemStatus =
      lineStatus === "received" ? "received" : lineStatus === "return" ? "cancelled" : "pending";
    const receivedQty = poItemStatus === "received" ? qty : 0;
    await sql/* sql */ `
      INSERT INTO purchase_order_items (
        purchase_order_id,
        line_no,
        parts_catalog_id,
        inventory_request_item_id,
        name,
        description,
        quantity,
        unit_cost,
        total_cost,
        status,
        received_qty
      ) VALUES (
        ${po.id},
        ${idx + 1},
        ${item.partsCatalogId ?? null},
        ${item.inventoryRequestItemId ?? null},
        ${item.name},
        ${item.description ?? null},
        ${qty},
        ${unit},
        ${qty * unit},
        ${poItemStatus},
        ${receivedQty}
      )
    `;
    if (item.quoteId && (lineStatus === "received" || lineStatus === "return")) {
      const quoteStatus = lineStatus === "received" ? "Received" : "Return";
      await sql/* sql */ `
        UPDATE part_quotes
        SET status = ${quoteStatus},
            updated_at = NOW()
        WHERE company_id = ${args.companyId} AND id = ${item.quoteId}
      `;
    }
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
    partsCatalogId?: string | null;
    inventoryRequestItemId?: string | null;
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
        parts_catalog_id,
        inventory_request_item_id,
        name,
        description,
        quantity,
        unit_cost,
        total_cost,
        status
      ) VALUES (
        ${poId},
        ${item.lineNo ?? idx + 1},
        ${item.partsCatalogId ?? null},
        ${item.inventoryRequestItemId ?? null},
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
    } else if (current.inventoryRequestItemId) {
      try {
        await receivePartsForInventoryRequestItem(companyId, current.inventoryRequestItemId, {
          quantity: entry.quantity,
          purchaseOrderId: poId,
        });
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

export async function movePoItemToInventory(args: {
  companyId: string;
  poId: string;
  itemId: string;
  quantity?: number;
  partNumber?: string | null;
  partBrand?: string | null;
  unit?: string | null;
  category?: string | null;
  subcategory?: string | null;
  partType?: string | null;
  makeId?: string | null;
  modelId?: string | null;
  yearId?: string | null;
}): Promise<{ movedQty: number; grnNumber: string | null }> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM purchase_order_items
    WHERE id = ${args.itemId} AND purchase_order_id = ${args.poId}
    LIMIT 1
  `;
  if (!rows.length) {
    throw new Error("PO item not found");
  }
  const poItem = mapItemRow(rows[0]);
  if (!poItem.inventoryRequestItemId) {
    throw new Error("PO item is not linked to an inventory request");
  }
  if (poItem.status !== "received") {
    throw new Error("PO item is not marked as received");
  }

  const reqRows = await sql/* sql */ `
    SELECT quantity, received_qty, description
    FROM inventory_order_request_items
    WHERE id = ${poItem.inventoryRequestItemId}
    LIMIT 1
  `;
  if (!reqRows.length) {
    throw new Error("Inventory request item not found");
  }
  const req = reqRows[0];
  const updatePayload: Record<string, any> = {};
  if (args.partNumber) updatePayload.part_number = args.partNumber;
  if (args.partBrand) updatePayload.part_brand = args.partBrand;
  if (args.unit) updatePayload.unit = args.unit;
  if (args.category) updatePayload.category = args.category;
  if (args.subcategory) updatePayload.subcategory = args.subcategory;
  if (args.makeId) updatePayload.make_id = args.makeId;
  if (args.modelId) updatePayload.model_id = args.modelId;
  if (args.yearId) updatePayload.year_id = args.yearId;
  if (args.partType) {
    const existingDesc = (req.description as string | null) ?? "";
    const typeLabel = `Type: ${args.partType}`;
    if (!existingDesc.toLowerCase().includes("type:")) {
      updatePayload.description = existingDesc ? `${existingDesc} | ${typeLabel}` : typeLabel;
    }
  }
  if (Object.keys(updatePayload).length) {
    await sql/* sql */ `
      UPDATE inventory_order_request_items
      SET ${sql(updatePayload)}
      WHERE id = ${poItem.inventoryRequestItemId}
    `;
  }
  const remaining = Math.max(Number(req.quantity ?? 0) - Number(req.received_qty ?? 0), 0);
  const requestedQty =
    args.quantity != null ? Math.max(Number(args.quantity) || 0, 0) : remaining;
  const moveQty = Math.min(requestedQty, remaining);
  if (moveQty <= 0) {
    return { movedQty: 0, grnNumber: null };
  }

  const result = await receivePartsForInventoryRequestItem(
    args.companyId,
    poItem.inventoryRequestItemId,
    { quantity: moveQty, purchaseOrderId: args.poId }
  );
  await sql/* sql */ `
    UPDATE purchase_order_items
    SET moved_to_inventory = TRUE
    WHERE id = ${args.itemId}
  `;
  return { movedQty: moveQty, grnNumber: result?.grnNumber ?? null };
}
