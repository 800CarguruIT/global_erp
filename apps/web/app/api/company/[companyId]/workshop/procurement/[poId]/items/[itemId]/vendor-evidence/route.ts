import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; poId: string; itemId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, poId, itemId } = await params;
  const sql = getSql();
  const rows = await sql`
    SELECT vendor_part_number, vendor_part_brand, vendor_part_photo_file_id, vendor_evidence_at
    FROM purchase_order_items
    WHERE id = ${itemId}
      AND purchase_order_id = ${poId}
      AND purchase_order_id IN (SELECT id FROM purchase_orders WHERE company_id = ${companyId})
    LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({
    data: {
      partNumber: rows[0].vendor_part_number,
      brand: rows[0].vendor_part_brand,
      photoFileId: rows[0].vendor_part_photo_file_id,
      uploadedAt: rows[0].vendor_evidence_at,
    },
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { companyId, poId, itemId } = await params;
  const body = await req.json().catch(() => ({}));

  const partNumber = String(body?.partNumber ?? "").trim();
  const brand = String(body?.brand ?? "").trim() || null;
  const photoFileId = String(body?.photoFileId ?? "").trim() || null;

  if (!partNumber) {
    return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
  }
  if (!photoFileId) {
    return NextResponse.json({ error: "photoFileId is required — upload a photo of the part" }, { status: 400 });
  }

  const sql = getSql();

  // Verify item belongs to this PO and company
  const check = await sql`
    SELECT poi.id FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.id = ${itemId}
      AND poi.purchase_order_id = ${poId}
      AND po.company_id = ${companyId}
    LIMIT 1
  `;
  if (!check[0]) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await sql`
    UPDATE purchase_order_items SET
      vendor_part_number = ${partNumber},
      vendor_part_brand = ${brand},
      vendor_part_photo_file_id = ${photoFileId},
      vendor_evidence_at = now()
    WHERE id = ${itemId}
  `;

  return NextResponse.json({
    data: { partNumber, brand, photoFileId, uploadedAt: new Date().toISOString() },
  });
}
