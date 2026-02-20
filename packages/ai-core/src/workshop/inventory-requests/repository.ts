import { getSql } from "../../db";
import type {
  InventoryOrderRequest,
  InventoryOrderRequestItem,
  InventoryOrderRequestStatus,
  InventoryOrderRequestType,
} from "./types";

function mapRequest(row: any): InventoryOrderRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    requestNumber: row.request_number,
    requestType: row.request_type,
    status: row.status,
    estimateId: row.estimate_id,
    notes: row.notes,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: any): InventoryOrderRequestItem {
  return {
    id: row.id,
    requestId: row.request_id,
    lineNo: row.line_no,
    estimateItemId: row.estimate_item_id,
    inventoryTypeId: row.inventory_type_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    makeId: row.make_id,
    modelId: row.model_id,
    yearId: row.year_id,
    partName: row.part_name,
    partNumber: row.part_number,
    partBrand: row.part_brand,
    partType: row.part_type,
    description: row.description,
    unit: row.unit,
    category: row.category,
    subcategory: row.subcategory,
    quantity: Number(row.quantity ?? 0),
    orderedQty: Number(row.ordered_qty ?? 0),
    receivedQty: Number(row.received_qty ?? 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function nextRequestNumber(companyId: string): Promise<string> {
  const sql = getSql();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `IOR-${year}${month}-`;
  const rows = await sql/* sql */ `
    SELECT request_number
    FROM inventory_order_requests
    WHERE company_id = ${companyId} AND request_number LIKE ${prefix + "%"}
    ORDER BY request_number DESC
    LIMIT 1
  `;
  if (!rows.length) return `${prefix}0001`;
  const last = (rows[0]?.request_number as string | undefined) ?? "";
  const num = last ? parseInt(last.replace(prefix, "")) || 0 : 0;
  return `${prefix}${(num + 1).toString().padStart(4, "0")}`;
}

export async function createInventoryOrderRequest(args: {
  companyId: string;
  requestType: InventoryOrderRequestType;
  estimateId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  items: Array<{
    partName: string;
    partNumber?: string | null;
    partBrand?: string | null;
    partType?: string | null;
    description?: string | null;
    unit?: string | null;
    category?: string | null;
    subcategory?: string | null;
    inventoryTypeId?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    makeId?: string | null;
    modelId?: string | null;
    yearId?: string | null;
    quantity?: number;
    estimateItemId?: string | null;
  }>;
}): Promise<{ request: InventoryOrderRequest; items: InventoryOrderRequestItem[] }> {
  const sql = getSql();
  const requestNumber = await nextRequestNumber(args.companyId);
  const autoApprove = args.requestType === "job";
  const status: InventoryOrderRequestStatus = autoApprove ? "approved" : "pending";
  const approvedAt = autoApprove ? new Date().toISOString() : null;

  const rows = await sql/* sql */ `
    INSERT INTO inventory_order_requests (
      company_id,
      request_number,
      request_type,
      status,
      estimate_id,
      notes,
      created_by,
      approved_by,
      approved_at
    ) VALUES (
      ${args.companyId},
      ${requestNumber},
      ${args.requestType},
      ${status},
      ${args.estimateId ?? null},
      ${args.notes ?? null},
      ${args.createdBy ?? null},
      ${autoApprove ? args.createdBy ?? null : null},
      ${approvedAt}
    )
    RETURNING *
  `;
  const request = mapRequest(rows[0]);

  const items = args.items ?? [];
  for (const [idx, item] of items.entries()) {
    await sql/* sql */ `
      INSERT INTO inventory_order_request_items (
        request_id,
        line_no,
        estimate_item_id,
        inventory_type_id,
        category_id,
        subcategory_id,
        make_id,
        model_id,
        year_id,
        part_name,
        part_number,
        part_brand,
        part_type,
        description,
        unit,
        category,
        subcategory,
        quantity,
        status
      ) VALUES (
        ${request.id},
        ${idx + 1},
        ${item.estimateItemId ?? null},
        ${item.inventoryTypeId ?? null},
        ${item.categoryId ?? null},
        ${item.subcategoryId ?? null},
        ${item.makeId ?? null},
        ${item.modelId ?? null},
        ${item.yearId ?? null},
        ${item.partName},
        ${item.partNumber ?? null},
        ${item.partBrand ?? null},
        ${item.partType ?? null},
        ${item.description ?? null},
        ${item.unit ?? null},
        ${item.category ?? null},
        ${item.subcategory ?? null},
        ${item.quantity ?? 1},
        ${autoApprove ? "inquiry" : "pending"}
      )
    `;
  }

  const savedItems = await listInventoryOrderRequestItems(request.id);
  return { request, items: savedItems };
}

export async function listInventoryOrderRequests(
  companyId: string,
  opts: { status?: InventoryOrderRequestStatus; requestType?: InventoryOrderRequestType } = {}
): Promise<Array<InventoryOrderRequest & { items: InventoryOrderRequestItem[] }>> {
  const sql = getSql();
  const where =
    opts.status && opts.requestType
      ? sql`company_id = ${companyId} AND status = ${opts.status} AND request_type = ${opts.requestType}`
      : opts.status
      ? sql`company_id = ${companyId} AND status = ${opts.status}`
      : opts.requestType
      ? sql`company_id = ${companyId} AND request_type = ${opts.requestType}`
      : sql`company_id = ${companyId}`;

  const rows = await sql/* sql */ `
    SELECT * FROM inventory_order_requests
    WHERE ${where}
    ORDER BY updated_at DESC
  `;
  const requests = rows.map(mapRequest);
  if (!requests.length) return [];

  const ids = requests.map((r) => r.id);
  const itemsRows = await sql/* sql */ `
    SELECT * FROM inventory_order_request_items
    WHERE request_id = ANY(${ids})
    ORDER BY request_id, line_no ASC
  `;
  const itemMap = new Map<string, InventoryOrderRequestItem[]>();
  itemsRows.map(mapItem).forEach((item) => {
    const list = itemMap.get(item.requestId) ?? [];
    list.push(item);
    itemMap.set(item.requestId, list);
  });

  return requests.map((r) => ({ ...r, items: itemMap.get(r.id) ?? [] }));
}

export async function listInventoryOrderRequestItems(requestId: string): Promise<InventoryOrderRequestItem[]> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_order_request_items
    WHERE request_id = ${requestId}
    ORDER BY line_no ASC
  `;
  return rows.map(mapItem);
}

export async function approveInventoryOrderRequest(
  companyId: string,
  requestId: string,
  approvedBy?: string | null
): Promise<{ request: InventoryOrderRequest; items: InventoryOrderRequestItem[] }> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    UPDATE inventory_order_requests
    SET status = ${"approved"},
        approved_by = ${approvedBy ?? null},
        approved_at = NOW()
    WHERE company_id = ${companyId} AND id = ${requestId}
    RETURNING *
  `;
  if (!rows.length) {
    throw new Error("Request not found");
  }
  await sql/* sql */ `
    UPDATE inventory_order_request_items
    SET status = ${"inquiry"}
    WHERE request_id = ${requestId}
  `;
  const request = mapRequest(rows[0]);
  const items = await listInventoryOrderRequestItems(requestId);
  return { request, items };
}

export async function updateInventoryOrderRequest(
  companyId: string,
  requestId: string,
  patch: Partial<{
    requestType: InventoryOrderRequestType;
    estimateId: string | null;
    notes: string | null;
    status: InventoryOrderRequestStatus;
  }>,
  items?: Array<{
    id?: string;
    lineNo?: number;
    estimateItemId?: string | null;
    partName: string;
    partNumber?: string | null;
    partBrand?: string | null;
    partType?: string | null;
    description?: string | null;
    unit?: string | null;
    category?: string | null;
    subcategory?: string | null;
    inventoryTypeId?: string | null;
    categoryId?: string | null;
    subcategoryId?: string | null;
    makeId?: string | null;
    modelId?: string | null;
    yearId?: string | null;
    quantity?: number;
  }>
): Promise<{ request: InventoryOrderRequest; items: InventoryOrderRequestItem[] }> {
  const sql = getSql();
  const updated = Object.fromEntries(
    Object.entries({
      request_type: patch.requestType,
      estimate_id: patch.estimateId,
      notes: patch.notes,
      status: patch.status,
    }).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(updated).length) {
    await sql/* sql */ `
      UPDATE inventory_order_requests
      SET ${sql(updated)}
      WHERE company_id = ${companyId} AND id = ${requestId}
    `;
  }

  if (items) {
    await sql/* sql */ `DELETE FROM inventory_order_request_items WHERE request_id = ${requestId}`;
    for (const [idx, item] of items.entries()) {
      await sql/* sql */ `
        INSERT INTO inventory_order_request_items (
          request_id,
          line_no,
          estimate_item_id,
          inventory_type_id,
          category_id,
          subcategory_id,
          make_id,
          model_id,
          year_id,
          part_name,
          part_number,
          part_brand,
          part_type,
          description,
          unit,
          category,
          subcategory,
          quantity,
          status
        ) VALUES (
          ${requestId},
          ${item.lineNo ?? idx + 1},
          ${item.estimateItemId ?? null},
          ${item.inventoryTypeId ?? null},
          ${item.categoryId ?? null},
          ${item.subcategoryId ?? null},
          ${item.makeId ?? null},
          ${item.modelId ?? null},
          ${item.yearId ?? null},
          ${item.partName},
          ${item.partNumber ?? null},
          ${item.partBrand ?? null},
          ${item.partType ?? null},
          ${item.description ?? null},
          ${item.unit ?? null},
          ${item.category ?? null},
          ${item.subcategory ?? null},
          ${item.quantity ?? 1},
          ${"pending"}
        )
      `;
    }
  }

  const requestRows = await sql/* sql */ `
    SELECT * FROM inventory_order_requests
    WHERE company_id = ${companyId} AND id = ${requestId}
    LIMIT 1
  `;
  if (!requestRows.length) {
    throw new Error("Request not found");
  }
  const request = mapRequest(requestRows[0]);
  const savedItems = await listInventoryOrderRequestItems(requestId);
  return { request, items: savedItems };
}

export async function deleteInventoryOrderRequest(companyId: string, requestId: string): Promise<void> {
  const sql = getSql();
  await sql/* sql */ `
    DELETE FROM inventory_order_requests
    WHERE company_id = ${companyId} AND id = ${requestId}
  `;
}

export async function receiveInventoryRequestItem(
  companyId: string,
  itemId: string,
  payload: { quantity: number }
): Promise<InventoryOrderRequestItem | null> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT * FROM inventory_order_request_items
    WHERE id = ${itemId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const item = mapItem(rows[0]);
  const newReceived = Number(item.receivedQty ?? 0) + Number(payload.quantity ?? 0);
  const newStatus = newReceived >= item.quantity ? "received" : item.status;
  const updated = await sql/* sql */ `
    UPDATE inventory_order_request_items
    SET received_qty = ${newReceived},
        status = ${newStatus}
    WHERE id = ${itemId}
    RETURNING *
  `;
  return updated.length ? mapItem(updated[0]) : null;
}
