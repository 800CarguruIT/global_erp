import { NextRequest, NextResponse } from "next/server";
import {
  getInspectionById,
  listInspectionItems,
  listInspectionLineItems,
  replaceInspectionItems,
  updateInspectionPartial,
} from "@repo/ai-core/workshop/inspections/repository";
import type { InspectionItem } from "@repo/ai-core/workshop/inspections/types";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { getSql } from "@repo/ai-core/db";
import { getLatestFormForLeadOrRelated, getPendingMandatoryFormForLead } from "@/lib/pre-inspection-form";

type Params = { params: Promise<{ companyId: string; inspectionId: string }> };
type VerifyFineInput = { fineCode?: string | null; reason?: string | null; amount?: number | string | null };

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

async function resolveCollectCarSource(sql: any, companyId: string, leadId: string | null | undefined): Promise<{
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

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function scoreToCheck(value: unknown): "good" | "avg" | "bad" | "" {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  if (num === 1) return "good";
  if (num === 2) return "avg";
  return "bad";
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const inspection = await getInspectionById(companyId, inspectionId);
  if (!inspection) {
    return new NextResponse("Not found", { status: 404 });
  }
  const sql = getSql();

  let inspectionView = inspection;
  const status = String(inspection.status ?? "").toLowerCase();
  const draftPayload = (inspection as any)?.draftPayload ?? {};
  const hasDraftChecks =
    draftPayload &&
    typeof draftPayload === "object" &&
    draftPayload.checks &&
    typeof draftPayload.checks === "object" &&
    Object.keys(draftPayload.checks).length > 0;

  if (!hasDraftChecks && status === "completed") {
    const legacyRows = await sql/* sql */ `
      SELECT
        ci.id,
        ci.engine,
        ci.steering,
        ci.tyres,
        ci.ac_cooling,
        ci.car_body,
        ci.gear,
        ci.suspension,
        ci.brakes,
        ci.battery,
        ci.infotainment,
        ci.lead_remarks,
        ci.inspector_name,
        ci.inspector_remarks,
        ci.insp_location
      FROM migration.legacy_inspection_map lm
      JOIN carguru2.inspections ci
        ON ci.id::bigint = lm.legacy_inspection_id
      WHERE lm.company_id = ${companyId}
        AND lm.inspection_id = ${inspectionId}
      LIMIT 1
    `;

    const legacy = (legacyRows as any)?.[0];
    if (legacy) {
      const builtDraft = {
        ...draftPayload,
        advisorName: draftPayload?.advisorName ?? (legacy.insp_location ? `${legacy.insp_location}_Department` : ""),
        inspectorName: draftPayload?.inspectorName ?? legacy.inspector_name ?? "",
        carInMileage: draftPayload?.carInMileage ?? "",
        customerComplain: draftPayload?.customerComplain ?? legacy.lead_remarks ?? "",
        inspectorRemarks: draftPayload?.inspectorRemarks ?? legacy.inspector_remarks ?? "",
        checks: {
          engine: scoreToCheck(legacy.engine),
          steering: scoreToCheck(legacy.steering),
          tyres: scoreToCheck(legacy.tyres),
          ac: scoreToCheck(legacy.ac_cooling),
          body: scoreToCheck(legacy.car_body),
          gear: scoreToCheck(legacy.gear),
          suspension: scoreToCheck(legacy.suspension),
          brakes: scoreToCheck(legacy.brakes),
          battery: scoreToCheck(legacy.battery),
          infotainment: scoreToCheck(legacy.infotainment),
        },
        legacySnapshot: true,
        legacyInspectionId: legacy.id,
      };

      inspectionView = {
        ...inspection,
        draftPayload: builtDraft,
      } as typeof inspection;
    }
  }

  const items = await listInspectionItems(inspectionId);
  const lineItems = await listInspectionLineItems(inspectionId, { source: "inspection" });
  const collectCarLogs = await sql/* sql */ `
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
  const collectCarSource = await resolveCollectCarSource(sql, companyId, inspection.leadId ?? null);
  const latestCollectCarReview =
    ((inspection as any)?.draftPayload as Record<string, unknown> | null)?.collectCarReview ?? null;
  const latestPreInspectionForm = inspection.leadId
    ? await getLatestFormForLeadOrRelated({
        companyId,
        leadId: inspection.leadId,
      }).catch(() => null)
    : null;
  const earningsRows = await sql/* sql */ `
    SELECT *
    FROM inspection_earnings
    WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
    LIMIT 1
  `;
  const fines = await sql/* sql */ `
    SELECT id, fine_code, reason, amount, created_at
    FROM inspection_fines
    WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
    ORDER BY created_at DESC
  `;
  return NextResponse.json({
    data: {
      inspection: inspectionView,
      items,
      lineItems,
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
      earnings: earningsRows[0] ?? null,
      fines,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { companyId, inspectionId } = await params;
  const body = await req.json().catch(() => ({}));
  const currentUserId = await getCurrentUserIdFromRequest(req);
  const current = await getInspectionById(companyId, inspectionId);
  if (!current) {
    return new NextResponse("Not found", { status: 404 });
  }
  const collectCarReview = (((current as any)?.draftPayload ?? {}) as Record<string, any>)?.collectCarReview ?? null;
  const incomingCollectCarReview =
    ((body?.draftPayload ?? {}) as Record<string, any>)?.collectCarReview ?? null;
  const collectCarCompleted = Boolean(collectCarReview?.completed || incomingCollectCarReview?.completed);
  const isCollectCarReviewAction = body?.action === "collect_car_review";
  if (!isCollectCarReviewAction && !collectCarCompleted) {
    return NextResponse.json(
      { error: "Collect Car stage must be completed before proceeding with inspection workflow." },
      { status: 409 }
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
    });
    if (pendingWalkinForm) {
      return NextResponse.json(
        {
          error: "Pre-inspection form is mandatory before inspection start.",
          formUrl: `/pre-inspection/${pendingWalkinForm.token}`,
        },
        { status: 409 }
      );
    }
  }

  if (body?.action === "collect_car_review") {
    if (current.verifiedAt || (current as any).verified_at) {
      return NextResponse.json({ error: "Verified inspection is read-only." }, { status: 400 });
    }
    const hasDifference = Boolean(body?.hasDifference);
    const note = String(body?.note ?? "").trim() || null;
    const reuploadMedia = normalizeMediaMap(body?.reuploadMedia ?? {});
    if (hasDifference && Object.keys(reuploadMedia).length === 0) {
      return NextResponse.json(
        { error: "Re-upload media is required when difference is found." },
        { status: 400 }
      );
    }
    const sql = getSql();
    const source = await resolveCollectCarSource(sql, companyId, current.leadId ?? null);
    const reviewedAt = new Date().toISOString();
    const previousDraft = ((current as any)?.draftPayload ?? {}) as Record<string, unknown>;
    const nextCollectCarReview = {
      completed: true,
      hasDifference,
      note,
      sourceType: source.sourceType,
      sourceMedia: source.sourceMedia,
      reuploadMedia,
      reviewedAt,
      reviewedBy: currentUserId ?? null,
    };

    try {
      await sql.begin(async (trx: any) => {
        await trx/* sql */ `
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
            ${currentUserId ?? null},
            ${reviewedAt}
          )
        `;

        await trx/* sql */ `
          UPDATE inspections
          SET
            draft_payload = ${{
              ...previousDraft,
              collectCarReview: nextCollectCarReview,
            } as any},
            updated_at = now()
          WHERE company_id = ${companyId}
            AND id = ${inspectionId}
        `;
      });
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.toLowerCase().includes("inspection_collect_car_review_logs")) {
        return NextResponse.json(
          { error: "Collect-car review log table is missing. Please run migration 158_inspection_collect_car_review_logs.sql." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: message || "Failed to save collect car review." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        collectCarReview: nextCollectCarReview,
      },
    });
  }

  if (body?.action === "verify") {
    try {
      if (current.verifiedAt || (current as any).verified_at) {
        return NextResponse.json({ error: "Inspection is already verified." }, { status: 400 });
      }
      const draft = (current.draftPayload ?? {}) as any;
      const advisorApproved = Boolean(draft?.advisorApproved);
      const customerApproved = Boolean(draft?.customerApproved);
      if (!advisorApproved || !customerApproved) {
        return NextResponse.json(
          { error: "Advisor and customer approvals are required before verify." },
          { status: 400 }
        );
      }
      const isCompleted =
        String(current.status ?? "").toLowerCase() === "completed" || Boolean(current.completeAt);
      if (!isCompleted) {
        return NextResponse.json({ error: "Inspection must be completed before verify." }, { status: 400 });
      }

      const sql = getSql();
      const verifyAt = new Date().toISOString();
      const branchRows = current.branchId
        ? await sql/* sql */ `
            SELECT ownership_type
            FROM branches
            WHERE company_id = ${companyId} AND id = ${current.branchId}
            LIMIT 1
          `
        : [];
      const ownershipType = String(branchRows[0]?.ownership_type ?? "").toLowerCase();
      const isThirdParty = ownershipType === "third_party";

      let earningSnapshot: Record<string, any> | null = null;
      if (isThirdParty) {
        const costRows = await sql/* sql */ `
          SELECT
            COALESCE(wccs.inspection_fixed_amount, 0) AS inspection_fixed_amount,
            COALESCE(NULLIF(wccs.currency, ''), NULLIF(c.currency, ''), 'USD') AS currency,
            COALESCE(wccs.vat_rate, 0) AS vat_rate
          FROM companies c
          LEFT JOIN workshop_company_cost_settings wccs
            ON wccs.company_id = c.id
          WHERE c.id = ${companyId}
          LIMIT 1
        `;
        const cost = costRows[0] as any;
        const fixedAmount = Number(cost?.inspection_fixed_amount ?? 0);
        const currency = String(cost?.currency ?? "USD");
        const vatRate = Number(cost?.vat_rate ?? 0);
        if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
          return NextResponse.json(
            { error: "Cost Management is not configured. Set fixed inspection cost first." },
            { status: 400 }
          );
        }

        const inputFines: VerifyFineInput[] = Array.isArray(body?.fines) ? body.fines : [];
        const normalizedFines = inputFines
          .map((fine, index) => ({
            fineCode: fine?.fineCode ? String(fine.fineCode) : `FINE-${Date.now()}-${index + 1}`,
            reason: String(fine?.reason ?? "").trim(),
            amount: Number(fine?.amount ?? 0),
          }))
          .filter((fine) => fine.reason && Number.isFinite(fine.amount) && fine.amount > 0);

        const fineAmount = roundMoney(normalizedFines.reduce((sum, fine) => sum + fine.amount, 0));
        const netBeforeVat = roundMoney(Math.max(fixedAmount - fineAmount, 0));
        const vatAmount = roundMoney(netBeforeVat * (vatRate / 100));
        const totalPayable = roundMoney(netBeforeVat + vatAmount);

        await sql.begin(async (trx) => {
          await trx/* sql */ `
            UPDATE inspections
            SET
              verified_by = ${currentUserId ?? null},
              verified_at = ${verifyAt},
              draft_payload = ${body.draftPayload ?? current.draftPayload ?? null}
            WHERE company_id = ${companyId} AND id = ${inspectionId}
          `;

          await trx/* sql */ `
            INSERT INTO inspection_earnings (
              company_id,
              inspection_id,
              lead_id,
              branch_id,
              gross_amount,
              fine_amount,
              net_before_vat,
              vat_rate,
              vat_amount,
              total_payable,
              currency,
              status,
              verified_by,
              verified_at
            ) VALUES (
              ${companyId},
              ${inspectionId},
              ${current.leadId ?? null},
              ${current.branchId ?? null},
              ${fixedAmount},
              ${fineAmount},
              ${netBeforeVat},
              ${vatRate},
              ${vatAmount},
              ${totalPayable},
              ${currency},
              ${"locked"},
              ${currentUserId ?? null},
              ${verifyAt}
            )
            ON CONFLICT (inspection_id)
            DO UPDATE SET
              gross_amount = EXCLUDED.gross_amount,
              fine_amount = EXCLUDED.fine_amount,
              net_before_vat = EXCLUDED.net_before_vat,
              vat_rate = EXCLUDED.vat_rate,
              vat_amount = EXCLUDED.vat_amount,
              total_payable = EXCLUDED.total_payable,
              currency = EXCLUDED.currency,
              status = EXCLUDED.status,
              verified_by = EXCLUDED.verified_by,
              verified_at = EXCLUDED.verified_at,
              updated_at = now()
          `;

          await trx/* sql */ `
            DELETE FROM inspection_fines
            WHERE company_id = ${companyId} AND inspection_id = ${inspectionId}
          `;
          for (const fine of normalizedFines) {
            await trx/* sql */ `
              INSERT INTO inspection_fines (
                company_id,
                inspection_id,
                fine_code,
                reason,
                amount,
                created_by
              ) VALUES (
                ${companyId},
                ${inspectionId},
                ${fine.fineCode ?? null},
                ${fine.reason},
                ${fine.amount},
                ${currentUserId ?? null}
              )
            `;
          }
        });

        earningSnapshot = {
          grossAmount: fixedAmount,
          fineAmount,
          netBeforeVat,
          vatRate,
          vatAmount,
          totalPayable,
          currency,
          fines: normalizedFines,
        };
      } else {
        await updateInspectionPartial(companyId, inspectionId, {
          verifiedBy: currentUserId ?? null,
          verifiedAt: verifyAt,
          draftPayload: body.draftPayload ?? current.draftPayload ?? null,
        });
      }

      return NextResponse.json({ ok: true, data: { earning: earningSnapshot } });
    } catch (err: any) {
      const message = String(err?.message ?? "");
      if (message.toLowerCase().includes("inspection_earnings") || message.toLowerCase().includes("inspection_fines")) {
        return NextResponse.json(
          { error: "Earnings tables are missing. Please run migration 120_workshop_inspection_earnings.sql." },
          { status: 500 }
        );
      }
      if (message.toLowerCase().includes("workshop_company_cost_settings")) {
        return NextResponse.json(
          { error: "Cost settings table is missing. Please run migration 120_workshop_inspection_earnings.sql." },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: message || "Failed to verify inspection" }, { status: 500 });
    }
  }

  if (body?.action === "cancel") {
    if (current.verifiedAt || (current as any).verified_at) {
      return NextResponse.json({ error: "Verified inspection cannot be cancelled." }, { status: 400 });
    }
    await updateInspectionPartial(companyId, inspectionId, {
      status: "cancelled",
      cancelledBy: currentUserId ?? null,
      cancelledAt: new Date().toISOString(),
      cancelRemarks: body.cancelRemarks ?? body.cancel_remarks ?? null,
      draftPayload: body.draftPayload ?? current.draftPayload ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  if (current.verifiedAt || (current as any).verified_at) {
    return NextResponse.json({ error: "Verified inspection is read-only." }, { status: 400 });
  }

  const patch = {
    status: body.status,
    startAt: body.startAt ?? body.start_at,
    completeAt: body.completeAt ?? body.complete_at,
    verifiedBy: body.verifiedBy ?? body.verified_by,
    verifiedAt: body.verifiedAt ?? body.verified_at,
    cancelledBy: body.cancelledBy ?? body.cancelled_by,
    cancelledAt: body.cancelledAt ?? body.cancelled_at,
    cancelRemarks: body.cancelRemarks ?? body.cancel_remarks,
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
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
