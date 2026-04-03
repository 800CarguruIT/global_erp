import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  try {
    const sql = getSql();
    const tokenRows = await sql`
      SELECT company_id, lead_id, expires_at FROM lead_share_tokens
      WHERE token = ${token} LIMIT 1
    `;
    if (!tokenRows.length) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

    const { company_id, lead_id, expires_at } = tokenRows[0] as any;
    if (expires_at && new Date(expires_at) < new Date()) {
      return NextResponse.json({ error: "This link has expired" }, { status: 410 });
    }

    const leadRows = await sql`
      SELECT
        l.id, l.lead_type, l.lead_status, l.lead_stage, l.service_type,
        l.pickup_from, l.pickup_google_location, l.dropoff_to, l.dropoff_google_location,
        l.created_at,
        c.name AS customer_name, c.phone AS customer_phone,
        car.plate_number AS car_plate_number, car.model AS car_model, car.make AS car_make
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      WHERE l.company_id = ${company_id} AND l.id = ${lead_id}
      LIMIT 1
    `;
    if (!leadRows.length) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const lead = leadRows[0] as any;
    return NextResponse.json({
      data: {
        id: lead.id,
        customerName: lead.customer_name ?? "Customer",
        customerPhone: lead.customer_phone ?? null,
        carPlateNumber: lead.car_plate_number ?? null,
        carModel: lead.car_model ?? null,
        carMake: lead.car_make ?? null,
        leadType: lead.lead_type,
        leadStatus: lead.lead_status,
        leadStage: lead.lead_stage,
        serviceType: lead.service_type ?? null,
        pickupFrom: lead.pickup_from ?? null,
        pickupGoogleLocation: lead.pickup_google_location ?? null,
        dropoffTo: lead.dropoff_to ?? null,
        dropoffGoogleLocation: lead.dropoff_google_location ?? null,
        createdAt: lead.created_at,
      },
    });
  } catch (err: any) {
    console.error("[public/lead] Error:", err?.message, err?.stack);
    return NextResponse.json({ error: "Failed to load lead" }, { status: 500 });
  }
}
