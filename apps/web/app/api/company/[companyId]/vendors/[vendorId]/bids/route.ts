import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";

type Params = { params: Promise<{ companyId: string; vendorId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { companyId, vendorId } = await params;
  if (!companyId || !vendorId) {
    return NextResponse.json({ error: "companyId and vendorId are required" }, { status: 400 });
  }

  const sql = getSql();
  const statusParam = req.nextUrl.searchParams.get("status")?.trim() ?? "";
  const normalizedStatusParam = statusParam.toLowerCase();
  const statusFilter = (() => {
    if (!statusParam) return sql``;
    if (normalizedStatusParam === "completed") {
      return sql`AND pq.status IN ('Received', 'Completed')`;
    }
    if (normalizedStatusParam === "returns") {
      return sql`AND pq.status IN ('Return', 'Returned')`;
    }
    if (normalizedStatusParam === "ordered") {
      return sql`AND (
        LOWER(COALESCE(pq.status, '')) IN ('ordered', 'accepted')
        OR pq.delivery_note_no IS NOT NULL
        OR pq.delivery_note_status IS NOT NULL
      )`;
    }
    return sql`AND pq.status = ${statusParam}`;
  })();
  const rows = await sql`
    SELECT
      pq.id,
      pq.oem,
      pq.oe,
      pq.aftm,
      pq.used,
      pq.oem_qty,
      pq.oe_qty,
      pq.aftm_qty,
      pq.used_qty,
      pq.oem_etd,
      pq.oe_etd,
      pq.aftm_etd,
      pq.used_etd,
      pq.remarks,
      pq.delivery_note_no,
      pq.delivery_note_status,
      pq.delivery_note_payload,
      pq.updated_at,
      pq.status,
      pq.vendor_part_number,
      pq.diagram_file_id,
      li.status AS line_item_status,
      COALESCE(li.product_name, iori.part_name) AS part_name,
      COALESCE(v.name, 'Vendor') AS vendor_name,
      COALESCE(
        NULLIF(car.make, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionMake', ''),
        NULLIF(est.meta->>'inspectionMake', ''),
        NULLIF(est.meta->>'carMake', ''),
        NULLIF(est_from_request.meta->>'inspectionMake', ''),
        NULLIF(est_from_request.meta->>'carMake', '')
      ) AS car_make,
      COALESCE(
        NULLIF(car.model, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionModel', ''),
        NULLIF(est.meta->>'inspectionModel', ''),
        NULLIF(est.meta->>'carModel', ''),
        NULLIF(est_from_request.meta->>'inspectionModel', ''),
        NULLIF(est_from_request.meta->>'carModel', '')
      ) AS car_model,
      COALESCE(
        NULLIF(car.plate_number, ''),
        NULLIF(est.meta->>'carPlate', ''),
        NULLIF(est.meta->>'plate', ''),
        NULLIF(est_from_request.meta->>'carPlate', ''),
        NULLIF(est_from_request.meta->>'plate', '')
      ) AS car_plate,
      COALESCE(
        NULLIF(car.vin, ''),
        NULLIF(li_inspection.draft_payload->>'inspectionVin', ''),
        NULLIF(est.meta->>'inspectionVin', ''),
        NULLIF(est.meta->>'carVin', ''),
        NULLIF(est.meta->>'vin', ''),
        NULLIF(est_from_request.meta->>'inspectionVin', ''),
        NULLIF(est_from_request.meta->>'carVin', ''),
        NULLIF(est_from_request.meta->>'vin', '')
      ) AS car_vin,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'destinationName', ''),
        COALESCE(dest_branch_payload.display_name, dest_branch_payload.name, dest_branch_payload.code),
        COALESCE(dest_branch_wq.display_name, dest_branch_wq.name, dest_branch_wq.code),
        COALESCE(dest_branch_lead.display_name, dest_branch_lead.name, dest_branch_lead.code),
        COALESCE(dest_branch_jc.display_name, dest_branch_jc.name, dest_branch_jc.code)
      ) AS delivery_destination_name,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'branchId', ''),
        wq_dest.branch_id::text,
        lead_from_est.branch_id::text,
        lead_from_jc.branch_id::text
      ) AS delivery_destination_branch_id
      ,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'sourceLocation', ''),
        NULLIF(lb_est.pickup_location, ''),
        NULLIF(lb_jc.pickup_location, ''),
        NULLIF(lead_from_est.pickup_from, ''),
        NULLIF(lead_from_jc.pickup_from, '')
      ) AS delivery_source_location_text,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'destinationLocation', ''),
        NULLIF(lb_est.dropoff_location, ''),
        NULLIF(lb_jc.dropoff_location, ''),
        NULLIF(lead_from_est.dropoff_to, ''),
        NULLIF(lead_from_jc.dropoff_to, ''),
        NULLIF(dest_branch_payload.address_line1, ''),
        NULLIF(dest_branch_wq.address_line1, ''),
        NULLIF(dest_branch_lead.address_line1, ''),
        NULLIF(dest_branch_jc.address_line1, '')
      ) AS delivery_destination_location_text,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'sourceLocationUrl', ''),
        NULLIF(lb_est.pickup_google_location, ''),
        NULLIF(lb_jc.pickup_google_location, ''),
        NULLIF(lead_from_est.pickup_google_location, ''),
        NULLIF(lead_from_jc.pickup_google_location, '')
      ) AS delivery_source_location_url,
      COALESCE(
        NULLIF(pq.delivery_note_payload->>'destinationLocationUrl', ''),
        NULLIF(dest_branch_payload.google_location, ''),
        NULLIF(dest_branch_wq.google_location, ''),
        NULLIF(dest_branch_lead.google_location, ''),
        NULLIF(dest_branch_jc.google_location, ''),
        NULLIF(lb_est.dropoff_google_location, ''),
        NULLIF(lb_jc.dropoff_google_location, ''),
        NULLIF(lead_from_est.dropoff_google_location, ''),
        NULLIF(lead_from_jc.dropoff_google_location, '')
      ) AS delivery_destination_location_url
    FROM part_quotes pq
    LEFT JOIN line_items li ON li.id = pq.line_item_id
    LEFT JOIN estimates est ON est.id = pq.estimate_id
    LEFT JOIN inspections li_inspection ON li_inspection.id = li.inspection_id
    LEFT JOIN inventory_order_request_items iori ON iori.id = pq.inventory_request_item_id
    LEFT JOIN inventory_order_requests ior ON ior.id = pq.inventory_request_id
    LEFT JOIN estimates est_from_request ON est_from_request.id = ior.estimate_id
    LEFT JOIN vendors v ON v.id = pq.vendor_id
    LEFT JOIN cars car ON car.id = COALESCE(est.car_id, est_from_request.car_id, li_inspection.car_id)
    LEFT JOIN LATERAL (
      SELECT wq.branch_id
      FROM workshop_quotes wq
      WHERE wq.company_id = pq.company_id
        AND (
          (
            NULLIF(pq.delivery_note_payload->>'workshopQuoteId', '') IS NOT NULL
            AND wq.id::text = (pq.delivery_note_payload->>'workshopQuoteId')
          )
          OR (
            COALESCE(pq.estimate_id, ior.estimate_id) IS NOT NULL
            AND wq.estimate_id = COALESCE(pq.estimate_id, ior.estimate_id)
          )
        )
      ORDER BY
        CASE
          WHEN wq.id::text = COALESCE(pq.delivery_note_payload->>'workshopQuoteId', '') THEN 0
          ELSE 1
        END,
        wq.updated_at DESC
      LIMIT 1
    ) wq_dest ON TRUE
    LEFT JOIN leads lead_from_est ON lead_from_est.id = COALESCE(est.lead_id, est_from_request.lead_id)
    LEFT JOIN LATERAL (
      SELECT jc.lead_id
      FROM job_cards jc
      WHERE jc.estimate_id = COALESCE(pq.estimate_id, ior.estimate_id)
      ORDER BY jc.updated_at DESC
      LIMIT 1
    ) jc_dest ON TRUE
    LEFT JOIN leads lead_from_jc ON lead_from_jc.id = jc_dest.lead_id
    LEFT JOIN LATERAL (
      SELECT lb.pickup_location, lb.pickup_google_location, lb.dropoff_location, lb.dropoff_google_location
      FROM lead_bookings lb
      WHERE lb.company_id = pq.company_id
        AND lb.lead_id = lead_from_est.id
        AND lb.status = 'active'
      ORDER BY lb.updated_at DESC
      LIMIT 1
    ) lb_est ON TRUE
    LEFT JOIN LATERAL (
      SELECT lb.pickup_location, lb.pickup_google_location, lb.dropoff_location, lb.dropoff_google_location
      FROM lead_bookings lb
      WHERE lb.company_id = pq.company_id
        AND lb.lead_id = lead_from_jc.id
        AND lb.status = 'active'
      ORDER BY lb.updated_at DESC
      LIMIT 1
    ) lb_jc ON TRUE
    LEFT JOIN branches dest_branch_payload
      ON dest_branch_payload.id::text = COALESCE(pq.delivery_note_payload->>'branchId', '')
      AND dest_branch_payload.company_id = pq.company_id
    LEFT JOIN branches dest_branch_wq
      ON dest_branch_wq.id = wq_dest.branch_id
      AND dest_branch_wq.company_id = pq.company_id
    LEFT JOIN branches dest_branch_lead
      ON dest_branch_lead.id = lead_from_est.branch_id
      AND dest_branch_lead.company_id = pq.company_id
    LEFT JOIN branches dest_branch_jc
      ON dest_branch_jc.id = lead_from_jc.branch_id
      AND dest_branch_jc.company_id = pq.company_id
    WHERE pq.company_id = ${companyId}
      AND pq.vendor_id = ${vendorId}
      ${statusFilter}
    ORDER BY pq.updated_at DESC
  `;

  const data = rows.map((row: any) => ({
    id: row.id,
    partName: row.part_name,
    carMake: row.car_make,
    carModel: row.car_model,
    carPlate: row.car_plate,
    carVin: row.car_vin,
    oem: row.oem != null ? Number(row.oem) : null,
    oe: row.oe != null ? Number(row.oe) : null,
    aftm: row.aftm != null ? Number(row.aftm) : null,
    used: row.used != null ? Number(row.used) : null,
    oemQty: row.oem_qty != null ? Number(row.oem_qty) : null,
    oeQty: row.oe_qty != null ? Number(row.oe_qty) : null,
    aftmQty: row.aftm_qty != null ? Number(row.aftm_qty) : null,
    usedQty: row.used_qty != null ? Number(row.used_qty) : null,
    oemEtd: row.oem_etd,
    oeEtd: row.oe_etd,
    aftmEtd: row.aftm_etd,
    usedEtd: row.used_etd,
    remarks: row.remarks,
    deliveryNoteNo: row.delivery_note_no ?? null,
    deliveryNoteStatus: row.delivery_note_status ?? null,
    deliveryDestinationBranchId:
      row.delivery_note_payload?.branchId ?? row.delivery_destination_branch_id ?? null,
    deliverySourceName: row.delivery_note_payload?.sourceName ?? row.vendor_name ?? null,
    deliverySourceLocation:
      row.delivery_note_payload?.sourceLocation ?? row.delivery_source_location_text ?? null,
    deliverySourceUrl: row.delivery_source_location_url ?? null,
    deliveryDestinationName:
      row.delivery_note_payload?.destinationName ?? row.delivery_destination_name ?? null,
    deliveryDestinationLocation: row.delivery_destination_location_text ?? null,
    deliveryDestinationUrl: row.delivery_destination_location_url ?? null,
    updatedAt: row.updated_at,
    vendorPartNumber: row.vendor_part_number ?? null,
    diagramFileId: row.diagram_file_id ?? null,
    status:
      normalizedStatusParam === "ordered" && String(row.line_item_status ?? "").toLowerCase() === "approved"
        ? "Approved"
        : row.status,
  }));

  return NextResponse.json({ data });
}
