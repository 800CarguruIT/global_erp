import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

function toNumberOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toStringOrNull(value: any) {
  const str = value?.toString?.().trim?.() ?? "";
  return str.length ? str : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, vendorId } = await params;
  if (!companyId || !vendorId) {
    return NextResponse.json({ error: "companyId and vendorId are required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const estimateId = toStringOrNull(body.estimateId);
  const estimateItemId = toStringOrNull(body.estimateItemId);
  const inventoryRequestId = toStringOrNull(body.inventoryRequestId);
  const inventoryRequestItemId = toStringOrNull(body.inventoryRequestItemId);
  const isEstimate = !!estimateId && !!estimateItemId;
  const isInventory = !!inventoryRequestId && !!inventoryRequestItemId;
  if (!isEstimate && !isInventory) {
    return NextResponse.json(
      { error: "estimateId/estimateItemId or inventoryRequestId/inventoryRequestItemId required" },
      { status: 400 }
    );
  }

  const sql = getSql();
  if (isEstimate) {
    const verifyRows = await sql`
      SELECT ei.id
      FROM estimate_items ei
      INNER JOIN estimates est ON est.id = ei.estimate_id
      WHERE ei.id = ${estimateItemId}
        AND est.id = ${estimateId}
        AND est.company_id = ${companyId}
      LIMIT 1
    `;
    if (!verifyRows.length) {
      return NextResponse.json({ error: "Estimate item not found" }, { status: 404 });
    }
  }
  if (isInventory) {
    const verifyRows = await sql`
      SELECT iori.id
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
  }

  const row = await sql`
    INSERT INTO part_quotes (
      company_id,
      vendor_id,
      estimate_id,
      estimate_item_id,
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
      ${estimateId ?? null},
      ${estimateItemId ?? null},
      ${inventoryRequestId ?? null},
      ${inventoryRequestItemId ?? null},
      ${toStringOrNull(body.partNumber)},
      ${toStringOrNull(body.remarks)},
      ${toNumberOrNull(body.oemAmount)},
      ${toNumberOrNull(body.oeAmount)},
      ${toNumberOrNull(body.aftmAmount)},
      ${toNumberOrNull(body.usedAmount)},
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

  return NextResponse.json({ data: row[0] }, { status: 201 });
}
