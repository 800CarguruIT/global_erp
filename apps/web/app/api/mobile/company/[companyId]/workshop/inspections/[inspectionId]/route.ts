import { NextRequest } from "next/server";
import { getLeadById } from "@repo/ai-core/crm/leads/repository";
import { getCarById, getCustomerById } from "@repo/ai-core/crm/repository";
import { getSql } from "@repo/ai-core/db";
import {
  getInspectionById,
  listInspectionLineItems,
  listInspectionItems,
  replaceInspectionItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import {
  getLatestFormForLeadOrRelated,
  getPendingMandatoryFormForLead,
} from "@/lib/pre-inspection-form";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";
import type { InspectionItem } from "@repo/ai-core/workshop/inspections/types";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };
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

async function resolveCollectCarSource(
  sql: any,
  companyId: string,
  leadId: string | null | undefined,
): Promise<{
  sourceType: CollectCarSourceType;
  sourceMedia: Record<string, string>;
}> {
  if (!leadId) return { sourceType: "unknown", sourceMedia: {} };
  const leadRows = await sql<any[]>`
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
  const leadRow = ((leadRows as any).rows ?? leadRows)?.[0];
  if (!leadRow) return { sourceType: "unknown", sourceMedia: {} };

  const isRecovery =
    String(leadRow.lead_type ?? "").toLowerCase() === "recovery" ||
    String(leadRow.workshop_visit_mode ?? "").toLowerCase() === "recovery" ||
    Boolean(String(leadRow.pickup_from ?? "").trim()) ||
    Boolean(String(leadRow.dropoff_to ?? "").trim());

  if (isRecovery) {
    const recoveryRows = await sql<any[]>`
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
    const recoveryRow = ((recoveryRows as any).rows ?? recoveryRows)?.[0];
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

  const workflowRequired = (leadRow.workflow_required ?? {}) as Record<
    string,
    unknown
  >;
  const rsaRows = await sql<any[]>`
    SELECT
      photo_front_file_id,
      photo_rear_file_id,
      photo_right_file_id,
      photo_left_file_id,
      cluster_image_file_id,
      video_360_file_id
    FROM rsa_inspections
    WHERE company_id = ${companyId}
      AND lead_id = ${leadId}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
  `;
  const rsaRow = ((rsaRows as any).rows ?? rsaRows)?.[0];
  const media = normalizeMediaMap({
    video: leadRow.carin_video ?? workflowRequired.inspectionVideo360 ?? rsaRow?.video_360_file_id ?? null,
    front: workflowRequired.inspectionPhotoFront ?? rsaRow?.photo_front_file_id ?? null,
    rear: workflowRequired.inspectionPhotoRear ?? rsaRow?.photo_rear_file_id ?? null,
    right: workflowRequired.inspectionPhotoRight ?? rsaRow?.photo_right_file_id ?? null,
    left: workflowRequired.inspectionPhotoLeft ?? rsaRow?.photo_left_file_id ?? null,
    cluster: workflowRequired.inspectionClusterImage ?? rsaRow?.cluster_image_file_id ?? null,
  });
  return { sourceType: "walkin", sourceMedia: media };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const inspection = await getInspectionById(companyId, inspectionId);
    if (!inspection) {
      return createMobileErrorResponse("Not found", 404);
    }

    const sql = getSql();
    const [items, lineItems, customerRaw, carRaw, lead] = await Promise.all([
      listInspectionItems(inspectionId),
      listInspectionLineItems(inspectionId, { source: "inspection" }),
      inspection.customerId
        ? getCustomerById(inspection.customerId)
        : Promise.resolve(null),
      inspection.carId ? getCarById(inspection.carId) : Promise.resolve(null),
      inspection.leadId
        ? getLeadById(companyId, inspection.leadId)
        : Promise.resolve(null),
    ]);

    const customer =
      customerRaw && customerRaw.company_id === companyId ? customerRaw : null;
    const car = carRaw && carRaw.company_id === companyId ? carRaw : null;
    const effectiveBranchId =
      inspection.branchId ??
      (lead as any)?.branchId ??
      (lead as any)?.branch_id ??
      null;
    let branch: any = null;
    if (effectiveBranchId) {
      const branchRows = await sql`
        SELECT id, display_name, name, code
        FROM branches
        WHERE id = ${effectiveBranchId}
          AND company_id = ${companyId}
        LIMIT 1
      `;
      branch = branchRows[0] ?? null;
    }

    const collectCarLogs = await sql /* sql */ `
      SELECT
        id,
        source_type,
        source_media,
        has_difference,
        note,
        reupload_media,
        reviewed_by,
        reviewed_at,
        created_at
      FROM inspection_collect_car_review_logs
      WHERE company_id = ${companyId}
        AND inspection_id = ${inspectionId}
      ORDER BY reviewed_at DESC
      LIMIT 20
    `.catch(() => []);

    const collectCarSource = await resolveCollectCarSource(
      sql,
      companyId,
      inspection.leadId ?? null,
    );
    const latestCollectCarReview =
      ((inspection as any)?.draftPayload as Record<string, unknown> | null)
        ?.collectCarReview ?? null;
    const latestPreInspectionForm = inspection.leadId
      ? await getLatestFormForLeadOrRelated({
          companyId,
          leadId: inspection.leadId,
        }).catch(() => null)
      : null;
    const [earningsRows, fines] = await Promise.all([
      sql /* sql */ `
        SELECT *
        FROM inspection_earnings
        WHERE company_id = ${companyId}
          AND inspection_id = ${inspectionId}
        LIMIT 1
      `.catch(() => []),
      sql /* sql */ `
        SELECT id, fine_code, reason, amount, created_at
        FROM inspection_fines
        WHERE company_id = ${companyId}
          AND inspection_id = ${inspectionId}
        ORDER BY created_at DESC
      `.catch(() => []),
    ]);

    return createMobileSuccessResponse({
      inspection,
      items,
      lineItems,
      customer,
      car,
      lead,
      branch,
      preInspection: latestPreInspectionForm
        ? {
            id: latestPreInspectionForm.id,
            status: latestPreInspectionForm.status,
            appointmentType: latestPreInspectionForm.appointment_type,
            submittedAt: latestPreInspectionForm.submitted_at,
            answers: latestPreInspectionForm.answers ?? null,
            token: latestPreInspectionForm.token,
          }
        : null,
      collectCar: {
        sourceType: collectCarSource.sourceType,
        sourceMedia: collectCarSource.sourceMedia,
        latestReview: latestCollectCarReview,
        logs: collectCarLogs ?? [],
      },
      earnings: earningsRows?.[0] ?? null,
      fines: Array.isArray(fines) ? fines : [],
      carInVideoId: lead?.carInVideo ?? null,
    });
  } catch (error) {
    console.error(
      "GET /api/mobile/company/[companyId]/workshop/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId, inspectionId } = await params;
    await ensureCompanyAccess(userId, companyId);
    const body = await req.json().catch(() => ({}));
    const current = await getInspectionById(companyId, inspectionId);
    if (!current) {
      return createMobileErrorResponse("Not found", 404);
    }

    const currentDraft =
      (((current as any)?.draftPayload ?? {}) as Record<string, any>) ?? {};
    const collectCarReview = currentDraft?.collectCarReview ?? null;
    const incomingCollectCarReview =
      (((body?.draftPayload ?? {}) as Record<string, any>) ?? {})
        ?.collectCarReview ?? null;
    const collectCarCompleted = Boolean(
      collectCarReview?.completed || incomingCollectCarReview?.completed,
    );
    const isCollectCarReviewAction = body?.action === "collect_car_review";

    if (!isCollectCarReviewAction && !collectCarCompleted) {
      return createMobileErrorResponse(
        "Collect Car stage must be completed before proceeding with inspection workflow.",
        409,
      );
    }

    const requestedStatus = String(body?.status ?? "").toLowerCase();
    const requestStartAt = body?.startAt ?? body?.start_at ?? null;
    const isInspectionStartIntent =
      Boolean(requestStartAt) ||
      requestedStatus === "pending" ||
      requestedStatus === "in_progress" ||
      requestedStatus === "in-progress";
    if (isInspectionStartIntent && current.leadId) {
      const pendingWalkinForm = await getPendingMandatoryFormForLead({
        companyId,
        leadId: current.leadId,
        appointmentType: "walkin",
      }).catch(() => null);
      if (pendingWalkinForm) {
        return createMobileErrorResponse(
          "Pre-inspection form is mandatory before inspection start.",
          409,
          {
            formUrl: `/pre-inspection/${pendingWalkinForm.token}`,
          },
        );
      }
    }

    if (isCollectCarReviewAction) {
      if (current.verifiedAt || (current as any)?.verified_at) {
        return createMobileErrorResponse(
          "Verified inspection is read-only.",
          400,
        );
      }

      const hasDifference = Boolean(body?.hasDifference);
      const note = String(body?.note ?? "").trim() || null;
      const reuploadMedia = normalizeMediaMap(body?.reuploadMedia ?? {});
      if (hasDifference && Object.keys(reuploadMedia).length === 0) {
        return createMobileErrorResponse(
          "Re-upload media is required when difference is found.",
          400,
        );
      }

      const sql = getSql();
      const source = await resolveCollectCarSource(
        sql,
        companyId,
        current.leadId ?? null,
      );
      const reviewedAt = new Date().toISOString();
      const nextCollectCarReview = {
        completed: true,
        hasDifference,
        note,
        sourceType: source.sourceType,
        sourceMedia: source.sourceMedia,
        reuploadMedia,
        reviewedAt,
        reviewedBy: userId ?? null,
      };

      try {
        await sql.begin(async (trx: any) => {
          await trx /* sql */ `
            INSERT INTO inspection_collect_car_review_logs (
              company_id,
              inspection_id,
              lead_id,
              source_type,
              source_media,
              has_difference,
              note,
              reupload_media,
              reviewed_by,
              reviewed_at
            )
            VALUES (
              ${companyId},
              ${inspectionId},
              ${current.leadId ?? null},
              ${source.sourceType},
              ${source.sourceMedia as any},
              ${hasDifference},
              ${note},
              ${reuploadMedia as any},
              ${userId ?? null},
              ${reviewedAt}
            )
          `;

          await trx /* sql */ `
            UPDATE inspections
            SET
              draft_payload = ${
                {
                  ...currentDraft,
                  collectCarReview: nextCollectCarReview,
                } as any
              },
              updated_at = now()
            WHERE company_id = ${companyId}
              AND id = ${inspectionId}
          `;
        });
      } catch (error: any) {
        const message = String(error?.message ?? "");
        if (
          message.toLowerCase().includes("inspection_collect_car_review_logs")
        ) {
          return createMobileErrorResponse(
            "Collect-car review log table is missing. Please run migration 158_inspection_collect_car_review_logs.sql.",
            500,
          );
        }
        return createMobileErrorResponse(
          message || "Failed to save collect car review.",
          500,
        );
      }

      return createMobileSuccessResponse({
        ok: true,
        collectCarReview: nextCollectCarReview,
      });
    }

    const patch = {
      status: body.status,
      startAt: body.startAt ?? body.start_at,
      completeAt: body.completeAt ?? body.complete_at,
      healthEngine: body.healthEngine,
      healthTransmission: body.healthTransmission,
      healthBrakes: body.healthBrakes,
      healthSuspension: body.healthSuspension,
      healthElectrical: body.healthElectrical,
      overallHealth: body.overallHealth,
      customerRemark: body.customerRemark,
      agentRemark: body.agentRemark,
      inspectorRemark: body.inspectorRemark,
      inspectorRemarkLayman: body.inspectorRemarkLayman,
      aiSummaryMarkdown: body.aiSummaryMarkdown,
      aiSummaryPlain: body.aiSummaryPlain,
      draftPayload: body.draftPayload,
    };

    await updateInspectionPartial(companyId, inspectionId, patch);

    if (Array.isArray(body.items)) {
      const items: InspectionItem[] = body.items;
      await replaceInspectionItems(
        inspectionId,
        items.map((i, index) => ({
          inspectionId,
          lineNo: (i as any).lineNo ?? index + 1,
          category: i.category ?? null,
          partName: i.partName,
          severity: i.severity ?? null,
          requiredAction: i.requiredAction ?? null,
          techReason: i.techReason ?? null,
          laymanReason: i.laymanReason ?? null,
          photoRefs: i.photoRefs ?? null,
        })),
      );
    }

    return createMobileSuccessResponse({ ok: true });
  } catch (error) {
    console.error(
      "PATCH /api/mobile/company/[companyId]/inspections/[inspectionId] error:",
      error,
    );
    return handleMobileError(error);
  }
}
