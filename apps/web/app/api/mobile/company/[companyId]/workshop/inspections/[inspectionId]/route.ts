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
import {
  normalizeMediaMap,
  resolveCollectCarSource,
  type CollectCarSource,
  type CollectCarSourceType,
} from "@/lib/collect-car-source";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };

function buildCollectCarReviewFromLog(
  logRow: any,
  fallbackSource: CollectCarSource,
) {
  if (!logRow) return null;
  return {
    completed: true,
    hasDifference: Boolean(logRow?.has_difference),
    note: String(logRow?.note ?? "").trim() || null,
    sourceType: String(
      logRow?.source_type ?? fallbackSource.sourceType ?? "unknown",
    ) as CollectCarSourceType,
    sourceMedia: normalizeMediaMap(
      logRow?.source_media ?? fallbackSource.sourceMedia,
    ),
    reuploadMedia: normalizeMediaMap(logRow?.reupload_media ?? {}),
    reviewedAt: logRow?.reviewed_at ?? logRow?.created_at ?? null,
    reviewedBy: logRow?.reviewed_by ? String(logRow.reviewed_by) : null,
  };
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
    const latestCollectCarLog = ((collectCarLogs as any)?.rows ?? collectCarLogs)?.[0];

    const collectCarSource = await resolveCollectCarSource(
      sql,
      companyId,
      inspection.leadId ?? null,
    );
    const latestCollectCarReview =
      ((inspection as any)?.draftPayload as Record<string, unknown> | null)
        ?.collectCarReview ??
      buildCollectCarReviewFromLog(latestCollectCarLog, collectCarSource);
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

    const sql = getSql();
    const currentDraft =
      (((current as any)?.draftPayload ?? {}) as Record<string, any>) ?? {};
    const collectCarReview = currentDraft?.collectCarReview ?? null;
    const incomingCollectCarReview =
      (((body?.draftPayload ?? {}) as Record<string, any>) ?? {})
        ?.collectCarReview ?? null;
    const collectCarSource = await resolveCollectCarSource(
      sql,
      companyId,
      current.leadId ?? null,
    );
    const collectCarLogRows = await sql /* sql */ `
      SELECT
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
      ORDER BY reviewed_at DESC, created_at DESC
      LIMIT 1
    `.catch(() => []);
    const latestCollectCarLog = ((collectCarLogRows as any)?.rows ?? collectCarLogRows)?.[0];
    const loggedCollectCarReview = buildCollectCarReviewFromLog(
      latestCollectCarLog,
      collectCarSource,
    );
    const collectCarCompleted = Boolean(
      collectCarReview?.completed ||
        incomingCollectCarReview?.completed ||
        loggedCollectCarReview?.completed,
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

      const source = collectCarSource;
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
