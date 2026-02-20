import { NextRequest } from "next/server";
import { getSql } from "@repo/ai-core/db";
import { getUserContext } from "@/lib/auth/user-context";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string; jobCardId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, jobCardId } = await params;
    await ensureCompanyAccess(userId, companyId);
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

    if (!jobRows.length) return createMobileErrorResponse("Not found", 404);
    const jobCard = jobRows[0];

    if (jobCard?.estimate_id) {
      const companyCheck = await sql`
        SELECT 1
        FROM estimates
        WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
        LIMIT 1
      `;
      if (!companyCheck.length) return createMobileErrorResponse("Not found", 404);
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
          SELECT li.id AS line_item_id, pq.status
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
        }),
      );
      mergedItems = items.map((row: any) => {
        const derived = derivedStatusByLineItemId.get(String(row.id));
        if (!derived) return row;
        return { ...row, po_status: derived, order_status: derived };
      });
    }

    return createMobileSuccessResponse({ jobCard, items: mergedItems });
  } catch (error) {
    console.error("GET /api/mobile/company/[companyId]/workshop/job-cards/[jobCardId] error:", error);
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, jobCardId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    if (
      body?.action !== "start" &&
      body?.action !== "complete" &&
      body?.action !== "collect_car" &&
      body?.action !== "pre_work_check"
    ) {
      return createMobileErrorResponse("Invalid action", 400);
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
    if (!jobRows.length) return createMobileErrorResponse("Not found", 404);
    const jobCard = jobRows[0];

    const currentUserContext = await getUserContext(userId);
    const currentUserBranchId = currentUserContext.companies[0]?.branchId ?? null;
    const assignedBranchId = jobCard?.lead_branch_id ?? null;
    const isBranchScopedUser = currentUserContext.scope === "branch";
    const isAssignedWorkshopUser =
      isBranchScopedUser && !!currentUserBranchId && !!assignedBranchId && currentUserBranchId === assignedBranchId;

    if (isBranchScopedUser && !isAssignedWorkshopUser) {
      return createMobileErrorResponse("Only assigned workshop can perform this action.", 403);
    }

    if (jobCard?.estimate_id) {
      const companyCheck = await sql`
        SELECT 1
        FROM estimates
        WHERE id = ${jobCard.estimate_id} AND company_id = ${companyId}
        LIMIT 1
      `;
      if (!companyCheck.length) return createMobileErrorResponse("Not found", 404);
    }

    if (body?.action === "start") {
      const quoteStatus = String(jobCard?.workshop_quote_status ?? "").toLowerCase();
      if (quoteStatus !== "accepted") {
        return createMobileErrorResponse("Job card can be started only after quote is accepted.", 400);
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
        return createMobileErrorResponse(
          "Collect Car stage is required before starting (video, mileage and mileage image).",
          400,
        );
      }
      if (!jobCard?.pre_work_checked_at) {
        return createMobileErrorResponse("Pre-Work Check stage is required before starting.", 400);
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
        return createMobileErrorResponse("All parts must be received before starting the job card.", 400);
      }

      const updated = await sql`
        UPDATE job_cards
        SET start_at = NOW()
        WHERE id = ${jobCardId} AND start_at IS NULL
        RETURNING *
      `;
      return createMobileSuccessResponse({ jobCard: updated[0] ?? jobCard });
    }

    if (body?.action === "collect_car") {
      const collectCarVideoId = String(body?.collectCarVideoId ?? "").trim();
      const collectCarMileage = Number(body?.collectCarMileage);
      const collectCarMileageImageId = String(body?.collectCarMileageImageId ?? "").trim();
      if (!collectCarVideoId) return createMobileErrorResponse("Collect car video is required.", 400);
      if (!Number.isFinite(collectCarMileage) || collectCarMileage <= 0) {
        return createMobileErrorResponse("Valid car mileage is required.", 400);
      }
      if (!collectCarMileageImageId) return createMobileErrorResponse("Car mileage image is required.", 400);

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
      return createMobileSuccessResponse({ jobCard: updated[0] ?? jobCard });
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
        return createMobileErrorResponse("Complete Collect Car stage before Pre-Work Check.", 400);
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
        return createMobileErrorResponse("All parts must be received before Pre-Work Check.", 400);
      }
      const preWorkNote = typeof body?.preWorkNote === "string" ? body.preWorkNote.trim() : null;
      const updated = await sql`
        UPDATE job_cards
        SET
          pre_work_checked_at = NOW(),
          pre_work_checked_by = ${userId},
          pre_work_note = ${preWorkNote}
        WHERE id = ${jobCardId}
        RETURNING *
      `;
      return createMobileSuccessResponse({ jobCard: updated[0] ?? jobCard });
    }

    const remarks = typeof body?.remarks === "string" ? body.remarks.trim() : "";
    if (!remarks) return createMobileErrorResponse("Remarks are required before completing.", 400);
    const quoteStatus = String(jobCard?.workshop_quote_status ?? "").toLowerCase();
    if (quoteStatus !== "accepted") {
      return createMobileErrorResponse("Job card can be completed only after quote is accepted.", 400);
    }

    const missingEvidence = await sql`
      SELECT li.id
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
      return createMobileErrorResponse("Part and scrap pictures are required before completing.", 400);
    }

    const updated = await sql`
      UPDATE job_cards
      SET complete_at = NOW(),
          status = 'Completed',
          remarks = ${remarks}
      WHERE id = ${jobCardId} AND complete_at IS NULL
      RETURNING *
    `;
    return createMobileSuccessResponse({ jobCard: updated[0] ?? jobCard });
  } catch (error) {
    console.error("PATCH /api/mobile/company/[companyId]/workshop/job-cards/[jobCardId] error:", error);
    return handleMobileError(error);
  }
}
