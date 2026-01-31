import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId } = await params;
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  const sql = getSql();

  const runQuery = async (includeIsPart: boolean) => {
    const isPartFilter = includeIsPart ? sql`AND ei.is_part = TRUE` : sql``;
    return sql`
      SELECT
        est.id AS inquiry_id,
        'estimate' AS source_type,
        est.updated_at,
        car.make AS car_make,
        car.model AS car_model,
        car.plate_number AS car_plate,
        car.vin AS car_vin,
        NULL::text AS request_number
      FROM estimate_items ei
      INNER JOIN estimates est ON est.id = ei.estimate_id
      LEFT JOIN cars car ON car.id = est.car_id
      WHERE est.company_id = ${companyId}
        AND est.status IN ('draft', 'pending_approval', 'approved')
        AND ei.status = 'inquiry'
        ${isPartFilter}
      GROUP BY est.id, est.updated_at, car.make, car.model, car.plate_number, car.vin
      UNION ALL
      SELECT
        ior.id AS inquiry_id,
        'inventory' AS source_type,
        ior.updated_at,
        NULL::text AS car_make,
        NULL::text AS car_model,
        NULL::text AS car_plate,
        NULL::text AS car_vin,
        ior.request_number
      FROM inventory_order_request_items iori
      INNER JOIN inventory_order_requests ior ON ior.id = iori.request_id
      WHERE ior.company_id = ${companyId}
        AND ior.status = 'approved'
        AND iori.status = 'inquiry'
      ORDER BY updated_at DESC
    `;
  };

  let rows: any[] = [];
  try {
    rows = await runQuery(true);
  } catch (err: any) {
    const message = err?.message ?? "";
    if (message.toLowerCase().includes("is_part")) {
      rows = await runQuery(false);
    } else {
      console.error("Vendor inquiries query failed", err);
      return NextResponse.json({ error: "Failed to load inquiries" }, { status: 500 });
    }
  }

  const data = rows.map((row: any) => ({
    inquiryId: row.inquiry_id,
    sourceType: row.source_type,
    requestNumber: row.request_number ?? null,
    updatedAt: row.updated_at,
    carMake: row.car_make,
    carModel: row.car_model,
    carPlate: row.car_plate,
    carVin: row.car_vin,
  }));

  return NextResponse.json({ data });
}
