import { NextRequest, NextResponse } from "next/server";
import { receivePoItems } from "@repo/ai-core/workshop/procurement/repository";
import { getSql } from "@repo/ai-core/db";
import { upsertVerifiedCatalogEntry } from "@repo/ai-core/workshop/parts/catalog-lookup";

type Params = { params: Promise<{ companyId: string; poId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, poId } = await params;
  const userId = req.headers.get("x-user-id") || null;
  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.items)) {
    return new NextResponse("items required", { status: 400 });
  }

  // Block receive if vendor evidence is missing for any item being received
  const sql = getSql();
  const itemIds = body.items
    .filter((i: any) => String(i.action ?? "received").toLowerCase() === "received")
    .map((i: any) => String(i.itemId));

  if (itemIds.length > 0) {
    const evidenceCheck = await sql`
      SELECT id, name, vendor_part_number, vendor_part_photo_file_id
      FROM purchase_order_items
      WHERE purchase_order_id = ${poId}
        AND id::text = ANY(${sql.array(itemIds)})
    `;
    const missing = evidenceCheck.filter(
      (item: any) => !item.vendor_part_number || !item.vendor_part_photo_file_id
    );
    if (missing.length > 0) {
      const names = missing.map((m: any) => m.name || m.id.slice(0, 8)).join(", ");
      return NextResponse.json(
        { error: `Vendor must upload part number and photo before receiving. Missing evidence for: ${names}` },
        { status: 400 }
      );
    }
  }

  const result = await receivePoItems(
    companyId,
    poId,
    body.items.map((i: any) => ({
      itemId: i.itemId,
      quantity: i.quantity ?? 0,
      action: String(i.action ?? "received").toLowerCase(),
    })),
    userId
  );

  // Auto-build verified parts catalog from received items with evidence
  try {
    // Get PO with vendor info and car details from linked inspection chain
    const poRows = await sql`SELECT vendor_id FROM purchase_orders WHERE id = ${poId} LIMIT 1`;
    const vendorId = poRows[0]?.vendor_id ?? null;

    for (const itemId of itemIds) {
      const itemRow = await sql`
        SELECT poi.name, poi.vendor_part_number, poi.vendor_part_brand, poi.vendor_part_photo_file_id,
               poi.estimate_item_id, poi.quote_id
        FROM purchase_order_items poi
        WHERE poi.id = ${itemId}
        LIMIT 1
      `;
      const item = itemRow[0];
      if (!item?.vendor_part_number) continue;

      // Trace back to car details: PO item → estimate_item → estimate → inspection → car
      let carMake = "", carModel = "", carYear: number | null = null, vin = "";
      if (item.estimate_item_id) {
        const carRows = await sql`
          SELECT c.make, c.model, c.model_year, c.vin
          FROM estimate_items ei
          JOIN estimates e ON e.id = ei.estimate_id
          LEFT JOIN inspections i ON i.id = e.inspection_id
          LEFT JOIN cars c ON c.id = COALESCE(i.car_id, e.car_id)
          WHERE ei.id = ${item.estimate_item_id}
          LIMIT 1
        `;
        if (carRows[0]) {
          carMake = carRows[0].make ?? "";
          carModel = carRows[0].model ?? "";
          carYear = carRows[0].model_year ?? null;
          vin = carRows[0].vin ?? "";
        }
      }

      if (carMake && item.vendor_part_number) {
        await upsertVerifiedCatalogEntry({
          companyId,
          carMake,
          carModel: carModel || null,
          carYear,
          vin: vin || null,
          partName: item.name ?? "",
          confirmedPartNumber: item.vendor_part_number,
          confirmedBrand: item.vendor_part_brand ?? null,
          partPhotoFileId: item.vendor_part_photo_file_id ?? null,
          sourcePoId: poId,
          sourceVendorId: vendorId,
        });
      }
    }
  } catch (err) {
    console.error("[receive] Auto-catalog failed (non-blocking):", err);
  }

  return NextResponse.json({ data: result });
}
