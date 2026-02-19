import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getUserContext } from "@/lib/auth/user-context";

type Params = { params: Promise<{ companyId: string; jobCardId: string }> };

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
           jc.pre_work_checked_at,
           jc.pre_work_checked_by,
           jc.pre_work_note,
           jc.estimate_id,
           jc.lead_id,
           jc.status,
           jc.remarks,
           jc.created_at,
           jc.updated_at,
           e.inspection_id,
           e.lead_id AS estimate_lead_id,
           i.customer_id,
           i.car_id,
           COALESCE(i.customer_remark, i.draft_payload->>'customerComplain') AS customer_remark,
           COALESCE(i.inspector_remark, i.draft_payload->>'inspectorRemarks') AS inspector_remark,
           c.code AS customer_code,
           c.name AS customer_name,
           c.phone AS customer_phone,
           c.customer_type,
           car.plate_number,
           car.make,
           car.model,
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

  const jobCard = jobRows[0];
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

  const items = await sql`
    SELECT *
    FROM line_items
    WHERE job_card_id = ${jobCardId}
    ORDER BY created_at ASC
  `;
  let mergedItems: any[] = [...items];
  const lineItemIds = items.map((row: any) => row.id).filter(Boolean);
  if (lineItemIds.length) {
    const quoteStatusRows = await sql`
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
        SELECT
          li.id AS line_item_id,
          pq.status
        FROM line_items li
        INNER JOIN part_quotes pq ON pq.line_item_id = li.id
        WHERE li.id = ANY(${lineItemIds})
      ) source
      GROUP BY source.line_item_id
    `;
    const derivedStatusByLineItemId = new Map(
      quoteStatusRows.map((row: any) => {
        const rank = Number(row.status_rank ?? 0);
        const derived =
          rank >= 3 ? "Received" : rank === 2 ? "Returned" : rank === 1 ? "Ordered" : "";
        return [String(row.line_item_id), derived] as const;
      })
    );
    mergedItems = items.map((row: any) => {
      const derived = derivedStatusByLineItemId.get(String(row.id));
      if (!derived) return row;
      return {
        ...row,
        po_status: derived,
        order_status: derived,
      };
    });
  }

  return NextResponse.json({ data: { jobCard, items: mergedItems } });
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
    body?.action !== "pre_work_check"
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
  const jobCard = jobRows[0];
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
      body?.action === "pre_work_check") &&
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
    if (quoteStatus !== "accepted") {
      return NextResponse.json(
        { error: "Job card can be started only after quote is accepted." },
        { status: 400 }
      );
    }
    const collectCarVideoId = String(jobCard?.collect_car_video_id ?? "").trim();
    const collectCarMileage = Number(jobCard?.collect_car_mileage ?? 0);
    const collectCarMileageImageId = String(jobCard?.collect_car_mileage_image_id ?? "").trim();
    const collectCarDone =
      collectCarVideoId.length > 0 &&
      Number.isFinite(collectCarMileage) &&
      collectCarMileage > 0 &&
      collectCarMileageImageId.length > 0;
    if (!collectCarDone) {
      return NextResponse.json(
        {
          error:
            "Collect Car stage is required before starting (video, mileage and mileage image).",
        },
        { status: 400 }
      );
    }
    if (!jobCard?.pre_work_checked_at) {
      return NextResponse.json(
        { error: "Pre-Work Check stage is required before starting." },
        { status: 400 }
      );
    }
    const unreceivedParts = await sql`
      WITH li AS (
        SELECT id, product_name, order_status
        FROM line_items
        WHERE job_card_id = ${jobCardId}
          AND company_id = ${companyId}
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
      ) <> 'received'
      LIMIT 1
    `;
    if (unreceivedParts.length) {
      return NextResponse.json(
        { error: "All parts must be received before starting the job card." },
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
    const collectCarVideoId = String(body?.collectCarVideoId ?? "").trim();
    const collectCarMileage = Number(body?.collectCarMileage);
    const collectCarMileageImageId = String(body?.collectCarMileageImageId ?? "").trim();
    if (!collectCarVideoId) {
      return NextResponse.json({ error: "Collect car video is required." }, { status: 400 });
    }
    if (!Number.isFinite(collectCarMileage) || collectCarMileage <= 0) {
      return NextResponse.json({ error: "Valid car mileage is required." }, { status: 400 });
    }
    if (!collectCarMileageImageId) {
      return NextResponse.json({ error: "Car mileage image is required." }, { status: 400 });
    }
    const updated = await sql`
      UPDATE job_cards
      SET
        collect_car_video_id = ${collectCarVideoId},
        collect_car_mileage = ${collectCarMileage},
        collect_car_mileage_image_id = ${collectCarMileageImageId},
        collect_car_at = NOW()
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: updated[0] ?? jobCard });
  }

  if (body?.action === "pre_work_check") {
    const collectCarVideoId = String(jobCard?.collect_car_video_id ?? "").trim();
    const collectCarMileage = Number(jobCard?.collect_car_mileage ?? 0);
    const collectCarMileageImageId = String(jobCard?.collect_car_mileage_image_id ?? "").trim();
    const collectCarDone =
      collectCarVideoId.length > 0 &&
      Number.isFinite(collectCarMileage) &&
      collectCarMileage > 0 &&
      collectCarMileageImageId.length > 0;
    if (!collectCarDone) {
      return NextResponse.json(
        { error: "Complete Collect Car stage before Pre-Work Check." },
        { status: 400 }
      );
    }
    const unreceivedParts = await sql`
      WITH li AS (
        SELECT id, product_name, order_status
        FROM line_items
        WHERE job_card_id = ${jobCardId}
          AND company_id = ${companyId}
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
      SELECT li.id
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
      ) <> 'received'
      LIMIT 1
    `;
    if (unreceivedParts.length) {
      return NextResponse.json(
        { error: "All parts must be received before Pre-Work Check." },
        { status: 400 }
      );
    }
    const preWorkNote = typeof body?.preWorkNote === "string" ? body.preWorkNote.trim() : null;
    const updated = await sql`
      UPDATE job_cards
      SET
        pre_work_checked_at = NOW(),
        pre_work_checked_by = ${currentUserId},
        pre_work_note = ${preWorkNote}
      WHERE id = ${jobCardId}
      RETURNING *
    `;
    return NextResponse.json({ data: updated[0] ?? jobCard });
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

    const existingQuoteRows = await sql`
      SELECT id, status
      FROM workshop_quotes
      WHERE company_id = ${companyId}
        AND estimate_id = ${jobCard.estimate_id}
        AND branch_id IS NOT DISTINCT FROM ${resolvedBranchId}
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (existingQuoteRows.length) {
      const existingStatus = String(existingQuoteRows[0].status ?? "").toLowerCase();
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
            meta = ${quoteMeta},
            updated_at = NOW()
        WHERE id = ${existingQuoteRows[0].id}
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
          ${quoteMeta},
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
    if (String(quote.status ?? "").toLowerCase() === "verified" || quote.verified_at) {
      return NextResponse.json(
        { error: "Job card already verified." },
        { status: 409 }
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

  const missingEvidence = await sql`
    SELECT li.id, li.product_name
    FROM line_items li
    LEFT JOIN products p ON p.id = li.product_id
    LEFT JOIN products p2 ON LOWER(p2.name) = LOWER(li.product_name)
    WHERE li.job_card_id = ${jobCardId}
      AND (li.scrap_pic IS NULL OR li.part_pic IS NULL)
      AND (
        POSITION('spare' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
        AND POSITION('part' IN LOWER(COALESCE(p.type, p2.type, ''))) > 0
      )
  `;

  if (missingEvidence.length) {
    return NextResponse.json(
      { error: "Part and scrap pictures are required before completing." },
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
