import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getUserContext } from "@/lib/auth/user-context";

type Params = { params: Promise<{ companyId: string; jobCardId: string }> };
type CollectCarSourceType = "recovery" | "walkin" | "unknown";

function normalizeFileId(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out || null;
}

function normalizeMediaMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const keys = ["video", "front", "rear", "right", "left", "cluster"] as const;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const id = normalizeFileId(row[key]);
    if (id) out[key] = id;
  }
  return out;
}

function sanitizeCarMediaReview(value: unknown): Record<string, "pending" | "verified" | "rejected"> {
  const keys = ["front", "rear", "right", "left", "video"] as const;
  const out: Record<string, "pending" | "verified" | "rejected"> = {};
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  for (const key of keys) {
    const v = String(row[key] ?? "").trim().toLowerCase();
    out[key] = v === "verified" || v === "rejected" ? (v as "verified" | "rejected") : "pending";
  }
  return out;
}

function sanitizeTextMap(value: unknown): Record<string, string> {
  const keys = ["front", "rear", "right", "left", "video"] as const;
  const out: Record<string, string> = {};
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  for (const key of keys) {
    out[key] = String(row[key] ?? "").trim();
  }
  return out;
}

async function resolveCollectCarSource(
  sql: any,
  companyId: string,
  leadId: string | null | undefined
): Promise<{ sourceType: CollectCarSourceType; sourceMedia: Record<string, string> }> {
  if (!leadId) return { sourceType: "unknown", sourceMedia: {} };
  const leadRows = await sql`
    SELECT
      lead_type,
      workshop_visit_mode,
      pickup_from,
      dropoff_to,
      carin_video,
      workflow_required
    FROM leads
    WHERE company_id = ${companyId}
      AND id = ${leadId}
    LIMIT 1
  `;
  const leadRow = leadRows[0];
  if (!leadRow) return { sourceType: "unknown", sourceMedia: {} };

  const isRecovery =
    String(leadRow.lead_type ?? "").toLowerCase() === "recovery" ||
    String(leadRow.workshop_visit_mode ?? "").toLowerCase() === "recovery" ||
    Boolean(String(leadRow.pickup_from ?? "").trim()) ||
    Boolean(String(leadRow.dropoff_to ?? "").trim());

  if (isRecovery) {
    const recoveryRows = await sql`
      SELECT
        pickup_video,
        pickup_front_image,
        pickup_rear_image,
        pickup_right_image,
        pickup_left_image,
        pickup_cluster_image
      FROM recovery_requests
      WHERE lead_id = ${leadId}
        AND type = 'pickup'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const recoveryRow = recoveryRows[0];
    const media = normalizeMediaMap({
      video: recoveryRow?.pickup_video ?? null,
      front: recoveryRow?.pickup_front_image ?? null,
      rear: recoveryRow?.pickup_rear_image ?? null,
      right: recoveryRow?.pickup_right_image ?? null,
      left: recoveryRow?.pickup_left_image ?? null,
      cluster: recoveryRow?.pickup_cluster_image ?? null,
    });
    return { sourceType: "recovery", sourceMedia: media };
  }

  const workflowRequired = (leadRow.workflow_required ?? {}) as Record<string, unknown>;
  const media = normalizeMediaMap({
    video: leadRow.carin_video ?? workflowRequired.inspectionVideo360 ?? null,
    front: workflowRequired.inspectionPhotoFront ?? null,
    rear: workflowRequired.inspectionPhotoRear ?? null,
    right: workflowRequired.inspectionPhotoRight ?? null,
    left: workflowRequired.inspectionPhotoLeft ?? null,
    cluster: workflowRequired.inspectionClusterImage ?? null,
  });
  return { sourceType: "walkin", sourceMedia: media };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, jobCardId } = await params;
  const sql = getSql();

  const jobRows = await sql`
    SELECT
           jc.id,
           jc.done_by,
           jc.start_at,
           jc.complete_at,
           jc.collect_car_video_id,
           jc.collect_car_mileage,
           jc.collect_car_mileage_image_id,
           jc.collect_car_at,
           jc.working_video_id,
           jc.pre_work_checked_at,
           jc.pre_work_checked_by,
           jc.pre_work_note,
           jc.final_inspection_test_drive,
           jc.final_inspection_cluster_warning,
           jc.final_inspection_car_wash,
           jc.final_inspection_tyre_check,
           jc.final_inspection_computer_reset,
           jc.final_inspection_protective_shields,
           jc.final_inspection_remarks,
           jc.final_inspection_car_out_video_id,
           jc.final_inspection_at,
           jc.final_inspection_by,
           jc.estimate_id,
           jc.lead_id,
           jc.status,
           jc.remarks,
           jc.created_at,
           jc.updated_at,
           e.inspection_id,
           e.lead_id AS estimate_lead_id,
           i.draft_payload AS inspection_draft_payload,
           i.customer_id,
           i.car_id,
           COALESCE(i.customer_remark, i.draft_payload->>'customerComplain') AS customer_remark,
           COALESCE(i.inspector_remark, i.draft_payload->>'inspectorRemarks') AS inspector_remark,
           c.code AS customer_code,
           c.name AS customer_name,
           c.phone AS customer_phone,
           c.customer_type,
           car.plate_number,
           car.vin,
           car.make,
           car.model,
           car.model_year,
           car.body_type,
           COALESCE(b.display_name, b.name, b.code) AS branch_name,
           l.branch_id AS lead_branch_id,
           COALESCE(wq.status, '') AS workshop_quote_status,
           COALESCE(wq.remarks, '') AS quote_remarks
    FROM job_cards jc
    LEFT JOIN estimates e ON e.id = jc.estimate_id
    LEFT JOIN inspections i ON i.id = e.inspection_id
    LEFT JOIN leads l ON l.id = e.lead_id
    LEFT JOIN branches b ON b.id = l.branch_id
    LEFT JOIN LATERAL (
      SELECT status, remarks
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND estimate_id = jc.estimate_id
        AND branch_id IS NOT DISTINCT FROM l.branch_id
      ORDER BY
        CASE
          WHEN status = 'verified' THEN 3
          WHEN status = 'accepted' THEN 2
          WHEN status = 'pending' THEN 1
          ELSE 0
        END DESC,
        verified_at DESC NULLS LAST,
        approved_at DESC NULLS LAST,
        updated_at DESC
      LIMIT 1
    ) wq ON TRUE
    LEFT JOIN customers c ON c.id = i.customer_id
    LEFT JOIN cars car ON car.id = i.car_id
    WHERE jc.id = ${jobCardId} AND jc.estimate_id IS NOT NULL
    LIMIT 1
  `;

  if (!jobRows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const jobCard = jobRows[0]!;
  if (jobCard && jobCard.estimate_id) {
    // ensure company scope by joining estimate
    const companyCheck = await sql`
      SELECT 1
      FROM estimates
      WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!companyCheck.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let items = await sql`
    SELECT *
    FROM line_items
    WHERE job_card_id = ${jobCardId}
    ORDER BY created_at ASC
  `;
  if (!items.length && jobCard?.inspection_id) {
    // Backfill for records where approved customer line items were not linked to job card.
    await sql`
      UPDATE line_items li
      SET job_card_id = ${jobCardId}
      WHERE li.company_id = ${companyId}
        AND li.inspection_id = ${jobCard.inspection_id}
        AND COALESCE(li.is_add, 0) = 0
        AND li.job_card_id IS NULL
        AND (
          LOWER(COALESCE(li.customer_approval_status, '')) = 'approved'
          OR LOWER(COALESCE(li.status, '')) = 'approved'
        )
    `;
    items = await sql`
      SELECT *
      FROM line_items
      WHERE job_card_id = ${jobCardId}
      ORDER BY created_at ASC
    `;
  }
  let mergedItems: any[] = [...items];
  const lineItemIds = items.map((row: any) => row.id).filter(Boolean);
  if (lineItemIds.length) {
    const quoteStatusRows = await sql`
      SELECT
        source.line_item_id,
        BOOL_OR(LOWER(COALESCE(source.status, '')) IN ('partially received', 'partially_received', 'partial')) AS has_partial,
        MAX(
          CASE
            WHEN LOWER(COALESCE(source.status, '')) IN ('received', 'completed') THEN 3
            WHEN LOWER(COALESCE(source.status, '')) IN ('return', 'returned') THEN 2
            WHEN LOWER(COALESCE(source.status, '')) = 'ordered' THEN 1
            ELSE 0
          END
        ) AS status_rank,
        MAX(NULLIF(source.delivery_note_no, '')) AS delivery_note_no,
        MAX(NULLIF(source.delivery_note_status, '')) AS delivery_note_status
      FROM (
        SELECT
          li.id AS line_item_id,
          pq.status,
          pq.delivery_note_no,
          pq.delivery_note_status
        FROM line_items li
        INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        WHERE li.id = ANY(${lineItemIds})
      ) source
      GROUP BY source.line_item_id
    `;
    const derivedStatusByLineItemId = new Map(
      quoteStatusRows.map((row: any) => {
        const rank = Number(row.status_rank ?? 0);
        const hasPartial = Boolean(row.has_partial);
        const derived =
          hasPartial ? "Partially Received" : rank >= 3 ? "Received" : rank === 2 ? "Returned" : rank === 1 ? "Ordered" : "";
        return [String(row.line_item_id), derived] as const;
      })
    );
    const deliveryNoteByLineItemId = new Map(
      quoteStatusRows.map((row: any) => [
        String(row.line_item_id),
        {
          delivery_note_no: row.delivery_note_no ?? null,
          delivery_note_status: row.delivery_note_status ?? null,
        },
      ])
    );
    mergedItems = items.map((row: any) => {
      const derived = derivedStatusByLineItemId.get(String(row.id));
      const deliveryMeta = deliveryNoteByLineItemId.get(String(row.id));
      if (!derived && !deliveryMeta) return row;
      return {
        ...row,
        po_status: derived ?? row.po_status ?? row.order_status ?? null,
        order_status:
          derived === "Partially Received"
            ? "Ordered"
            : derived ?? row.order_status ?? null,
        delivery_note_no: deliveryMeta?.delivery_note_no ?? row.delivery_note_no ?? null,
        delivery_note_status: deliveryMeta?.delivery_note_status ?? row.delivery_note_status ?? null,
      };
    });
  }

  const leadIdForCollectCar = String(jobCard?.lead_id ?? jobCard?.estimate_lead_id ?? "").trim() || null;
  const collectCarSource = await resolveCollectCarSource(sql, companyId, leadIdForCollectCar);
  const inspectionDraftPayload =
    (jobCard?.inspection_draft_payload && typeof jobCard.inspection_draft_payload === "object"
      ? jobCard.inspection_draft_payload
      : {}) as Record<string, any>;
  const collectCarMedia = {
    sourceType: collectCarSource.sourceType,
    sourceMedia: collectCarSource.sourceMedia,
    carMediaReview: sanitizeCarMediaReview(inspectionDraftPayload.carMediaReview ?? {}),
    carMediaReplacement: sanitizeTextMap(inspectionDraftPayload.carMediaReplacement ?? {}),
    carMediaRejectNote: sanitizeTextMap(inspectionDraftPayload.carMediaRejectNote ?? {}),
  };

  return NextResponse.json({ data: { jobCard, items: mergedItems, collectCarMedia } });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, jobCardId } = await params;
  const body = await req.json().catch(() => ({}));
  if (
    body?.action !== "start" &&
    body?.action !== "complete" &&
    body?.action !== "quote" &&
    body?.action !== "verify" &&
    body?.action !== "collect_car" &&
    body?.action !== "pre_work_check" &&
    body?.action !== "working_video" &&
    body?.action !== "add_additional_item" &&
    body?.action !== "final_inspection"
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const sql = getSql();
  const jobRows = await sql`
    SELECT
      jc.*,
      e.inspection_id,
      l.branch_id AS lead_branch_id,
      COALESCE(wq.status, '') AS workshop_quote_status,
      COALESCE(wq.remarks, '') AS quote_remarks
    FROM job_cards jc
    LEFT JOIN estimates e ON e.id = jc.estimate_id
    LEFT JOIN leads l ON l.id = e.lead_id
    LEFT JOIN LATERAL (
      SELECT status, remarks
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND estimate_id = jc.estimate_id
        AND branch_id IS NOT DISTINCT FROM l.branch_id
      ORDER BY
        CASE
          WHEN status = 'verified' THEN 3
          WHEN status = 'accepted' THEN 2
          WHEN status = 'pending' THEN 1
          ELSE 0
        END DESC,
        verified_at DESC NULLS LAST,
        approved_at DESC NULLS LAST,
        updated_at DESC
      LIMIT 1
    ) wq ON TRUE
    WHERE jc.id = ${jobCardId}
    LIMIT 1
  `;
  if (!jobRows.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const jobCard = jobRows[0]!;
  const currentUserId = await getCurrentUserIdFromRequest(req);
  if (!currentUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const currentUserContext = await getUserContext(currentUserId);
  const currentUserBranchId = currentUserContext.companies[0]?.branchId ?? null;
  const assignedBranchId = jobCard?.lead_branch_id ?? null;
  const isBranchScopedUser = currentUserContext.scope === "branch";
  const isAssignedWorkshopUser =
    isBranchScopedUser && !!currentUserBranchId && !!assignedBranchId && currentUserBranchId === assignedBranchId;
  if (
    (body?.action === "start" ||
      body?.action === "complete" ||
      body?.action === "collect_car" ||
      body?.action === "pre_work_check" ||
      body?.action === "working_video" ||
      body?.action === "add_additional_item" ||
      body?.action === "final_inspection") &&
    isBranchScopedUser &&
    !isAssignedWorkshopUser
  ) {
    return NextResponse.json(
      { error: "Only assigned workshop can perform this action." },
      { status: 403 }
    );
  }
  if (body?.action === "verify" && (currentUserContext.scope === "branch" || currentUserContext.scope === "vendor")) {
    return NextResponse.json(
      { error: "Only company users can verify job cards." },
      { status: 403 }
    );
  }
  if (jobCard && jobCard.estimate_id) {
    const companyCheck = await sql`
      SELECT 1
      FROM estimates
      WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
      LIMIT 1
    `;
    if (!companyCheck.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (body?.action === "start") {
    const quoteStatus = String(jobCard?.workshop_quote_status ?? "").toLowerCase();
    if (quoteStatus !== "accepted" && quoteStatus !== "verified") {
      return NextResponse.json(
        { error: "Job card can be started only after quote is accepted." },
        { status: 400 }
      );
    }
    const collectCarDone = Boolean(jobCard?.collect_car_at);
    if (!collectCarDone) {
      return NextResponse.json(
        { error: "Collect Car stage is required before starting." },
        { status: 400 }
      );
    }
    if (!jobCard?.pre_work_checked_at) {
      return NextResponse.json(
        { error: "Pre-Work Check stage is required before starting." },
        { status: 400 }
      );
    }
    const receivedParts = await sql`
      WITH li AS (
        SELECT id, product_name, order_status
        FROM line_items
        WHERE job_card_id = ${jobCardId}
          AND company_id = ${companyId}
          AND NOT (
            COALESCE(is_add, 0) = 1
            AND LOWER(COALESCE(order_status, 'pending')) = 'pending'
          )
      ),
      quote_rank AS (
        SELECT
          source.line_item_id,
          MAX(
            CASE
              WHEN LOWER(COALESCE(source.status, '')) IN ('received', 'completed') THEN 3
              WHEN LOWER(COALESCE(source.status, '')) IN ('return', 'returned') THEN 2
              WHEN LOWER(COALESCE(source.status, '')) = 'ordered' THEN 1
              ELSE 0
            END
          ) AS status_rank
        FROM (
          SELECT li.id AS line_item_id, pq.status
          FROM li
          INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        ) source
        GROUP BY source.line_item_id
      )
      SELECT li.id, li.product_name, li.order_status, qr.status_rank
      FROM li
      LEFT JOIN quote_rank qr ON qr.line_item_id = li.id
      WHERE LOWER(
        COALESCE(
          CASE
            WHEN qr.status_rank >= 3 THEN 'received'
            WHEN qr.status_rank = 2 THEN 'returned'
            WHEN qr.status_rank = 1 THEN 'ordered'
            ELSE NULL
          END,
          li.order_status,
          'pending'
        )
      ) = 'received'
      LIMIT 1
    `;
    if (!receivedParts.length) {
      return NextResponse.json(
        { error: "At least one part must be received before starting the job card." },
        { status: 400 }
      );
    }
    const receivedPartsMissingPictures = await sql`
      WITH li AS (
        SELECT id, product_name, order_status, part_pic, scrap_pic
        FROM line_items
        WHERE job_card_id = ${jobCardId}
          AND company_id = ${companyId}
          AND NOT (
            COALESCE(is_add, 0) = 1
            AND LOWER(COALESCE(order_status, 'pending')) = 'pending'
          )
      ),
      quote_rank AS (
        SELECT
          source.line_item_id,
          MAX(
            CASE
              WHEN LOWER(COALESCE(source.status, '')) IN ('received', 'completed') THEN 3
              WHEN LOWER(COALESCE(source.status, '')) IN ('return', 'returned') THEN 2
              WHEN LOWER(COALESCE(source.status, '')) = 'ordered' THEN 1
              ELSE 0
            END
          ) AS status_rank
        FROM (
          SELECT li.id AS line_item_id, pq.status
          FROM li
          INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        ) source
        GROUP BY source.line_item_id
      ),
      status_view AS (
        SELECT
          li.id,
          li.product_name,
          li.part_pic,
          LOWER(
            COALESCE(
              CASE
                WHEN qr.status_rank >= 3 THEN 'received'
                WHEN qr.status_rank = 2 THEN 'returned'
                WHEN qr.status_rank = 1 THEN 'ordered'
                ELSE NULL
              END,
              li.order_status,
              'pending'
            )
          ) AS resolved_status
        FROM li
        LEFT JOIN quote_rank qr ON qr.line_item_id = li.id
      )
      SELECT id, product_name
      FROM status_view
      WHERE resolved_status = 'received'
        AND (part_pic IS NULL OR part_pic = '')
      LIMIT 1
    `;
    if (receivedPartsMissingPictures.length) {
      return NextResponse.json(
        {
          error:
            "Upload part pictures for all received parts before starting the job card.",
        },
        { status: 400 }
      );
    }

    const updated = await sql`
      UPDATE job_cards
      SET start_at = NOW()
      WHERE id = ${jobCardId} AND start_at IS NULL
      RETURNING *
    `;

    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  if (body?.action === "collect_car") {
    const sourceMedia = normalizeMediaMap(body?.collectCarSourceMedia ?? {});
    const hasSourceMedia = Object.keys(sourceMedia).length > 0;
    const carMediaReview = sanitizeCarMediaReview(body?.carMediaReview ?? {});
    const carMediaReplacement = sanitizeTextMap(body?.carMediaReplacement ?? {});
    if (hasSourceMedia) {
      const mediaKeys = ["front", "rear", "right", "left", "video"] as const;
      const pendingMedia = mediaKeys.find((key) => sourceMedia[key] && carMediaReview[key] === "pending");
      if (pendingMedia) {
        return NextResponse.json(
          { error: "Verify or reject all car images/videos before saving Collect Car." },
          { status: 400 }
        );
      }
      const missingReplacement = mediaKeys.find(
        (key) => sourceMedia[key] && carMediaReview[key] === "rejected" && !String(carMediaReplacement[key] ?? "").trim()
      );
      if (missingReplacement) {
        return NextResponse.json(
          { error: "Upload replacement media for every rejected car image/video." },
          { status: 400 }
        );
      }
    }
    const updated = await sql`
      UPDATE job_cards
      SET
        collect_car_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    if (jobCard?.inspection_id) {
      const inspectionRows = await sql`
        SELECT draft_payload
        FROM inspections
        WHERE company_id = ${companyId}
          AND id = ${jobCard.inspection_id}
        LIMIT 1
      `;
      const currentDraft =
        (inspectionRows[0]?.draft_payload && typeof inspectionRows[0].draft_payload === "object"
          ? inspectionRows[0].draft_payload
          : {}) as Record<string, unknown>;
      const nextDraft = {
        ...currentDraft,
        carMediaReview,
        carMediaReplacement,
        carMediaRejectNote: sanitizeTextMap(body?.carMediaRejectNote ?? {}),
      };
      await sql`
        UPDATE inspections
        SET draft_payload = ${nextDraft as any},
            updated_at = NOW()
        WHERE company_id = ${companyId}
          AND id = ${jobCard.inspection_id}
      `;
    }
    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  if (body?.action === "pre_work_check") {
    const collectCarDone = Boolean(jobCard?.collect_car_at);
    if (!collectCarDone) {
      return NextResponse.json(
        { error: "Complete Collect Car stage before Pre-Work Check." },
        { status: 400 }
      );
    }
    const collectCarMileage = Number(body?.collectCarMileage);
    if (!Number.isFinite(collectCarMileage) || collectCarMileage <= 0) {
      return NextResponse.json(
        { error: "Valid car mileage is required in Pre-Work Check." },
        { status: 400 }
      );
    }
    const carVinInput = String(body?.carVin ?? "").trim() || null;
    const carPlateInput = String(body?.carPlate ?? "").trim() || null;
    const carMakeInput = String(body?.carMake ?? "").trim() || null;
    const carModelInput = String(body?.carModel ?? "").trim() || null;
    const rawCarYear = String(body?.carYear ?? "").trim();
    const parsedCarYear = Number(rawCarYear);
    const carYearInput =
      rawCarYear && Number.isFinite(parsedCarYear) && parsedCarYear >= 1900 && parsedCarYear <= 3000
        ? Math.trunc(parsedCarYear)
        : null;
    const carVin = carVinInput ?? (String(jobCard?.vin ?? "").trim() || null);
    const carPlate = carPlateInput ?? (String(jobCard?.plate_number ?? "").trim() || null);
    const carMake = carMakeInput ?? (String(jobCard?.make ?? "").trim() || null);
    const carModel = carModelInput ?? (String(jobCard?.model ?? "").trim() || null);
    const carYear = carYearInput ?? (Number(jobCard?.model_year ?? 0) > 0 ? Number(jobCard?.model_year) : null);
    const missingFields: string[] = [];
    if (!carPlate) missingFields.push("car plate");
    if (!carMake) missingFields.push("car make");
    if (!carModel) missingFields.push("car model");
    if (!carYear) missingFields.push("car year");
    if (missingFields.length) {
      return NextResponse.json(
        { error: `Complete required vehicle fields before Pre-Work: ${missingFields.join(", ")}.` },
        { status: 400 }
      );
    }
    const preWorkNote = typeof body?.preWorkNote === "string" ? body.preWorkNote.trim() : null;
    const updated = await sql.begin(async (trx) => {
      const rows = await trx`
        UPDATE job_cards
        SET
          pre_work_checked_at = NOW(),
          pre_work_checked_by = ${currentUserId},
          collect_car_mileage = ${collectCarMileage},
          pre_work_note = ${preWorkNote}
        WHERE id = ${jobCardId}
        RETURNING *
      `;
      if (jobCard?.car_id) {
        await trx`
          UPDATE cars
          SET
            vin = COALESCE(${carVin}, vin),
            plate_number = COALESCE(${carPlate}, plate_number),
            make = COALESCE(${carMake}, make),
            model = COALESCE(${carModel}, model),
            model_year = COALESCE(${carYear}, model_year),
            updated_at = NOW()
          WHERE company_id = ${companyId}
            AND id = ${jobCard.car_id}
        `;
      }
      if (jobCard?.inspection_id) {
        const inspectionRows = await trx`
          SELECT draft_payload
          FROM inspections
          WHERE company_id = ${companyId}
            AND id = ${jobCard.inspection_id}
          LIMIT 1
        `;
        const currentDraft =
          (inspectionRows[0]?.draft_payload && typeof inspectionRows[0].draft_payload === "object"
            ? inspectionRows[0].draft_payload
            : {}) as Record<string, unknown>;
        const nextDraft = {
          ...currentDraft,
          inspectionVin: carVin ?? (currentDraft as any).inspectionVin ?? null,
          inspectionPlate: carPlate ?? (currentDraft as any).inspectionPlate ?? null,
          inspectionMake: carMake ?? (currentDraft as any).inspectionMake ?? null,
          inspectionModel: carModel ?? (currentDraft as any).inspectionModel ?? null,
          inspectionYear:
            carYear != null ? String(carYear) : ((currentDraft as any).inspectionYear ?? null),
          inspectionMileage: String(collectCarMileage),
        };
        await trx`
          UPDATE inspections
          SET draft_payload = ${nextDraft as any},
              updated_at = NOW()
          WHERE company_id = ${companyId}
            AND id = ${jobCard.inspection_id}
        `;
      }
      return rows;
    });
    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  if (body?.action === "working_video") {
    const workingVideoId = String(body?.workingVideoId ?? "").trim();
    if (!workingVideoId) {
      return NextResponse.json({ error: "Working video is required." }, { status: 400 });
    }
    const updated = await sql`
      UPDATE job_cards
      SET working_video_id = ${workingVideoId}
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  if (body?.action === "add_additional_item") {
    if (!jobCard?.estimate_id || !jobCard?.inspection_id) {
      return NextResponse.json(
        { error: "Estimate or inspection not found for this job card." },
        { status: 400 }
      );
    }
    const partName = String(body?.partName ?? body?.itemName ?? "").trim();
    const description = String(body?.description ?? "").trim() || null;
    const qtyRaw = Number(body?.quantity ?? 1);
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, Math.floor(qtyRaw)) : 1;
    const additionalItemModeRaw = String(body?.additionalItemMode ?? body?.addMode ?? "").trim().toLowerCase();
    const additionalItemMode =
      additionalItemModeRaw === "mandatory" || additionalItemModeRaw === "recommended"
        ? additionalItemModeRaw
        : "recommended";
    const additionalItemImageId = String(body?.additionalItemImageId ?? body?.imageId ?? "").trim();
    if (!partName) {
      return NextResponse.json({ error: "Part name is required." }, { status: 400 });
    }
    if (!additionalItemImageId) {
      return NextResponse.json({ error: "Additional item image is required." }, { status: 400 });
    }

    const created = await sql.begin(async (trx) => {
      const existingAdditionalJobCardRows = await trx`
        SELECT jc.id
        FROM job_cards jc
        WHERE jc.estimate_id = ${jobCard.estimate_id}
          AND jc.id <> ${jobCardId}
          AND jc.status IN ('Pending', 'Re-Assigned')
          AND EXISTS (
            SELECT 1
            FROM line_items li
            WHERE li.job_card_id = jc.id
              AND COALESCE(li.is_add, 0) = 1
          )
        ORDER BY jc.created_at DESC
        LIMIT 1
      `;
      let targetJobCardId = String(existingAdditionalJobCardRows[0]?.id ?? "");
      if (!targetJobCardId) {
        const createdJobCardRows = await trx`
          INSERT INTO job_cards (
            done_by,
            estimate_id,
            lead_id,
            status
          ) VALUES (
            ${currentUserId},
            ${jobCard.estimate_id},
            ${jobCard.lead_id ?? null},
            'Pending'
          )
          RETURNING id
        `;
        targetJobCardId = String(createdJobCardRows[0]?.id ?? "");
      }
      if (!targetJobCardId) {
        throw new Error("Failed to create additional job card.");
      }
      const createdLineItemRows = await trx`
        INSERT INTO line_items (
          company_id,
          lead_id,
          inspection_id,
          product_name,
          description,
          quantity,
          reason,
          status,
          source,
          is_add,
          order_status,
          job_card_id,
          additional_item_mode,
          additional_item_image_id,
          customer_approval_status
        ) VALUES (
          ${companyId},
          ${jobCard.lead_id ?? null},
          ${jobCard.inspection_id},
          ${partName},
          ${description},
          ${quantity},
          ${"Additional item from workshop"},
          ${"Pending"},
          ${"estimate"},
          ${1},
          ${"Pending"},
          ${targetJobCardId},
          ${additionalItemMode},
          ${additionalItemImageId},
          ${"pending"}
        )
        RETURNING *
      `;
      const createdLineItem = createdLineItemRows[0];
      if (!createdLineItem) {
        throw new Error("Failed to create additional line item.");
      }
      await trx`
        UPDATE estimates
        SET status = ${"pending_approval"}
        WHERE id = ${jobCard.estimate_id}
          AND company_id = ${companyId}
      `;
      await trx`
        UPDATE job_cards
        SET updated_at = NOW()
        WHERE id = ${targetJobCardId}
      `;
      return { createdLineItem, targetJobCardId };
    });

    return NextResponse.json({
      data: {
        ...created?.createdLineItem,
        po_status: created?.createdLineItem?.order_status ?? "Pending",
        order_status: created?.createdLineItem?.order_status ?? "Pending",
        customer_approval_status: created?.createdLineItem?.customer_approval_status ?? "pending",
        target_job_card_id: created?.targetJobCardId ?? null,
      },
    });
  }

  if (body?.action === "quote") {
    if (!jobCard?.estimate_id) {
      return NextResponse.json({ error: "Estimate not found for this job card." }, { status: 400 });
    }
    const quotedAmount = Number(body?.quotedAmount);
    if (!Number.isFinite(quotedAmount) || quotedAmount <= 0) {
      return NextResponse.json({ error: "Valid quotedAmount is required." }, { status: 400 });
    }
    const preset = String(body?.estimatedTimePreset ?? "").trim().toLowerCase();
    const presetLabelMap: Record<string, string> = {
      same_day: "Same Day",
      "1_day": "1 Day",
      "2_days": "2 Days",
      "3_days": "3 Days",
      "1_week": "1 Week",
      "2_weeks": "2 Weeks",
    };
    const etaLabel = presetLabelMap[preset];
    if (!etaLabel) {
      return NextResponse.json({ error: "Estimated time is required." }, { status: 400 });
    }
    let etaLine = `Estimated Time: ${etaLabel}`;
    if (preset === "same_day") {
      const hours = Number(body?.estimatedHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        return NextResponse.json({ error: "Estimated hours are required for Same Day." }, { status: 400 });
      }
      etaLine = `${etaLine} (${hours} hour${hours === 1 ? "" : "s"})`;
    }
    const existingRemarks = typeof jobCard?.remarks === "string" ? jobCard.remarks.trim() : "";
    const userRemarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
    const amountLine = `Quoted Amount: ${quotedAmount.toFixed(2)}`;
    const remarks = [existingRemarks, amountLine, etaLine, userRemarks].filter(Boolean).join("\n");
    const branchIdFromBody = typeof body?.branchId === "string" ? body.branchId : null;
    const branchLookup = await sql`
      SELECT branch_id
      FROM leads
      WHERE id = ${jobCard.lead_id}
      LIMIT 1
    `;
    const resolvedBranchId = branchIdFromBody ?? branchLookup[0]?.branch_id ?? null;
    const quoteCurrency = String(body?.currency ?? "AED").trim().toUpperCase() || "AED";
    const quoteMeta = {
      jobCardId,
      estimatedTimePreset: preset,
      estimatedHours: preset === "same_day" ? Number(body?.estimatedHours) : null,
      remarks: userRemarks || null,
    };
    const quoteMetaValue: any = quoteMeta;

    const existingQuoteRows = await sql`
      SELECT id, status
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND estimate_id = ${jobCard.estimate_id}
        AND branch_id IS NOT DISTINCT FROM ${resolvedBranchId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const existingQuote = existingQuoteRows[0];
    if (existingQuote) {
      const existingStatus = String(existingQuote.status ?? "").toLowerCase();
      if (existingStatus && existingStatus !== "rejected") {
        return NextResponse.json(
          { error: "Quote already submitted. You can resubmit only after rejection." },
          { status: 409 }
        );
      }
      await sql`
        UPDATE workshop_quotes
        SET status = 'pending',
            total_amount = ${quotedAmount},
            quoted_amount = ${quotedAmount},
            accepted_amount = NULL,
            currency = ${quoteCurrency},
            eta_preset = ${preset},
            eta_hours = ${preset === "same_day" ? Number(body?.estimatedHours) : null},
            remarks = ${remarks},
            meta = ${quoteMetaValue},
            updated_at = NOW()
        WHERE id = ${existingQuote.id}
      `;
    } else {
      await sql`
        INSERT INTO workshop_quotes (
          company_id,
          estimate_id,
          job_card_id,
          lead_id,
          branch_id,
          status,
          currency,
          total_amount,
          quoted_amount,
          accepted_amount,
          additional_amount,
          eta_preset,
          eta_hours,
          remarks,
          meta,
          created_by
        )
        VALUES (
          ${companyId},
          ${jobCard.estimate_id},
          ${jobCardId},
          ${jobCard.lead_id ?? null},
          ${resolvedBranchId},
          'pending',
          ${quoteCurrency},
          ${quotedAmount},
          ${quotedAmount},
          ${null},
          ${0},
          ${preset},
          ${preset === "same_day" ? Number(body?.estimatedHours) : null},
          ${remarks},
          ${quoteMetaValue},
          ${null}
        )
      `;
    }
    const touched = await sql`
      UPDATE job_cards
      SET updated_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: touched[0] ?? jobCard });
  }

  if (body?.action === "verify") {
    const isCompleted =
      Boolean(jobCard?.complete_at) || String(jobCard?.status ?? "").toLowerCase() === "completed";
    if (!isCompleted) {
      return NextResponse.json(
        { error: "Only completed job cards can be verified." },
        { status: 400 }
      );
    }

    const quoteRows = await sql`
      SELECT
        wq.id,
        wq.company_id,
        wq.estimate_id,
        wq.job_card_id,
        wq.lead_id,
        wq.branch_id,
        wq.status,
        wq.total_amount,
        wq.currency,
        wq.verified_at,
        b.ownership_type
      FROM workshop_quotes wq
      LEFT JOIN branches b ON b.id = wq.branch_id
      WHERE wq.company_id = ${companyId}
        AND (
          wq.job_card_id = ${jobCardId}
          OR (
            wq.job_card_id IS NULL
            AND wq.estimate_id IS NOT DISTINCT FROM ${jobCard.estimate_id ?? null}
            AND wq.branch_id IS NOT DISTINCT FROM ${jobCard.lead_branch_id ?? null}
          )
        )
        AND LOWER(COALESCE(wq.status, '')) IN ('accepted', 'verified')
      ORDER BY
        CASE WHEN LOWER(COALESCE(wq.status, '')) = 'verified' THEN 2 ELSE 1 END DESC,
        wq.verified_at DESC NULLS LAST,
        wq.approved_at DESC NULLS LAST,
        wq.updated_at DESC
      LIMIT 1
    `;
    if (!quoteRows.length) {
      return NextResponse.json(
        { error: "Accepted quote is required before verification." },
        { status: 400 }
      );
    }
    const quote = quoteRows[0];
    if (!quote) {
      return NextResponse.json(
        { error: "Accepted quote is required before verification." },
        { status: 400 }
      );
    }
    if (String(quote.status ?? "").toLowerCase() === "verified" || quote.verified_at) {
      return NextResponse.json(
        { error: "Job card already verified." },
        { status: 409 }
      );
    }
    if (!jobCard?.final_inspection_at) {
      return NextResponse.json(
        { error: "Final Inspection is required before verification." },
        { status: 400 }
      );
    }

    const settingsRows = await sql`
      SELECT vat_rate, currency
      FROM workshop_company_cost_settings
      WHERE company_id = ${companyId}
      LIMIT 1
    `;
    const amount = Number(quote.total_amount ?? 0);
    const vatRate = Number(settingsRows[0]?.vat_rate ?? 0);
    const currency = String(quote.currency ?? settingsRows[0]?.currency ?? "USD");
    const vatAmount = Number((amount * (vatRate / 100)).toFixed(2));
    const fineAmount = 0;
    const netAmount = Number((amount + vatAmount - fineAmount).toFixed(2));
    const verifyAt = new Date().toISOString();
    const isThirdParty = String(quote.ownership_type ?? "").toLowerCase() === "third_party";

    let earning: any = null;
    await sql.begin(async (trx) => {
      await trx`
        UPDATE workshop_quotes
        SET
          status = 'verified',
          job_card_id = COALESCE(job_card_id, ${jobCardId}),
          verified_by = ${currentUserId},
          verified_at = ${verifyAt},
          updated_at = NOW()
        WHERE id = ${quote.id}
          AND company_id = ${companyId}
      `;

      if (isThirdParty) {
        const earningRows = await trx`
          INSERT INTO workshops_earnings (
            company_id,
            workshop_quote_id,
            job_card_id,
            estimate_id,
            lead_id,
            branch_id,
            currency,
            amount,
            vat_rate,
            vat_amount,
            fine_amount,
            net_amount,
            verified_by,
            verified_at
          ) VALUES (
            ${companyId},
            ${quote.id},
            ${quote.job_card_id ?? jobCardId},
            ${quote.estimate_id ?? jobCard.estimate_id ?? null},
            ${quote.lead_id ?? jobCard.lead_id ?? null},
            ${quote.branch_id ?? null},
            ${currency},
            ${amount},
            ${vatRate},
            ${vatAmount},
            ${fineAmount},
            ${netAmount},
            ${currentUserId},
            ${verifyAt}
          )
          ON CONFLICT (workshop_quote_id)
          DO UPDATE SET
            currency = EXCLUDED.currency,
            amount = EXCLUDED.amount,
            vat_rate = EXCLUDED.vat_rate,
            vat_amount = EXCLUDED.vat_amount,
            fine_amount = EXCLUDED.fine_amount,
            net_amount = EXCLUDED.net_amount,
            verified_by = EXCLUDED.verified_by,
            verified_at = EXCLUDED.verified_at,
            updated_at = NOW()
          RETURNING *
        `;
        earning = earningRows[0] ?? null;
      }
    });

    return NextResponse.json({
      data: {
        verified: true,
        quoteId: quote.id,
        verifiedAt: verifyAt,
        earning,
      },
    });
  }

  if (body?.action === "final_inspection") {
    const isCompleted =
      Boolean(jobCard?.complete_at) || String(jobCard?.status ?? "").toLowerCase() === "completed";
    if (!isCompleted) {
      return NextResponse.json(
        { error: "Final Inspection can be completed only after job completion." },
        { status: 400 }
      );
    }
    const checks = {
      testDrive: Boolean(body?.checks?.testDrive),
      clusterWarning: Boolean(body?.checks?.clusterWarning),
      carWash: Boolean(body?.checks?.carWash),
      tyreCheck: Boolean(body?.checks?.tyreCheck),
      computerReset: Boolean(body?.checks?.computerReset),
      protectiveShields: Boolean(body?.checks?.protectiveShields),
    };
    const finalInspectionRemarks =
      typeof body?.finalInspectionRemarks === "string" ? body.finalInspectionRemarks.trim() : "";
    const finalInspectionCarOutVideoId = String(body?.carOutVideoId ?? body?.finalInspectionCarOutVideoId ?? "").trim();
    if (!checks.testDrive || !checks.clusterWarning || !checks.carWash || !checks.tyreCheck || !checks.computerReset || !checks.protectiveShields) {
      return NextResponse.json(
        { error: "All final inspection checklist items must be verified." },
        { status: 400 }
      );
    }
    if (!finalInspectionCarOutVideoId) {
      return NextResponse.json({ error: "Car out video is required." }, { status: 400 });
    }
    const updated = await sql`
      UPDATE job_cards
      SET
        final_inspection_test_drive = ${checks.testDrive},
        final_inspection_cluster_warning = ${checks.clusterWarning},
        final_inspection_car_wash = ${checks.carWash},
        final_inspection_tyre_check = ${checks.tyreCheck},
        final_inspection_computer_reset = ${checks.computerReset},
        final_inspection_protective_shields = ${checks.protectiveShields},
        final_inspection_remarks = ${finalInspectionRemarks || null},
        final_inspection_car_out_video_id = ${finalInspectionCarOutVideoId},
        final_inspection_by = ${currentUserId},
        final_inspection_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
  if (!remarks) {
    return NextResponse.json({ error: "Remarks are required before completing." }, { status: 400 });
  }
  const quoteStatus = String(jobCard?.workshop_quote_status ?? "").toLowerCase();
  if (quoteStatus !== "accepted") {
    return NextResponse.json(
      { error: "Job card can be completed only after quote is accepted." },
      { status: 400 }
    );
  }

  const workingVideoId = String(jobCard?.working_video_id ?? "").trim();
  if (!workingVideoId) {
    return NextResponse.json(
      { error: "Working video is required before completing the job." },
      { status: 400 }
    );
  }

  const updated = await sql`
    UPDATE job_cards
    SET complete_at = NOW(),
        status = 'Completed',
        remarks = ${remarks}
    WHERE id = ${jobCardId} AND complete_at IS NULL
    RETURNING *
  `;

  return NextResponse.json({ data: updated[0] ?? jobCard });
}
