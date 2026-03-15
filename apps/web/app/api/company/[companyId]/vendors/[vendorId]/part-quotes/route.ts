import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toStringOrNull(value: unknown) {
  const str = value?.toString?.().trim?.() ?? "";
  return str.length ? str : null;
}

function resolveBrandValue(selectedValue: unknown, customValue: unknown) {
  const selected = toStringOrNull(selectedValue);
  const custom = toStringOrNull(customValue);
  const token = (selected ?? "").toLowerCase();
  if (token === "other" || token === "__other__") return custom;
  return selected;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, vendorId } = await params;
  if (!companyId || !vendorId) {
    return NextResponse.json({ error: "companyId and vendorId are required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const inspectionId = toStringOrNull(body.inspectionId ?? body.estimateId);
  const lineItemId = toStringOrNull(body.lineItemId);
  const inventoryRequestId = toStringOrNull(body.inventoryRequestId);
  const inventoryRequestItemId = toStringOrNull(body.inventoryRequestItemId);
  const oemBrand = resolveBrandValue(body.oemBrand, body.oemCustomBrandName);
  const oeBrand = resolveBrandValue(body.oeBrand, body.oeCustomBrandName);
  const aftmBrand = resolveBrandValue(body.aftmBrand, body.aftmCustomBrandName);
  const usedBrand = resolveBrandValue(body.usedBrand, body.usedCustomBrandName);

  const oemAmount = toNumberOrNull(body.oemAmount);
  const oeAmount = toNumberOrNull(body.oeAmount);
  const aftmAmount = toNumberOrNull(body.aftmAmount);
  const usedAmount = toNumberOrNull(body.usedAmount);
  const typeChecks: Array<{ label: string; amount: number | null; brand: string | null }> = [
    { label: "OEM", amount: oemAmount, brand: oemBrand },
    { label: "OE", amount: oeAmount, brand: oeBrand },
    { label: "After Market", amount: aftmAmount, brand: aftmBrand },
    { label: "Used", amount: usedAmount, brand: usedBrand },
  ];
  for (const check of typeChecks) {
    if ((check.amount ?? 0) > 0 && !check.brand) {
      return NextResponse.json({ error: `Select brand for ${check.label}.` }, { status: 400 });
    }
  }
  const resolvedBrand = oemBrand ?? oeBrand ?? aftmBrand ?? usedBrand ?? null;
  if (!resolvedBrand) {
    return NextResponse.json({ error: "Select at least one quote type with brand." }, { status: 400 });
  }
  const isEstimate = !!lineItemId;
  const isInventory = !!inventoryRequestId && !!inventoryRequestItemId;
  if (!isEstimate && !isInventory) {
    return NextResponse.json(
      { error: "lineItemId or inventoryRequestId/inventoryRequestItemId required" },
      { status: 400 }
    );
  }

  const sql = getSql();
  if (isEstimate && lineItemId) {
    const existing = await sql`
      SELECT id
      FROM part_quotes
      WHERE company_id = ${companyId}
        AND vendor_id = ${vendorId}
        AND line_item_id = ${lineItemId}
      LIMIT 1
    `;
    if (existing.length) {
      return NextResponse.json({ error: "Quote already submitted for this part." }, { status: 409 });
    }
  }
  if (isInventory) {
    const existing = await sql`
      SELECT id
      FROM part_quotes
      WHERE company_id = ${companyId}
        AND vendor_id = ${vendorId}
        AND inventory_request_item_id = ${inventoryRequestItemId}
      LIMIT 1
    `;
    if (existing.length) {
      return NextResponse.json({ error: "Quote already submitted for this part." }, { status: 409 });
    }
  }

  let resolvedPartNumber: string | null = null;
  if (isEstimate && lineItemId) {
    const verifyRows = await sql`
      SELECT li.id, li.part_number, li.product_name
      FROM line_items li
      WHERE li.id = ${lineItemId}
        AND li.company_id = ${companyId}
        AND (${inspectionId}::uuid IS NULL OR li.inspection_id = ${inspectionId})
      LIMIT 1
    `;
    if (!verifyRows.length) {
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }
    resolvedPartNumber = toStringOrNull(verifyRows[0]?.part_number ?? null);
  }
  if (isInventory) {
    const verifyRows = await sql`
      SELECT iori.id, iori.part_number
      FROM inventory_order_request_items iori
      INNER JOIN inventory_order_requests ior ON ior.id = iori.request_id
      WHERE iori.id = ${inventoryRequestItemId}
        AND ior.id = ${inventoryRequestId}
        AND ior.company_id = ${companyId}
      LIMIT 1
    `;
    if (!verifyRows.length) {
      return NextResponse.json({ error: "Inventory request item not found" }, { status: 404 });
    }
    resolvedPartNumber = toStringOrNull(verifyRows[0]?.part_number ?? null);
  }

  const hasPartBrandColRows = await sql<{ has_col: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'part_quotes'
        AND column_name = 'part_brand'
    ) AS has_col
  `;
  const hasPartBrandCol = Boolean(hasPartBrandColRows[0]?.has_col);

  const row = hasPartBrandCol
    ? await sql`
        INSERT INTO part_quotes (
          company_id,
          vendor_id,
          estimate_id,
          estimate_item_id,
          line_item_id,
          inventory_request_id,
          inventory_request_item_id,
          part_number,
          part_brand,
          remarks,
          oem,
          oe,
          aftm,
          used,
          oem_qty,
          oe_qty,
          aftm_qty,
          used_qty,
          oem_etd,
          oe_etd,
          aftm_etd,
          used_etd,
          oem_time,
          oe_time,
          aftm_time,
          used_time
        ) VALUES (
          ${companyId},
          ${vendorId},
          ${null},
          ${null},
          ${lineItemId ?? null},
          ${inventoryRequestId ?? null},
          ${inventoryRequestItemId ?? null},
          ${resolvedPartNumber},
          ${resolvedBrand},
          ${toStringOrNull(body.remarks)},
          ${oemAmount},
          ${oeAmount},
          ${aftmAmount},
          ${usedAmount},
          ${toNumberOrNull(body.oemQty)},
          ${toNumberOrNull(body.oeQty)},
          ${toNumberOrNull(body.aftmQty)},
          ${toNumberOrNull(body.usedQty)},
          ${toStringOrNull(body.oemEtd)},
          ${toStringOrNull(body.oeEtd)},
          ${toStringOrNull(body.aftmEtd)},
          ${toStringOrNull(body.usedEtd)},
          ${toStringOrNull(body.oemTime)},
          ${toStringOrNull(body.oeTime)},
          ${toStringOrNull(body.aftmTime)},
          ${toStringOrNull(body.usedTime)}
        )
        RETURNING id
      `
    : await sql`
        INSERT INTO part_quotes (
          company_id,
          vendor_id,
          estimate_id,
          estimate_item_id,
          line_item_id,
          inventory_request_id,
          inventory_request_item_id,
          part_number,
          remarks,
          oem,
          oe,
          aftm,
          used,
          oem_qty,
          oe_qty,
          aftm_qty,
          used_qty,
          oem_etd,
          oe_etd,
          aftm_etd,
          used_etd,
          oem_time,
          oe_time,
          aftm_time,
          used_time
        ) VALUES (
          ${companyId},
          ${vendorId},
          ${null},
          ${null},
          ${lineItemId ?? null},
          ${inventoryRequestId ?? null},
          ${inventoryRequestItemId ?? null},
          ${resolvedPartNumber},
          ${toStringOrNull(body.remarks)},
          ${oemAmount},
          ${oeAmount},
          ${aftmAmount},
          ${usedAmount},
          ${toNumberOrNull(body.oemQty)},
          ${toNumberOrNull(body.oeQty)},
          ${toNumberOrNull(body.aftmQty)},
          ${toNumberOrNull(body.usedQty)},
          ${toStringOrNull(body.oemEtd)},
          ${toStringOrNull(body.oeEtd)},
          ${toStringOrNull(body.aftmEtd)},
          ${toStringOrNull(body.usedEtd)},
          ${toStringOrNull(body.oemTime)},
          ${toStringOrNull(body.oeTime)},
          ${toStringOrNull(body.aftmTime)},
          ${toStringOrNull(body.usedTime)}
        )
        RETURNING id
      `;

  try {
    const hasOptionBrandColsRows = await sql<{
      oem_brand: boolean;
      oe_brand: boolean;
      aftm_brand: boolean;
      used_brand: boolean;
    }[]>`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'part_quotes' AND column_name = 'oem_brand'
        ) AS oem_brand,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'part_quotes' AND column_name = 'oe_brand'
        ) AS oe_brand,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'part_quotes' AND column_name = 'aftm_brand'
        ) AS aftm_brand,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'part_quotes' AND column_name = 'used_brand'
        ) AS used_brand
    `;
    const rowCols = hasOptionBrandColsRows[0];
    if (rowCols?.oem_brand) {
      await sql`UPDATE part_quotes SET oem_brand = ${oemBrand} WHERE id = ${row[0]?.id}`;
    }
    if (rowCols?.oe_brand) {
      await sql`UPDATE part_quotes SET oe_brand = ${oeBrand} WHERE id = ${row[0]?.id}`;
    }
    if (rowCols?.aftm_brand) {
      await sql`UPDATE part_quotes SET aftm_brand = ${aftmBrand} WHERE id = ${row[0]?.id}`;
    }
    if (rowCols?.used_brand) {
      await sql`UPDATE part_quotes SET used_brand = ${usedBrand} WHERE id = ${row[0]?.id}`;
    }
  } catch {
    // Optional per-type brand columns may not exist before migration.
  }

  try {
    const tableExistsRows = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.part_brands') IS NOT NULL AS exists
    `;
    if (tableExistsRows[0]?.exists) {
      const uniqueBrands = Array.from(new Set([oemBrand, oeBrand, aftmBrand, usedBrand].filter(Boolean)));
      for (const brand of uniqueBrands) {
        const normalizedBrand = String(brand).toLowerCase().replace(/\s+/g, " ").trim();
        await sql`
          INSERT INTO part_brands (company_id, name, normalized_name)
          VALUES (${companyId}, ${String(brand)}, ${normalizedBrand})
          ON CONFLICT (company_id, normalized_name)
          DO UPDATE SET name = EXCLUDED.name, updated_at = now()
        `;
      }
    }
  } catch {
    // Keep quote submission non-blocking when brand table migration is not yet applied.
  }

  return NextResponse.json({ data: row[0] }, { status: 201 });
}
