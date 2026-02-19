import { getSql } from "../../db";
import { getCompanySettings, upsertCompanySettings } from "../../accounting/configRepository";
import { postJournal, resolveEntityId } from "../../accounting/service";
import { getQuoteWithItems } from "../quotes/repository";
import type {
  PurchaseOrder,
  PurchaseOrderGrnEntry,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderType,
} from "./types";
import {
  ensurePartCatalogItem,
  receivePartsForEstimateItem,
  receivePartsForInventoryRequestItem,
} from "../parts/repository";

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
    quoteId: row.quote_id,
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

function mapGrnRow(row: any): PurchaseOrderGrnEntry {
  return {
    id: row.id,
    grnNumber: row.grn_number,
    quantity: Number(row.quantity ?? 0),
    partName: row.part_name ?? "Part",
    partSku: row.part_sku ?? null,
    sourceId: row.source_id ?? null,
    createdAt: row.created_at,
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
        WHERE im.source_id = poi.inventory_request_item_id
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

async function getPoGrnEntries(poId: string): Promise<PurchaseOrderGrnEntry[]> {
  const sql = getSql();
  const hasPoColumn = await hasInventoryMovementPurchaseOrderIdColumn();
  const poPredicate = hasPoColumn ? sql`im.purchase_order_id = ${poId}` : sql`FALSE`;
  const rows = await sql/* sql */ `
    SELECT
      im.id,
      im.grn_number,
      im.quantity,
      im.source_id,
      im.created_at,
      COALESCE(
        NULLIF(poi.name, ''),
        NULLIF(im.note, ''),
        NULLIF(pc.description, ''),
        NULLIF(pc.part_number, ''),
        'Part'
      ) AS part_name,
      pc.sku AS part_sku
    FROM inventory_movements im
    LEFT JOIN parts_catalog pc ON pc.id = im.part_id
    LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = ${poId}
      AND (
        (poi.estimate_item_id IS NOT NULL AND poi.estimate_item_id = im.source_id)
        OR (poi.inventory_request_item_id IS NOT NULL AND poi.inventory_request_item_id = im.source_id)
      )
    WHERE (
      ${poPredicate}
      OR poi.id IS NOT NULL
    )
      AND im.direction = 'in'
      AND im.source_type = 'receipt'
      AND im.grn_number IS NOT NULL
    ORDER BY im.created_at DESC
  `;
  return rows.map(mapGrnRow);
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

async function hasPoItemQuoteIdColumn(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_order_items'
      AND column_name = 'quote_id'
    LIMIT 1
  `;
  return rows.length > 0;
}

async function hasInventoryMovementPurchaseOrderIdColumn(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_movements'
      AND column_name = 'purchase_order_id'
    LIMIT 1
  `;
  return rows.length > 0;
}

let inventoryMovementTriggerPresentCache: boolean | null = null;

async function hasInventoryMovementTrigger(): Promise<boolean> {
  if (inventoryMovementTriggerPresentCache != null) return inventoryMovementTriggerPresentCache;
  const sql = getSql();
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
  companyId: string;
  partId: string;
  locationCode: string;
  quantity: number;
}) {
  const hasTrigger = await hasInventoryMovementTrigger();
  if (hasTrigger) return;
  const sql = getSql();
  await sql/* sql */ `
    INSERT INTO inventory_stock (company_id, part_id, location_code, on_hand)
    VALUES (${params.companyId}, ${params.partId}, ${params.locationCode}, ${params.quantity})
    ON CONFLICT (company_id, part_id, location_code)
    DO UPDATE SET on_hand = inventory_stock.on_hand + ${params.quantity}, updated_at = now()
  `;
}

async function ensureEntityAccountByCode(params: {
  companyId: string;
  entityId: string;
  code: string;
  name: string;
  type: string;
  normalBalance: "debit" | "credit";
}): Promise<string> {
  const sql = getSql();
  const resolveExisting = async () => {
    const rows = await sql/* sql */ `
      SELECT id
      FROM accounting_accounts
      WHERE
        (
          company_id = ${params.companyId}
          AND (account_code = ${params.code} OR code = ${params.code})
        )
        OR (
          entity_id = ${params.entityId}
          AND (account_code = ${params.code} OR code = ${params.code})
        )
      ORDER BY
        (company_id = ${params.companyId}) DESC,
        (entity_id = ${params.entityId}) DESC,
        updated_at DESC
      LIMIT 1
    `;
    return (rows[0]?.id as string | undefined) ?? null;
  };

  const reportableInEntity = await sql/* sql */ `
    SELECT id
    FROM accounting_accounts
    WHERE entity_id = ${params.entityId}
      AND company_id = ${params.companyId}
      AND (code = ${params.code} OR account_code = ${params.code})
    LIMIT 1
  `;
  if (reportableInEntity.length) return reportableInEntity[0].id as string;

  const templateByCompanyCode = await sql/* sql */ `
    SELECT
      heading_id,
      subheading_id,
      group_id,
      COALESCE(NULLIF(account_code, ''), NULLIF(code, ''), ${params.code}) AS code,
      COALESCE(NULLIF(account_name, ''), NULLIF(name, ''), ${params.name}) AS name,
      COALESCE(type, ${params.type}) AS type,
      COALESCE(normal_balance, ${params.normalBalance}) AS normal_balance
    FROM accounting_accounts
    WHERE company_id = ${params.companyId}
      AND (account_code = ${params.code} OR code = ${params.code})
    ORDER BY (entity_id = ${params.entityId}) DESC, updated_at DESC
    LIMIT 1
  `;

  const templateFromGroupCode = templateByCompanyCode.length
    ? null
    : await sql/* sql */ `
      SELECT
        g.heading_id,
        g.subheading_id,
        g.id AS group_id
      FROM accounting_groups g
      WHERE g.company_id = ${params.companyId}
        AND g.group_code = ${params.code.slice(0, 4)}
      LIMIT 1
    `;

  const headingId =
    (templateByCompanyCode[0]?.heading_id as string | undefined) ??
    (templateFromGroupCode?.[0]?.heading_id as string | undefined) ??
    null;
  const subheadingId =
    (templateByCompanyCode[0]?.subheading_id as string | undefined) ??
    (templateFromGroupCode?.[0]?.subheading_id as string | undefined) ??
    null;
  const groupId =
    (templateByCompanyCode[0]?.group_id as string | undefined) ??
    (templateFromGroupCode?.[0]?.group_id as string | undefined) ??
    null;
  const resolvedCode = (templateByCompanyCode[0]?.code as string | undefined) ?? params.code;
  const resolvedName = (templateByCompanyCode[0]?.name as string | undefined) ?? params.name;
  const resolvedType = (templateByCompanyCode[0]?.type as string | undefined) ?? params.type;
  const resolvedNormalBalance =
    ((templateByCompanyCode[0]?.normal_balance as "debit" | "credit" | undefined) ?? params.normalBalance);

  const found = await sql/* sql */ `
    SELECT id
    FROM accounting_accounts
    WHERE entity_id = ${params.entityId}
      AND (code = ${resolvedCode} OR account_code = ${resolvedCode})
    LIMIT 1
  `;
  if (found.length && headingId && subheadingId && groupId) {
    try {
      const promoted = await sql/* sql */ `
        UPDATE accounting_accounts
        SET
          company_id = COALESCE(company_id, ${params.companyId}),
          heading_id = COALESCE(heading_id, ${headingId}),
          subheading_id = COALESCE(subheading_id, ${subheadingId}),
          group_id = COALESCE(group_id, ${groupId}),
          account_code = COALESCE(NULLIF(account_code, ''), ${resolvedCode}),
          account_name = COALESCE(NULLIF(account_name, ''), ${resolvedName}),
          code = COALESCE(NULLIF(code, ''), ${resolvedCode}),
          name = COALESCE(NULLIF(name, ''), ${resolvedName}),
          type = COALESCE(type, ${resolvedType}),
          normal_balance = COALESCE(normal_balance, ${resolvedNormalBalance}),
          is_leaf = TRUE,
          is_active = TRUE
        WHERE id = ${found[0].id}
        RETURNING id
      `;
      if (promoted.length) return promoted[0].id as string;
    } catch (error: any) {
      if (String(error?.code) === "23505") {
        const existing = await resolveExisting();
        if (existing) return existing;
      }
      throw error;
    }
  } else if (found.length) {
    return found[0].id as string;
  }

  const existingByCompany = await sql/* sql */ `
    SELECT id
    FROM accounting_accounts
    WHERE company_id = ${params.companyId}
      AND (account_code = ${resolvedCode} OR code = ${resolvedCode})
    ORDER BY (entity_id = ${params.entityId}) DESC, updated_at DESC
    LIMIT 1
  `;
  if (existingByCompany.length) {
    return existingByCompany[0].id as string;
  }

  if (groupId) {
    const existingByGroup = await sql/* sql */ `
      SELECT id
      FROM accounting_accounts
      WHERE group_id = ${groupId}
        AND (account_code = ${resolvedCode} OR code = ${resolvedCode})
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (existingByGroup.length) {
      try {
        const normalized = await sql/* sql */ `
          UPDATE accounting_accounts
          SET
            company_id = COALESCE(company_id, ${params.companyId}),
            heading_id = COALESCE(heading_id, ${headingId}),
            subheading_id = COALESCE(subheading_id, ${subheadingId}),
            group_id = COALESCE(group_id, ${groupId}),
            account_code = COALESCE(NULLIF(account_code, ''), ${resolvedCode}),
            account_name = COALESCE(NULLIF(account_name, ''), ${resolvedName}),
            code = COALESCE(NULLIF(code, ''), ${resolvedCode}),
            name = COALESCE(NULLIF(name, ''), ${resolvedName}),
            type = COALESCE(type, ${resolvedType}),
            normal_balance = COALESCE(normal_balance, ${resolvedNormalBalance}),
            is_leaf = TRUE,
            is_active = TRUE
          WHERE id = ${existingByGroup[0].id}
          RETURNING id
        `;
        if (normalized.length) return normalized[0].id as string;
      } catch (error: any) {
        if (String(error?.code) === "23505") {
          const existing = await resolveExisting();
          if (existing) return existing;
        }
        throw error;
      }
    }
  }

  let created: any[] = [];
  try {
    created = await sql/* sql */ `
      INSERT INTO accounting_accounts (
        entity_id,
        heading_id,
        subheading_id,
        group_id,
        company_id,
        account_code,
        account_name,
        code,
        name,
        type,
        normal_balance,
        is_leaf,
        is_active
      ) VALUES (
        ${params.entityId},
        ${headingId},
        ${subheadingId},
        ${groupId},
        ${params.companyId},
        ${resolvedCode},
        ${resolvedName},
        ${resolvedCode},
        ${resolvedName},
        ${resolvedType},
        ${resolvedNormalBalance},
        TRUE,
        TRUE
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
  } catch (error: any) {
    if (String(error?.code) === "23505") {
      const existing = await resolveExisting();
      if (existing) return existing;
    }
    throw error;
  }
  if (created.length) return created[0].id as string;

  const afterConflict = await sql/* sql */ `
    SELECT id
    FROM accounting_accounts
    WHERE
      (
        company_id = ${params.companyId}
        AND (account_code = ${resolvedCode} OR code = ${resolvedCode})
      )
      OR (
        group_id = ${groupId}
        AND (account_code = ${resolvedCode} OR code = ${resolvedCode})
      )
      OR (
        entity_id = ${params.entityId}
        AND (account_code = ${resolvedCode} OR code = ${resolvedCode})
      )
    ORDER BY
      (company_id = ${params.companyId}) DESC,
      (entity_id = ${params.entityId}) DESC,
      updated_at DESC
    LIMIT 1
  `;
  if (afterConflict.length) return afterConflict[0].id as string;

  throw new Error(`Unable to resolve accounting account for code ${resolvedCode}`);
}

async function resolveAccountInEntity(params: {
  companyId: string;
  entityId: string;
  accountId?: string | null;
  fallbackCode: string;
  fallbackName: string;
  fallbackType: string;
  fallbackNormalBalance: "debit" | "credit";
}): Promise<string> {
  const sql = getSql();

  if (params.accountId) {
    const sameEntity = await sql/* sql */ `
      SELECT id
      FROM accounting_accounts
      WHERE id = ${params.accountId}
        AND entity_id = ${params.entityId}
      LIMIT 1
    `;
    if (sameEntity.length) {
      const normalized = await sql/* sql */ `
        SELECT COALESCE(NULLIF(account_code, ''), NULLIF(code, ''), ${params.fallbackCode}) AS code
        FROM accounting_accounts
        WHERE id = ${sameEntity[0].id}
        LIMIT 1
      `;
      return ensureEntityAccountByCode({
        companyId: params.companyId,
        entityId: params.entityId,
        code: (normalized[0]?.code as string | undefined) ?? params.fallbackCode,
        name: params.fallbackName,
        type: params.fallbackType,
        normalBalance: params.fallbackNormalBalance,
      });
    }

    const srcRows = await sql/* sql */ `
      SELECT
        COALESCE(NULLIF(account_code, ''), NULLIF(code, ''), ${params.fallbackCode}) AS code,
        COALESCE(NULLIF(account_name, ''), NULLIF(name, ''), ${params.fallbackName}) AS name,
        type,
        normal_balance
      FROM accounting_accounts
      WHERE id = ${params.accountId}
      LIMIT 1
    `;
    const src = srcRows[0] as
      | { code?: string | null; name?: string | null; type?: string | null; normal_balance?: "debit" | "credit" | null }
      | undefined;
    if (src?.code) {
      return ensureEntityAccountByCode({
        companyId: params.companyId,
        entityId: params.entityId,
        code: src.code,
        name: src.name ?? params.fallbackName,
        type: src.type ?? params.fallbackType,
        normalBalance: (src.normal_balance ?? params.fallbackNormalBalance) as "debit" | "credit",
      });
    }
  }

  return ensureEntityAccountByCode({
    companyId: params.companyId,
    entityId: params.entityId,
    code: params.fallbackCode,
    name: params.fallbackName,
    type: params.fallbackType,
    normalBalance: params.fallbackNormalBalance,
  });
}

async function ensureGrnAccounts(companyId: string): Promise<{
  entityId: string;
  inventoryAccountId: string;
  apControlAccountId: string;
}> {
  async function remapGrnAccountToCompanyScoped(params: {
    companyId: string;
    entityId: string;
    accountId: string;
  }): Promise<string> {
    const sql = getSql();
    const currentRows = await sql/* sql */ `
      SELECT
        id,
        COALESCE(NULLIF(account_code, ''), NULLIF(code, '')) AS code
      FROM accounting_accounts
      WHERE id = ${params.accountId}
      LIMIT 1
    `;
    const current = currentRows[0] as { id?: string; code?: string | null } | undefined;
    const currentCode = (current?.code ?? "").trim();
    if (!current?.id || !currentCode) return params.accountId;

    const companyRows = await sql/* sql */ `
      SELECT id
      FROM accounting_accounts
      WHERE company_id = ${params.companyId}
        AND (account_code = ${currentCode} OR code = ${currentCode})
      ORDER BY (entity_id = ${params.entityId}) DESC, updated_at DESC
      LIMIT 1
    `;
    const companyAccountId = (companyRows[0]?.id as string | undefined) ?? null;
    if (!companyAccountId || companyAccountId === params.accountId) return params.accountId;

    await sql/* sql */ `
      UPDATE accounting_journal_lines jl
      SET account_id = ${companyAccountId}
      FROM accounting_journals j
      WHERE jl.journal_id = j.id
        AND jl.account_id = ${params.accountId}
        AND jl.entity_id = ${params.entityId}
        AND j.entity_id = ${params.entityId}
        AND j.company_id = ${params.companyId}
        AND j.journal_type = 'grn_receipt'
    `;

    return companyAccountId;
  }

  const entityId = await resolveEntityId("company", companyId);
  const settings = await getCompanySettings(companyId);

  let inventoryAccountId = await resolveAccountInEntity({
    companyId,
    entityId,
    accountId: settings?.inventoryAccountId ?? null,
    fallbackCode: "1300",
    fallbackName: "Inventory",
    fallbackType: "asset",
    fallbackNormalBalance: "debit",
  });

  let apControlAccountId = await resolveAccountInEntity({
    companyId,
    entityId,
    accountId: settings?.apControlAccountId ?? null,
    fallbackCode: "2000",
    fallbackName: "Accounts Payable",
    fallbackType: "liability",
    fallbackNormalBalance: "credit",
  });

  inventoryAccountId = await remapGrnAccountToCompanyScoped({
    companyId,
    entityId,
    accountId: inventoryAccountId,
  });
  apControlAccountId = await remapGrnAccountToCompanyScoped({
    companyId,
    entityId,
    accountId: apControlAccountId,
  });

  if (
    !settings?.inventoryAccountId ||
    !settings?.apControlAccountId ||
    settings.inventoryAccountId !== inventoryAccountId ||
    settings.apControlAccountId !== apControlAccountId
  ) {
    await upsertCompanySettings(companyId, {
      inventoryAccountId,
      apControlAccountId,
    });
  }

  return { entityId, inventoryAccountId, apControlAccountId };
}

async function postGrnAccountingEntry(params: {
  companyId: string;
  poId: string;
  poNumber: string;
  vendorId?: string | null;
  itemId: string;
  itemName: string;
  unitCost: number;
  quantity: number;
}) {
  const amount = Number(params.unitCost ?? 0) * Number(params.quantity ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const { entityId, inventoryAccountId, apControlAccountId } = await ensureGrnAccounts(params.companyId);
  const today = new Date().toISOString().slice(0, 10);
  const lineDesc = `PO ${params.poNumber} - ${params.itemName}`;

  await postJournal({
    entityId,
    journalType: "grn_receipt",
    date: today,
    description: `GRN receipt for ${params.poNumber}`,
    reference: `GRN-${params.poId}-${params.itemId}-${Date.now()}`,
    lines: [
      {
        accountId: inventoryAccountId,
        description: `${lineDesc} (Dr Inventory)`,
        debit: amount,
        credit: 0,
        dimensions: {
          companyId: params.companyId,
          vendorId: params.vendorId ?? null,
        },
      },
      {
        accountId: apControlAccountId,
        description: `${lineDesc} (Cr AP Control)`,
        debit: 0,
        credit: amount,
        dimensions: {
          companyId: params.companyId,
          vendorId: params.vendorId ?? null,
        },
      },
    ],
    skipAccountValidation: false,
  });
}

async function getPostedGrnAmountForItem(params: {
  companyId: string;
  entityId: string;
  inventoryAccountId: string;
  poId: string;
  itemId: string;
}): Promise<number> {
  const sql = getSql();
  const rows = await sql/* sql */ `
    SELECT COALESCE(SUM(jl.debit), 0) AS amount
    FROM accounting_journals j
    INNER JOIN accounting_journal_lines jl ON jl.journal_id = j.id
    WHERE j.entity_id = ${params.entityId}
      AND j.company_id = ${params.companyId}
      AND j.journal_type = 'grn_receipt'
      AND j.journal_no LIKE ${`GRN-${params.poId}-${params.itemId}-%`}
      AND jl.account_id = ${params.inventoryAccountId}
  `;
  return Number(rows[0]?.amount ?? 0);
}

function buildFallbackPartNumber(itemId: string, name?: string | null): string {
  const fromName = String(name ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 10);
  const suffix = itemId.replace(/-/g, "").slice(-6).toUpperCase();
  return `PO${fromName || "PART"}${suffix}`;
}

function nextGrnNumber(): string {
  return `GRN-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
    estimateItemId?: string | null;
    partsCatalogId?: string | null;
    inventoryRequestItemId?: string | null;
    quoteId?: string | null;
    lineStatus?: "Received" | "Return" | null;
  }>;
}): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[] }> {
  const sql = getSql();
  const quoteIdColumnExists = await hasPoItemQuoteIdColumn();
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
    if (quoteIdColumnExists) {
      await sql/* sql */ `
        INSERT INTO purchase_order_items (
          purchase_order_id,
          line_no,
          quote_id,
          estimate_item_id,
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
          ${item.quoteId ?? null},
          ${item.estimateItemId ?? null},
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
    } else {
      await sql/* sql */ `
        INSERT INTO purchase_order_items (
          purchase_order_id,
          line_no,
          estimate_item_id,
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
          ${item.estimateItemId ?? null},
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
    }
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
): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[]; grns: PurchaseOrderGrnEntry[] } | null> {
  const sql = getSql();
  const rows =
    await sql/* sql */ `SELECT * FROM purchase_orders WHERE company_id = ${companyId} AND id = ${poId} LIMIT 1`;
  if (!rows.length) return null;
  const po = mapPoRow(rows[0]);
  const items = await getPoItems(poId);
  const grns = await getPoGrnEntries(poId);
  return { po, items, grns };
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
    quoteId?: string | null;
    estimateItemId?: string | null;
    name: string;
    description?: string | null;
    quantity?: number;
    unitCost?: number;
    partsCatalogId?: string | null;
    inventoryRequestItemId?: string | null;
  }>
): Promise<void> {
  const sql = getSql();
  const quoteIdColumnExists = await hasPoItemQuoteIdColumn();
  await sql/* sql */ `DELETE FROM purchase_order_items WHERE purchase_order_id = ${poId}`;
  for (const [idx, item] of items.entries()) {
    const qty = item.quantity ?? 0;
    const unit = item.unitCost ?? 0;
    if (quoteIdColumnExists) {
      await sql/* sql */ `
        INSERT INTO purchase_order_items (
          purchase_order_id,
          line_no,
          quote_id,
          estimate_item_id,
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
          ${item.quoteId ?? null},
          ${item.estimateItemId ?? null},
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
    } else {
      await sql/* sql */ `
        INSERT INTO purchase_order_items (
          purchase_order_id,
          line_no,
          estimate_item_id,
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
          ${item.estimateItemId ?? null},
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
  }
  await recalcTotals(poId);
}

export async function receivePoItems(
  companyId: string,
  poId: string,
  items: Array<{ itemId: string; quantity: number }>
): Promise<{ po: PurchaseOrder; items: PurchaseOrderItem[]; grns: PurchaseOrderGrnEntry[] }> {
  const sql = getSql();
  const poMetaRows = await sql/* sql */ `
    SELECT vendor_id, po_number
    FROM purchase_orders
    WHERE id = ${poId}
    LIMIT 1
  `;
  const poVendorId = (poMetaRows[0]?.vendor_id as string | undefined) ?? null;
  const poNumber = (poMetaRows[0]?.po_number as string | undefined) ?? "PO";

  function normalizePartNumber(raw?: string | null, fallback?: string | null): string {
    const base = (raw ?? fallback ?? "").trim();
    const cleaned = base.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24);
    return cleaned || `PO-${poId.slice(0, 8).toUpperCase()}`;
  }

  for (const entry of items) {
    const rows = await sql/* sql */ `
      SELECT * FROM purchase_order_items WHERE id = ${entry.itemId} AND purchase_order_id = ${poId} LIMIT 1
    `;
    if (!rows.length) continue;
    const current = mapItemRow(rows[0]);
    let resolvedEstimateItemId = current.estimateItemId;
    if (!resolvedEstimateItemId && current.quoteId) {
      try {
        const quoteRows = await sql/* sql */ `
          SELECT
            pq.estimate_item_id,
            COALESCE(
              pq.estimate_item_id,
              (
                SELECT ei.id
                FROM estimate_items ei
                WHERE ei.inspection_item_id = pq.line_item_id
                ORDER BY ei.updated_at DESC
                LIMIT 1
              )
            ) AS resolved_estimate_item_id
          FROM part_quotes pq
          WHERE pq.company_id = ${companyId}
            AND pq.id = ${current.quoteId}
          LIMIT 1
        `;
        resolvedEstimateItemId = (quoteRows[0]?.resolved_estimate_item_id as string | undefined) ?? null;
      } catch {
        // ignore fallback lookup errors
      }
    }
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
    if (resolvedEstimateItemId) {
      try {
        const partNumber = normalizePartNumber((current as any).partNumber ?? null, current.name);
        const brand = String((current as any).brand ?? (current as any).partBrand ?? "Generic").trim() || "Generic";
        await receivePartsForEstimateItem(companyId, resolvedEstimateItemId, {
          partNumber,
          brand,
          description: current.description ?? null,
          quantity: entry.quantity,
          costPerUnit: current.unitCost,
          purchaseOrderId: poId,
        } as any);
      } catch {
        // ignore inventory errors to not block PO receive
      }
      try {
        const estimateItemRows = await sql/* sql */ `
          SELECT inspection_item_id
          FROM estimate_items
          WHERE id = ${resolvedEstimateItemId}
          LIMIT 1
        `;
        const inspectionItemId = estimateItemRows[0]?.inspection_item_id as string | undefined;
        if (inspectionItemId) {
          const nextOrderStatus = status === "received" ? "Received" : "Ordered";
          await sql/* sql */ `
            UPDATE line_items
            SET part_ordered = 1,
                order_status = ${nextOrderStatus},
                updated_at = NOW()
            WHERE company_id = ${companyId}
              AND id = ${inspectionItemId}
          `;
        }
      } catch {
        // ignore line-item sync errors to avoid blocking PO receive
      }
      const quoteIdToUpdate = current.quoteId
        ? current.quoteId
        : (
            await sql/* sql */ `
              SELECT id
              FROM part_quotes
              WHERE company_id = ${companyId}
                AND (${poVendorId}::uuid IS NULL OR vendor_id = ${poVendorId})
                AND (
                  (${resolvedEstimateItemId}::uuid IS NOT NULL AND estimate_item_id = ${resolvedEstimateItemId})
                  OR (${current.inventoryRequestItemId ?? null}::uuid IS NOT NULL AND inventory_request_item_id = ${current.inventoryRequestItemId ?? null})
                )
              ORDER BY updated_at DESC
              LIMIT 1
            `
          )[0]?.id;
      if (quoteIdToUpdate) {
        try {
          const nextQuoteStatus = status === "received" ? "Received" : "Ordered";
          await sql/* sql */ `
            UPDATE part_quotes
            SET status = ${nextQuoteStatus},
                updated_at = NOW()
            WHERE company_id = ${companyId}
              AND id = ${quoteIdToUpdate}
          `;
        } catch {
          // ignore quote sync errors to avoid blocking PO receive
        }
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
      const quoteIdToUpdate = current.quoteId
        ? current.quoteId
        : (
            await sql/* sql */ `
              SELECT id
              FROM part_quotes
              WHERE company_id = ${companyId}
                AND (${poVendorId}::uuid IS NULL OR vendor_id = ${poVendorId})
                AND (${current.inventoryRequestItemId ?? null}::uuid IS NOT NULL AND inventory_request_item_id = ${current.inventoryRequestItemId ?? null})
              ORDER BY updated_at DESC
              LIMIT 1
            `
          )[0]?.id;
      if (quoteIdToUpdate) {
        try {
          const nextQuoteStatus = status === "received" ? "Received" : "Ordered";
          await sql/* sql */ `
            UPDATE part_quotes
            SET status = ${nextQuoteStatus},
                updated_at = NOW()
            WHERE company_id = ${companyId}
              AND id = ${quoteIdToUpdate}
          `;
        } catch {
          // ignore quote sync errors to avoid blocking PO receive
        }
      }
    }

    try {
      await postGrnAccountingEntry({
        companyId,
        poId,
        poNumber,
        vendorId: poVendorId,
        itemId: current.id,
        itemName: current.name,
        unitCost: Number(current.unitCost ?? 0),
        quantity: Number(entry.quantity ?? 0),
      });
    } catch (err) {
      console.error("Failed to post GRN accounting entry", {
        companyId,
        poId,
        itemId: current.id,
        error: (err as Error)?.message ?? err,
      });
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
  const grns = await getPoGrnEntries(poId);
  return { po: mapPoRow(poRow[0]), items: poItems, grns };
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

export async function reconcilePoGrn(
  companyId: string,
  poId: string
): Promise<{
  po: PurchaseOrder;
  items: PurchaseOrderItem[];
  grns: PurchaseOrderGrnEntry[];
  reconciledItems: number;
  reconciledQty: number;
  reconciledAmount: number;
}> {
  const sql = getSql();
  const poRows = await sql/* sql */ `
    SELECT *
    FROM purchase_orders
    WHERE company_id = ${companyId} AND id = ${poId}
    LIMIT 1
  `;
  if (!poRows.length) {
    throw new Error("Purchase order not found");
  }

  const po = mapPoRow(poRows[0]);
  const itemRows = await getPoItems(poId);
  const accountContext = await ensureGrnAccounts(companyId);
  const hasMovementPoColumn = await hasInventoryMovementPurchaseOrderIdColumn();

  let reconciledItems = 0;
  let reconciledQty = 0;
  let reconciledAmount = 0;

  for (const item of itemRows) {
    const receivedQty = Math.max(Number(item.receivedQty ?? 0), 0);
    if (receivedQty <= 0) continue;

    let resolvedEstimateItemId = item.estimateItemId ?? null;
    if (!resolvedEstimateItemId && item.quoteId) {
      try {
        const quoteRows = await sql/* sql */ `
          SELECT
            COALESCE(
              pq.estimate_item_id,
              (
                SELECT ei.id
                FROM estimate_items ei
                WHERE ei.inspection_item_id = pq.line_item_id
                ORDER BY ei.updated_at DESC
                LIMIT 1
              )
            ) AS resolved_estimate_item_id
          FROM part_quotes pq
          WHERE pq.company_id = ${companyId}
            AND pq.id = ${item.quoteId}
          LIMIT 1
        `;
        resolvedEstimateItemId = (quoteRows[0]?.resolved_estimate_item_id as string | undefined) ?? null;
      } catch {
        resolvedEstimateItemId = null;
      }
    }

    const movementPoPredicate = hasMovementPoColumn ? sql`im.purchase_order_id = ${poId}` : sql`FALSE`;
    const reconcileNotePrefix = `GRN reconcile for ${po.poNumber} - ${item.name}`;
    const movementSumRows = await sql/* sql */ `
      SELECT COALESCE(SUM(im.quantity), 0) AS qty
      FROM inventory_movements im
      WHERE im.direction = 'in'
        AND im.source_type = 'receipt'
        AND (
          (${resolvedEstimateItemId ?? null}::uuid IS NOT NULL AND im.source_id = ${resolvedEstimateItemId ?? null})
          OR (${item.inventoryRequestItemId ?? null}::uuid IS NOT NULL AND im.source_id = ${item.inventoryRequestItemId ?? null})
          OR (${movementPoPredicate} AND COALESCE(im.note, '') ILIKE ${`${reconcileNotePrefix}%`})
        )
    `;
    const movedQty = Number(movementSumRows[0]?.qty ?? 0);
    const missingQty = Math.max(receivedQty - movedQty, 0);

    const existingPostedAmount = await getPostedGrnAmountForItem({
      companyId,
      entityId: accountContext.entityId,
      inventoryAccountId: accountContext.inventoryAccountId,
      poId,
      itemId: item.id,
    });

    let postedByQtyBackfill = 0;

    if (missingQty > 0) {
      let sourceId: string | null = resolvedEstimateItemId ?? item.inventoryRequestItemId ?? null;
      let partNumber = "";
      let brand = "";
      let description = (item.description ?? "").trim() || item.name || "PO receipt reconcile";

      if (resolvedEstimateItemId) {
        const estRows = await sql/* sql */ `
          SELECT part_number, part_brand, part_name, part_sku
          FROM estimate_items
          WHERE id = ${resolvedEstimateItemId}
          LIMIT 1
        `;
        const est = estRows[0];
        partNumber = String(est?.part_number ?? est?.part_sku ?? "").trim();
        brand = String(est?.part_brand ?? "").trim();
        description = String(est?.part_name ?? "").trim() || description;
      } else if (item.inventoryRequestItemId) {
        const reqRows = await sql/* sql */ `
          SELECT part_number, part_brand, part_name, description
          FROM inventory_order_request_items
          WHERE id = ${item.inventoryRequestItemId}
          LIMIT 1
        `;
        const req = reqRows[0];
        partNumber = String(req?.part_number ?? "").trim();
        brand = String(req?.part_brand ?? "").trim();
        description = String(req?.description ?? "").trim() || String(req?.part_name ?? "").trim() || description;
      }

      const catalog = await ensurePartCatalogItem(
        companyId,
        partNumber || buildFallbackPartNumber(item.id, item.name),
        brand || "Generic",
        description
      );

      if (hasMovementPoColumn) {
        await sql/* sql */ `
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
            ${catalog.id},
            ${"MAIN"},
            ${"in"},
            ${missingQty},
            ${"receipt"},
            ${sourceId},
            ${nextGrnNumber()},
            ${reconcileNotePrefix},
            ${poId}
          )
        `;
      } else {
        await sql/* sql */ `
          INSERT INTO inventory_movements (
            company_id,
            part_id,
            location_code,
            direction,
            quantity,
            source_type,
            source_id,
            grn_number,
            note
          ) VALUES (
            ${companyId},
            ${catalog.id},
            ${"MAIN"},
            ${"in"},
            ${missingQty},
            ${"receipt"},
            ${sourceId},
            ${nextGrnNumber()},
            ${reconcileNotePrefix}
          )
        `;
      }
      await upsertInventoryStockFallback({
        companyId,
        partId: catalog.id,
        locationCode: "MAIN",
        quantity: missingQty,
      });

      if (Number(item.unitCost ?? 0) > 0) {
        try {
          await postGrnAccountingEntry({
            companyId,
            poId,
            poNumber: po.poNumber,
            vendorId: po.vendorId ?? null,
            itemId: item.id,
            itemName: `${item.name} (Reconcile)`,
            unitCost: Number(item.unitCost ?? 0),
            quantity: missingQty,
          });
          postedByQtyBackfill = missingQty * Number(item.unitCost ?? 0);
        } catch (err) {
          console.error("GRN reconcile accounting backfill failed", {
            companyId,
            poId,
            itemId: item.id,
            error: (err as Error)?.message ?? err,
          });
        }
      }

      reconciledItems += 1;
      reconciledQty += missingQty;
      reconciledAmount += postedByQtyBackfill;
    }

    const expectedAmount = receivedQty * Number(item.unitCost ?? 0);
    const missingAccountingAmount = Math.max(expectedAmount - existingPostedAmount - postedByQtyBackfill, 0);

    if (missingAccountingAmount > 0.0001 && Number(item.unitCost ?? 0) > 0) {
      const qtyForAccounting = missingAccountingAmount / Number(item.unitCost ?? 0);
      try {
        await postGrnAccountingEntry({
          companyId,
          poId,
          poNumber: po.poNumber,
          vendorId: po.vendorId ?? null,
          itemId: item.id,
          itemName: `${item.name} (Accounting Reconcile)`,
          unitCost: Number(item.unitCost ?? 0),
          quantity: qtyForAccounting,
        });
      } catch (err) {
        console.error("GRN reconcile accounting-only backfill failed", {
          companyId,
          poId,
          itemId: item.id,
          error: (err as Error)?.message ?? err,
        });
      }
      if (missingQty <= 0) {
        reconciledItems += 1;
      }
      reconciledAmount += missingAccountingAmount;
    }
  }

  const refreshedPoRows = await sql/* sql */ `SELECT * FROM purchase_orders WHERE id = ${poId} LIMIT 1`;
  const refreshedItems = await getPoItems(poId);
  const refreshedGrns = await getPoGrnEntries(poId);

  return {
    po: mapPoRow(refreshedPoRows[0]),
    items: refreshedItems,
    grns: refreshedGrns,
    reconciledItems,
    reconciledQty,
    reconciledAmount,
  };
}
