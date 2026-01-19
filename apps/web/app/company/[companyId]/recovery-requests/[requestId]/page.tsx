import { getSql } from "@repo/ai-core/db";
import RecoveryProcessClient from "./RecoveryProcessClient";

type Params = { params: { companyId: string; requestId: string } | Promise<{ companyId: string; requestId: string }> };

export default async function RecoveryRequestPublicPage({ params }: Params) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId;
  const requestId = resolved?.requestId;
  if (!companyId || !requestId) {
    return <div className="p-6 text-sm text-muted-foreground">Missing recovery request.</div>;
  }

  const sql = getSql();
  const rows =
    await sql/* sql */ `
      SELECT
        rr.*,
        l.company_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        car.plate_number AS car_plate_number,
        car.make AS car_make,
        car.model AS car_model
      FROM recovery_requests rr
      JOIN leads l ON l.id = rr.lead_id
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN cars car ON car.id = l.car_id
      WHERE rr.id = ${requestId} AND l.company_id = ${companyId}
      LIMIT 1
    `;
  const row = rows?.[0];
  if (!row) {
    return <div className="p-6 text-sm text-muted-foreground">Recovery request not found.</div>;
  }

  return (
    <RecoveryProcessClient
      companyId={companyId}
      request={{
        id: row.id,
        status: row.status ?? null,
        stage: row.stage ?? null,
        createdAt: row.created_at ?? null,
        pickupLocation: row.pickup_location ?? null,
        dropoffLocation: row.dropoff_location ?? null,
        type: row.type ?? null,
        agentName: row.agent_name ?? null,
        agentPhone: row.agent_phone ?? null,
        agentCarPlate: row.agent_car_plate ?? null,
        acceptedAt: row.accepted_at ?? null,
        pickupReachedAt: row.pickup_reached_at ?? null,
        pickupFromCustomer: row.pickup_from_customer ?? false,
        pickupTermsSharedAt: row.pickup_terms_shared_at ?? null,
        pickupTermsConfirmedAt: row.pickup_terms_confirmed_at ?? null,
        pickupVideo: row.pickup_video ?? null,
        pickupRemarks: row.pickup_remarks ?? null,
        pickupCompletedAt: row.pickup_completed_at ?? null,
        dropoffReachedAt: row.dropoff_reached_at ?? null,
        dropoffVideo: row.dropoff_video ?? null,
        dropoffRemarks: row.dropoff_remarks ?? null,
        completedAt: row.completed_at ?? null,
        customerName: row.customer_name ?? null,
        customerPhone: row.customer_phone ?? null,
        carPlateNumber: row.car_plate_number ?? null,
        carMake: row.car_make ?? null,
        carModel: row.car_model ?? null,
      }}
    />
  );
}
