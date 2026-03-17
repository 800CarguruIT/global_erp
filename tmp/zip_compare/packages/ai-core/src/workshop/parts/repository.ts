import { getSql } from "../../db";
import { getEstimateWithItems, recalculateEstimateTotals } from "../estimates/repository";
import type { PartCatalogItem, PartsRequirementRow, ProcurementStatus } from "./types";

let inventoryMovementTriggerPresentCache: boolean | null = null;

async function hasInventoryMovementTrigger(sql: ReturnType<typeof getSql>): Promise<boolean> {
  if (inventoryMovementTriggerPresentCache != null) return inventoryMovementTriggerPresentCache;
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'inventory_movements'
        AND t.tgname = 'trg_apply_inventory_movement'
        AND NOT t.tgisinternal
    ) AS exists
  `;
  inventoryMovementTriggerPresentCache = Boolean(rows[0]?.exists);
  return inventoryMovementTriggerPresentCache;
}

async function upsertInventoryStockFallback(params: {
  sql: ReturnType<typeof getSql>;
  companyId: string;
  partId: string;
  locationCode: string;
  quantity: number;
}) {
  const hasTrigger = await hasInventoryMovementTrigger(params.sql);
  if (hasTrigger) return;
  await params.sql`
    INSERT INTO inventory_stock (company_id, part_id, location_code, on_hand)
    VALUES (${params.companyId}, ${params.partId}, ${params.locationCode}, ${params.quantity})
    ON CONFLICT (company_id, part_id, location_code)
    DO UPDATE SET on_hand = inventory_stock.on_hand + ${params.quantity}, updated_at = now()
  `;
}

function mapCatalogRow(row: any): PartCatalogItem {
  return {
    id: row.id,
    companyId: row.company_id,
    partNumber: row.part_number,
    brand: row.brand,
    sku: row.sku,
    description: row.description,
    qrCode: row.qr_code,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPartsRequirementsForCompany(companyId: string): Promise<PartsRequirementRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      ei.id AS estimate_item_id,
      ei.estimate_id,
      est.inspection_id,
      est.lead_id,
      est.car_id,
      ei.part_name,
      ei.part_number,
      ei.part_brand,
      ei.part_sku,
      ei.type,
      ei.quantity,
      ei.ordered_qty,
      ei.received_qty,
      ei.issued_qty,
      ei.procurement_status
    FROM estimate_items ei
    INNER JOIN estimates est ON est.id = ei.estimate_id
    WHERE est.company_id = ${companyId}
      AND ei.is_part = TRUE
      AND ei.status = 'approved'
      AND est.status IN ('approved', 'pending_approval', 'draft')
    ORDER BY est.updated_at DESC, ei.line_no ASC
  `;

  return rows.map((row: any) => ({
    estimateItemId: row.estimate_item_id,
    estimateId: row.estimate_id,
    inspectionId: row.inspection_id,
    leadId: row.lead_id,
    carId: row.car_id,
    partName: row.part_name,
    partNumber: row.part_number,
    partBrand: row.part_brand,
    partSku: row.part_sku,
    type: row.type,
    quantity: Number(row.quantity ?? 0),
    orderedQty: Number(row.ordered_qty ?? 0),
    receivedQty: Number(row.received_qty ?? 0),
    issuedQty: Number(row.issued_qty ?? 0),
    procurementStatus: row.procurement_status as ProcurementStatus,
  }));
}

export async function ensurePartCatalogItem(
  companyId: string,
  partNumber: string,
  brand: string,
  description?: string | null,
  meta?: { category?: string | null; subcategory?: string | null; unit?: string | null }
): Promise<PartCatalogItem> {
  const sql = getSql();
  const normalizedDescription = (description ?? "").trim() || null;
  const existing = await sql`
    SELECT * FROM parts_catalog
    WHERE company_id = ${companyId} AND part_number = ${partNumber} AND brand = ${brand}
    LIMIT 1
  `;
  if (existing.length) {
    const row = existing[0];
    if (meta && (meta.category || meta.subcategory || meta.unit)) {
      await sql`
        UPDATE parts_catalog
        SET
          category = COALESCE(${meta.category ?? null}, category),
          subcategory = COALESCE(${meta.subcategory ?? null}, subcategory),
          unit = COALESCE(${meta.unit ?? null}, unit),
          description = COALESCE(NULLIF(description, ''), ${normalizedDescription})
        WHERE id = ${row.id}
      `;
    } else if (normalizedDescription) {
      await sql`
        UPDATE parts_catalog
        SET description = COALESCE(NULLIF(description, ''), ${normalizedDescription})
        WHERE id = ${row.id}
      `;
    }
    const refreshed = await sql`SELECT * FROM parts_catalog WHERE id = ${row.id} LIMIT 1`;
    return mapCatalogRow(refreshed[0] ?? row);
  }

  const sku = `P-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const qrCode = `QR-${sku}`;

  const rows = await sql`
    INSERT INTO parts_catalog (
      company_id,
      part_number,
      brand,
      sku,
      description,
      qr_code,
      category,
      subcategory,
      unit
    ) VALUES (
      ${companyId},
      ${partNumber},
      ${brand},
      ${sku},
      ${normalizedDescription},
      ${qrCode},
      ${meta?.category ?? null},
      ${meta?.subcategory ?? null},
      ${meta?.unit ?? null}
    )
    RETURNING *
  `;
  return mapCatalogRow(rows[0]);
}

export async function receivePartsForEstimateItem(
  companyId: string,
  estimateItemId: string,
  payload: {
    partNumber: string;
    brand: string;
    description?: string;
    quantity: number;
    costPerUnit?: number;
    purchaseOrderId?: string | null;
  }
): Promise<{ grnNumber: string; part: PartCatalogItem }> {
  const sql = getSql();
  const { partNumber, brand, description, quantity } = payload;
  const resolvedDescription = (description ?? "").trim() || `Received part ${partNumber}`;
  const part = await ensurePartCatalogItem(companyId, partNumber, brand, resolvedDescription);

  const grnNumber = `GRN-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  await sql`
    INSERT INTO inventory_movements (
      company_id,
      part_id,
      location_code,
      direction,
      quantity,
      source_type,
      source_id,
      grn_number,
      note,
      purchase_order_id
    ) VALUES (
      ${companyId},
      ${part.id},
      ${"MAIN"},
      ${"in"},
      ${quantity},
      ${"receipt"},
      ${estimateItemId},
      ${grnNumber},
      ${resolvedDescription},
      ${payload.purchaseOrderId ?? null}
    )
  `;
  await upsertInventoryStockFallback({
    sql,
    companyId,
    partId: part.id,
    locationCode: "MAIN",
    quantity,
  });

  await sql`
    UPDATE estimate_items
    SET
      part_number = ${part.partNumber},
      part_brand = ${part.brand},
      part_sku = ${part.sku},
      received_qty = received_qty + ${quantity},
      procurement_status = CASE
        WHEN (received_qty + ${quantity}) >= quantity THEN 'received'
        ELSE procurement_status
      END
    WHERE id = ${estimateItemId}
  `;

  await recalculateEstimateTotalsForItem(estimateItemId);

  return { grnNumber, part };
}

export async function receivePartsForInventoryRequestItem(
  companyId: string,
  requestItemId: string,
  payload: { quantity: number; purchaseOrderId?: string | null }
): Promise<{ grnNumber: string; part: PartCatalogItem } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM inventory_order_request_items
    WHERE id = ${requestItemId}
    LIMIT 1
  `;
  if (!rows.length) return null;
  const item = rows[0];
  let partNumber = (item.part_number as string | undefined)?.trim();
  let brand = (item.part_brand as string | undefined)?.trim();
  if (!partNumber) {
    partNumber = `INV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }
  if (!brand) {
    brand = "Generic";
  }
  if (!item.part_number || !item.part_brand) {
    await sql`
      UPDATE inventory_order_request_items
      SET part_number = ${partNumber},
          part_brand = ${brand}
      WHERE id = ${requestItemId}
    `;
  }

  const part = await ensurePartCatalogItem(
    companyId,
    partNumber,
    brand,
    (String(item.description ?? "").trim() || String(item.part_name ?? "").trim() || `Received part ${partNumber}`),
    {
      category: item.category ?? null,
      subcategory: item.subcategory ?? null,
      unit: item.unit ?? null,
    }
  );

  const grnNumber = `GRN-${new Date().toISOString().slice(0, 10)}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  await sql`
    INSERT INTO inventory_movements (
      company_id,
      part_id,
      location_code,
      direction,
      quantity,
      source_type,
      source_id,
      grn_number,
      note,
      purchase_order_id
    ) VALUES (
      ${companyId},
      ${part.id},
      ${"MAIN"},
      ${"in"},
      ${payload.quantity},
      ${"receipt"},
      ${requestItemId},
      ${grnNumber},
      ${item.description ?? item.part_name ?? null},
      ${payload.purchaseOrderId ?? null}
    )
  `;

  // Fallback: ensure stock row exists even if trigger is missing.
  await upsertInventoryStockFallback({
    sql,
    companyId,
    partId: part.id,
    locationCode: "MAIN",
    quantity: payload.quantity,
  });

  const newReceived = Number(item.received_qty ?? 0) + Number(payload.quantity ?? 0);
  const newStatus = newReceived >= Number(item.quantity ?? 0) ? "received" : item.status ?? "pending";
  await sql`
    UPDATE inventory_order_request_items
    SET received_qty = ${newReceived},
        status = ${newStatus}
    WHERE id = ${requestItemId}
  `;

  return { grnNumber, part };
}

export async function issuePartsForEstimateItem(
  companyId: string,
  estimateItemId: string,
  payload: { quantity: number; locationCode?: string }
): Promise<void> {
  const sql = getSql();
  const itemRows = await sql`
    SELECT * FROM estimate_items WHERE id = ${estimateItemId} LIMIT 1
  `;
  if (!itemRows.length) {
    throw new Error("Estimate item not found");
  }
  const item = itemRows[0];
  if (!item?.part_sku) {
    throw new Error("Part catalog entry not linked to this estimate item");
  }
  const catalogRows = await sql`
    SELECT * FROM parts_catalog
    WHERE company_id = ${companyId} AND sku = ${item.part_sku}
    LIMIT 1
  `;
  if (!catalogRows.length) {
    throw new Error("Part catalog entry not found for this item");
  }
  const part = mapCatalogRow(catalogRows[0]);
  const qty = payload.quantity ?? 0;
  const location = payload.locationCode ?? "MAIN";

  await sql`
    INSERT INTO inventory_movements (
      company_id,
      part_id,
      location_code,
      direction,
      quantity,
      source_type,
      source_id,
      note
    ) VALUES (
      ${companyId},
      ${part.id},
      ${location},
      ${"out"},
      ${qty},
      ${"issue"},
      ${estimateItemId},
      ${"Issue to job"}
    )
  `;

  await sql`
    UPDATE estimate_items
    SET
      issued_qty = issued_qty + ${qty},
      procurement_status = CASE
        WHEN (issued_qty + ${qty}) >= quantity THEN 'issued'
        ELSE procurement_status
      END
    WHERE id = ${estimateItemId}
  `;

  await recalculateEstimateTotalsForItem(estimateItemId);
}

async function recalculateEstimateTotalsForItem(estimateItemId: string) {
  const sql = getSql();
  const estRows = await sql`
    SELECT estimate_id FROM estimate_items WHERE id = ${estimateItemId} LIMIT 1
  `;
  if (!estRows.length) return;
  const estimateId = estRows[0]?.estimate_id as string | undefined;
  if (estimateId) {
    await recalculateEstimateTotals(estimateId);
  }
}
