import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getUserContext } from "@/lib/auth/user-context";
import { normalizeMediaMap, resolveCollectCarSource } from "@/lib/collect-car-source";

type Params = { params: Promise<{ companyId: string; jobCardId: string }> };

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
    const procurementRows = await sql`
      SELECT DISTINCT ON (li.id)
        li.id AS line_item_id,
        poi.purchase_order_id AS po_id,
        poi.id AS po_item_id,
        poi.quantity AS po_qty,
        poi.received_qty AS po_received_qty,
        poi.status AS po_item_status,
        po.status AS po_status,
        COALESCE((
          SELECT im.grn_number
          FROM inventory_movements im
          WHERE im.purchase_order_id = poi.purchase_order_id
            AND im.source_type = 'receipt'
            AND im.grn_number IS NOT NULL
          ORDER BY im.created_at DESC
          LIMIT 1
        ), NULL) AS latest_grn_number,
        EXISTS (
          SELECT 1
          FROM accounting_journals aj
          WHERE aj.company_id = ${companyId}
            AND aj.journal_no LIKE ('GRN-' || poi.purchase_order_id::text || '-' || poi.id::text || '-%')
        ) AS accounting_posted
      FROM line_items li
      LEFT JOIN part_quotes pq
        ON pq.company_id = ${companyId}
       AND pq.line_item_id = li.id
      LEFT JOIN purchase_order_items poi
        ON (
          poi.estimate_item_id = li.id
          OR
          poi.quote_id = pq.id
          OR (
            poi.estimate_item_id IS NOT NULL
            AND pq.estimate_item_id IS NOT NULL
            AND poi.estimate_item_id = pq.estimate_item_id
          )
        )
      LEFT JOIN purchase_orders po ON po.id = poi.purchase_order_id
      WHERE li.id = ANY(${lineItemIds})
      ORDER BY
        li.id,
        CASE
          WHEN LOWER(COALESCE(po.status, '')) = 'issued' THEN 0
          WHEN LOWER(COALESCE(po.status, '')) = 'partially_received' THEN 1
          WHEN LOWER(COALESCE(po.status, '')) = 'received' THEN 2
          ELSE 3
        END,
        po.updated_at DESC
    `;
    const procurementByLineItemId = new Map(
      procurementRows.map((row: any) => [
        String(row.line_item_id),
        {
          procurement_linked: Boolean(row.po_item_id),
          procurement_po_id: row.po_id ?? null,
          procurement_po_item_id: row.po_item_id ?? null,
          procurement_po_status: row.po_status ?? null,
          procurement_po_item_status: row.po_item_status ?? null,
          procurement_po_qty: row.po_qty != null ? Number(row.po_qty) : null,
          procurement_po_received_qty: row.po_received_qty != null ? Number(row.po_received_qty) : null,
          procurement_latest_grn_number: row.latest_grn_number ?? null,
          procurement_inventory_moved:
            row.po_qty != null && row.po_received_qty != null ? Number(row.po_received_qty) >= Number(row.po_qty) : false,
          procurement_accounting_posted: Boolean(row.accounting_posted),
        },
      ])
    );
    mergedItems = items.map((row: any) => {
      const derived = derivedStatusByLineItemId.get(String(row.id));
      const deliveryMeta = deliveryNoteByLineItemId.get(String(row.id));
      const procurementMeta = procurementByLineItemId.get(String(row.id));
      if (!derived && !deliveryMeta && !procurementMeta) return row;
      const poItemStatus = String(procurementMeta?.procurement_po_item_status ?? "").trim().toLowerCase();
      const poStatus = String(procurementMeta?.procurement_po_status ?? "").trim().toLowerCase();
      const poQty = Number(procurementMeta?.procurement_po_qty ?? 0) || 0;
      const poReceivedQty = Number(procurementMeta?.procurement_po_received_qty ?? 0) || 0;
      const procurementResolvedStatus =
        poItemStatus === "received" || poStatus === "received"
          ? "Received"
          : poItemStatus === "return" || poItemStatus === "returned"
          ? "Returned"
          : poItemStatus === "partial" ||
            poStatus === "partially_received" ||
            (poQty > 0 && poReceivedQty > 0 && poReceivedQty < poQty)
          ? "Partially Received"
          : poQty > 0 && poReceivedQty >= poQty
          ? "Received"
          : "";
      const resolvedStatus =
        derived ||
        procurementResolvedStatus ||
        String(row.po_status ?? row.order_status ?? "").trim() ||
        "Ordered";
      return {
        ...row,
        po_status: resolvedStatus,
        order_status:
          resolvedStatus === "Partially Received"
            ? "Ordered"
            : resolvedStatus,
        delivery_note_no: deliveryMeta?.delivery_note_no ?? row.delivery_note_no ?? null,
        delivery_note_status: deliveryMeta?.delivery_note_status ?? row.delivery_note_status ?? null,
        procurement_linked: procurementMeta?.procurement_linked ?? false,
        procurement_po_id: procurementMeta?.procurement_po_id ?? null,
        procurement_po_item_id: procurementMeta?.procurement_po_item_id ?? null,
        procurement_po_status: procurementMeta?.procurement_po_status ?? null,
        procurement_po_item_status: procurementMeta?.procurement_po_item_status ?? null,
        procurement_po_qty: procurementMeta?.procurement_po_qty ?? null,
        procurement_po_received_qty: procurementMeta?.procurement_po_received_qty ?? null,
        procurement_latest_grn_number: procurementMeta?.procurement_latest_grn_number ?? null,
        procurement_inventory_moved: procurementMeta?.procurement_inventory_moved ?? false,
        procurement_accounting_posted: procurementMeta?.procurement_accounting_posted ?? false,
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
    body?.action !== "completion_evidence" &&
    body?.action !== "add_additional_item" &&
    body?.action !== "final_inspection" &&
    body?.action !== "car_wash"
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
      body?.action === "completion_evidence" ||
      body?.action === "add_additional_item" ||
      body?.action === "final_inspection" ||
      body?.action === "car_wash") &&
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
          AND (
            LOWER(COALESCE(customer_approval_status, '')) = 'approved'
            OR LOWER(COALESCE(status, '')) = 'approved'
          )
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
          AND (
            LOWER(COALESCE(customer_approval_status, '')) = 'approved'
            OR LOWER(COALESCE(status, '')) = 'approved'
          )
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

  if (body?.action === "completion_evidence") {
    if (!jobCard?.inspection_id) {
      return NextResponse.json({ error: "Inspection is not linked to this job card." }, { status: 400 });
    }
    const engineImageId = String(body?.engineImageId ?? "").trim() || null;
    const bottomImageId = String(body?.bottomImageId ?? "").trim() || null;
    const inspectionRows = await sql`
      SELECT draft_payload
      FROM inspections
      WHERE company_id = ${companyId}
        AND id = ${jobCard.inspection_id}
      LIMIT 1
    `;
    if (!inspectionRows.length) {
      return NextResponse.json({ error: "Inspection not found." }, { status: 404 });
    }
    const currentDraft =
      (inspectionRows[0]?.draft_payload && typeof inspectionRows[0].draft_payload === "object"
        ? inspectionRows[0].draft_payload
        : {}) as Record<string, unknown>;
    const nextDraft = {
      ...currentDraft,
      jobCardEngineImageId: engineImageId ?? (currentDraft as any).jobCardEngineImageId ?? null,
      jobCardBottomImageId: bottomImageId ?? (currentDraft as any).jobCardBottomImageId ?? null,
    };
    await sql`
      UPDATE inspections
      SET draft_payload = ${nextDraft as any},
          updated_at = NOW()
      WHERE company_id = ${companyId}
        AND id = ${jobCard.inspection_id}
    `;
    return NextResponse.json({
      data: {
        engineImageId: nextDraft.jobCardEngineImageId ?? null,
        bottomImageId: nextDraft.jobCardBottomImageId ?? null,
      },
    });
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
      tyreCheck: Boolean(body?.checks?.tyreCheck),
      computerReset: Boolean(body?.checks?.computerReset),
      protectiveShields: Boolean(body?.checks?.protectiveShields),
    };
    const finalInspectionRemarks =
      typeof body?.finalInspectionRemarks === "string" ? body.finalInspectionRemarks.trim() : "";
    const finalPhotosRaw =
      body?.finalInspectionCarPhotos && typeof body.finalInspectionCarPhotos === "object"
        ? (body.finalInspectionCarPhotos as Record<string, unknown>)
        : {};
    const finalInspectionCarPhotos = {
      front: String(finalPhotosRaw.front ?? "").trim(),
      rear: String(finalPhotosRaw.rear ?? "").trim(),
      right: String(finalPhotosRaw.right ?? "").trim(),
      left: String(finalPhotosRaw.left ?? "").trim(),
    };
    const reworkRequired = Boolean(body?.reworkRequired);
    const reworkNote = String(body?.reworkNote ?? "").trim();
    const reworkLineItemIds = Array.isArray(body?.reworkLineItemIds)
      ? body.reworkLineItemIds.map((id: unknown) => String(id ?? "").trim()).filter(Boolean)
      : [];
    const rawPartStatuses =
      body?.finalInspectionPartStatuses && typeof body.finalInspectionPartStatuses === "object"
        ? (body.finalInspectionPartStatuses as Record<string, unknown>)
        : {};
    const finalInspectionPartStatuses: Record<string, "verified" | "rework"> = {};
    Object.entries(rawPartStatuses).forEach(([itemId, value]) => {
      const normalized = String(value ?? "").toLowerCase();
      if (normalized === "verified" || normalized === "rework") {
        finalInspectionPartStatuses[String(itemId)] = normalized;
      }
    });

    if (!checks.testDrive || !checks.clusterWarning || !checks.tyreCheck || !checks.computerReset || !checks.protectiveShields) {
      return NextResponse.json(
        { error: "All final inspection checklist items must be verified." },
        { status: 400 }
      );
    }

    if (
      !finalInspectionCarPhotos.front ||
      !finalInspectionCarPhotos.rear ||
      !finalInspectionCarPhotos.right ||
      !finalInspectionCarPhotos.left
    ) {
      return NextResponse.json(
        { error: "Front, rear, right, and left final car photos are required." },
        { status: 400 }
      );
    }

    const approvedPartsPendingRows = await sql`
      SELECT
        li.id,
        li.product_name,
        LOWER(COALESCE(li.order_status, 'pending')) AS order_status,
        COALESCE(li.part_pic, '') AS part_pic,
        COALESCE(li.scrap_pic, '') AS scrap_pic
      FROM line_items li
      WHERE li.job_card_id = ${jobCardId}
        AND li.company_id = ${companyId}
        AND (
          LOWER(COALESCE(li.customer_approval_status, '')) = 'approved'
          OR LOWER(COALESCE(li.status, '')) = 'approved'
        )
        AND NOT (
          COALESCE(li.is_add, 0) = 1
          AND LOWER(COALESCE(li.order_status, 'pending')) = 'pending'
        )
    `;
    const finalizedPartIssues = approvedPartsPendingRows.filter((row: any) => {
      const status = String(row?.order_status ?? "").toLowerCase();
      const partPic = String(row?.part_pic ?? "").trim();
      const scrapPic = String(row?.scrap_pic ?? "").trim();
      return status !== "received" || !partPic || !scrapPic;
    });
    if (finalizedPartIssues.length) {
      const summary = finalizedPartIssues
        .slice(0, 6)
        .map((row: any) => String(row?.product_name ?? "Part").trim() || "Part")
        .join(", ");
      return NextResponse.json(
        { error: `Finalize all approved parts before final inspection: ${summary}.` },
        { status: 400 }
      );
    }

    const requiredPartIds = approvedPartsPendingRows.map((row: any) => String(row?.id ?? "")).filter(Boolean);
    const missingDecisionIds = requiredPartIds.filter((id) => {
      const status = finalInspectionPartStatuses[id];
      return status !== "verified" && status !== "rework";
    });
    if (missingDecisionIds.length) {
      return NextResponse.json(
        { error: "Select Verify/Re-Work status for all approved parts before saving final inspection." },
        { status: 400 }
      );
    }
    const reworkIdsFromPartStatus = requiredPartIds.filter(
      (id) => finalInspectionPartStatuses[id] === "rework"
    );
    const effectiveReworkLineItemIds = reworkIdsFromPartStatus.length
      ? reworkIdsFromPartStatus
      : reworkLineItemIds;
    const effectiveReworkRequired = effectiveReworkLineItemIds.length > 0 || reworkRequired;

    if (effectiveReworkRequired && !effectiveReworkLineItemIds.length) {
      return NextResponse.json(
        { error: "Select at least one part for rework before reopening." },
        { status: 400 }
      );
    }
    if (effectiveReworkRequired && !reworkNote) {
      return NextResponse.json(
        { error: "Add rework note before reopening the job card." },
        { status: 400 }
      );
    }

    const inspectionRows = jobCard?.inspection_id
      ? await sql`
          SELECT draft_payload
          FROM inspections
          WHERE company_id = ${companyId}
            AND id = ${jobCard.inspection_id}
          LIMIT 1
        `
      : [];
    const currentDraft =
      (inspectionRows[0]?.draft_payload && typeof inspectionRows[0].draft_payload === "object"
        ? inspectionRows[0].draft_payload
        : {}) as Record<string, unknown>;
    const nextDraft = {
      ...currentDraft,
      jobCardFinalInspectionCarPhotos: finalInspectionCarPhotos,
      jobCardFinalInspectionRemarks: finalInspectionRemarks || null,
      jobCardFinalInspectionPartStatuses: finalInspectionPartStatuses,
      jobCardFinalInspectionRework: effectiveReworkRequired
        ? {
            at: new Date().toISOString(),
            lineItemIds: effectiveReworkLineItemIds,
            note: reworkNote,
          }
        : null,
    };
    if (jobCard?.inspection_id) {
      await sql`
        UPDATE inspections
        SET draft_payload = ${nextDraft as any},
            updated_at = NOW()
        WHERE company_id = ${companyId}
          AND id = ${jobCard.inspection_id}
      `;
    }

    if (effectiveReworkRequired) {
      const updated = await sql`
        UPDATE job_cards
        SET
          status = 'Pending',
          complete_at = NULL,
          final_inspection_at = NULL,
          final_inspection_by = NULL,
          final_inspection_remarks = ${reworkNote},
          updated_at = NOW()
        WHERE id = ${jobCardId}
        RETURNING *
      `;
      return NextResponse.json({ data: { ...(updated[0] ?? jobCard), reopened_for_rework: true } });
    }

    const updated = await sql`
      UPDATE job_cards
      SET
        final_inspection_test_drive = ${checks.testDrive},
        final_inspection_cluster_warning = ${checks.clusterWarning},
        final_inspection_car_wash = FALSE,
        final_inspection_tyre_check = ${checks.tyreCheck},
        final_inspection_computer_reset = ${checks.computerReset},
        final_inspection_protective_shields = ${checks.protectiveShields},
        final_inspection_remarks = ${finalInspectionRemarks || null},
        final_inspection_car_out_video_id = NULL,
        final_inspection_by = ${currentUserId},
        final_inspection_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: { ...(updated[0] ?? jobCard), reopened_for_rework: false } });
  }

  if (body?.action === "car_wash") {
    const isCompleted =
      Boolean(jobCard?.complete_at) || String(jobCard?.status ?? "").toLowerCase() === "completed";
    if (!isCompleted) {
      return NextResponse.json(
        { error: "Complete job card before car wash stage." },
        { status: 400 }
      );
    }
    if (!jobCard?.final_inspection_at) {
      return NextResponse.json(
        { error: "Final inspection is required before car wash stage." },
        { status: 400 }
      );
    }
    if (!jobCard?.inspection_id) {
      return NextResponse.json(
        { error: "Inspection is not linked to this job card." },
        { status: 400 }
      );
    }
    const mediaRaw =
      body?.carWashMedia && typeof body.carWashMedia === "object"
        ? (body.carWashMedia as Record<string, unknown>)
        : {};
    const carWashMedia = {
      front: String(mediaRaw.front ?? "").trim(),
      rear: String(mediaRaw.rear ?? "").trim(),
      right: String(mediaRaw.right ?? "").trim(),
      left: String(mediaRaw.left ?? "").trim(),
      video: String(mediaRaw.video ?? "").trim(),
    };
    if (
      !carWashMedia.front ||
      !carWashMedia.rear ||
      !carWashMedia.right ||
      !carWashMedia.left ||
      !carWashMedia.video
    ) {
      return NextResponse.json(
        { error: "Car wash images (front/rear/right/left) and video are required." },
        { status: 400 }
      );
    }
    const carWashNotes = String(body?.carWashNotes ?? "").trim();
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
      jobCardCarWashMedia: carWashMedia,
      jobCardCarWashNotes: carWashNotes || null,
    };
    await sql`
      UPDATE inspections
      SET draft_payload = ${nextDraft as any},
          updated_at = NOW()
      WHERE company_id = ${companyId}
        AND id = ${jobCard.inspection_id}
    `;
    const updated = await sql`
      UPDATE job_cards
      SET
        final_inspection_car_wash = TRUE,
        updated_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({
      data: {
        ...(updated[0] ?? jobCard),
        car_wash_done: true,
      },
    });
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

  const completionEvidenceRows = jobCard?.inspection_id
    ? await sql`
        SELECT draft_payload
        FROM inspections
        WHERE company_id = ${companyId}
          AND id = ${jobCard.inspection_id}
        LIMIT 1
      `
    : [];
  const completionDraft =
    (completionEvidenceRows[0]?.draft_payload && typeof completionEvidenceRows[0].draft_payload === "object"
      ? completionEvidenceRows[0].draft_payload
      : {}) as Record<string, unknown>;
  const engineImageId = String((completionDraft as any).jobCardEngineImageId ?? "").trim();
  const bottomImageId = String((completionDraft as any).jobCardBottomImageId ?? "").trim();
  if (!engineImageId || !bottomImageId) {
    return NextResponse.json(
      { error: "Engine image and bottom image are required before completing the job." },
      { status: 400 }
    );
  }

  const missingScrapRows = await sql`
    SELECT id, product_name
    FROM line_items
    WHERE job_card_id = ${jobCardId}
      AND company_id = ${companyId}
      AND (
        LOWER(COALESCE(customer_approval_status, '')) = 'approved'
        OR LOWER(COALESCE(status, '')) = 'approved'
      )
      AND NOT (
        COALESCE(is_add, 0) = 1
        AND LOWER(COALESCE(order_status, 'pending')) = 'pending'
      )
      AND (scrap_pic IS NULL OR scrap_pic = '')
    ORDER BY product_name ASC
    LIMIT 10
  `;
  if (missingScrapRows.length) {
    const summary = missingScrapRows
      .map((row: any) => String(row?.product_name ?? "Part").trim() || "Part")
      .join(", ");
    return NextResponse.json(
      { error: `Upload scrap pictures for all parts before completion: ${summary}.` },
      { status: 400 }
    );
  }

  const incompleteReceiptRows = await sql`
    WITH required_items AS (
      SELECT li.id, li.product_name
      FROM line_items li
      WHERE li.job_card_id = ${jobCardId}
        AND li.company_id = ${companyId}
        AND (
          LOWER(COALESCE(li.customer_approval_status, '')) = 'approved'
          OR LOWER(COALESCE(li.status, '')) = 'approved'
        )
        AND NOT (
          COALESCE(li.is_add, 0) = 1
          AND LOWER(COALESCE(li.order_status, 'pending')) = 'pending'
        )
    ),
    selected_po_item AS (
      SELECT DISTINCT ON (ri.id)
        ri.id AS line_item_id,
        ri.product_name,
        poi.id AS po_item_id,
        COALESCE(poi.quantity, 0)::numeric AS ordered_qty,
        COALESCE(poi.received_qty, 0)::numeric AS received_qty,
        LOWER(COALESCE(po.status, '')) AS po_status
      FROM required_items ri
      LEFT JOIN purchase_order_items poi
        ON poi.estimate_item_id::text = ri.id::text
      LEFT JOIN purchase_orders po
        ON po.id = poi.purchase_order_id
      ORDER BY
        ri.id,
        CASE
          WHEN LOWER(COALESCE(po.status, '')) = 'issued' THEN 0
          WHEN LOWER(COALESCE(po.status, '')) = 'partially_received' THEN 1
          WHEN LOWER(COALESCE(po.status, '')) = 'received' THEN 2
          ELSE 3
        END,
        po.updated_at DESC NULLS LAST,
        poi.updated_at DESC NULLS LAST
    ),
    receipt_rollup AS (
      SELECT
        line_item_id,
        MAX(product_name) AS product_name,
        COUNT(po_item_id) FILTER (WHERE po_item_id IS NOT NULL) AS po_item_count,
        COALESCE(SUM(ordered_qty), 0)::numeric AS ordered_qty,
        COALESCE(SUM(received_qty), 0)::numeric AS received_qty
      FROM selected_po_item
      GROUP BY line_item_id
    )
    SELECT
      line_item_id,
      product_name,
      po_item_count,
      ordered_qty,
      received_qty,
      GREATEST(ordered_qty - received_qty, 0)::numeric AS remaining_qty
    FROM receipt_rollup
    WHERE po_item_count = 0
       OR ordered_qty <= 0
       OR received_qty < ordered_qty
    ORDER BY product_name ASC
    LIMIT 10
  `;
  if (incompleteReceiptRows.length) {
    const summary = incompleteReceiptRows
      .map((row: any) => {
        const name = String(row?.product_name ?? "Part").trim() || "Part";
        const remaining = Number(row?.remaining_qty ?? 0);
        if (remaining > 0) return `${name} (${remaining} remaining)`;
        if (Number(row?.po_item_count ?? 0) <= 0) return `${name} (not linked to PO)`;
        return `${name} (receipt pending)`;
      })
      .join(", ");
    return NextResponse.json(
      {
        error: `Cannot complete job. All required parts must be fully received first: ${summary}.`,
      },
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
