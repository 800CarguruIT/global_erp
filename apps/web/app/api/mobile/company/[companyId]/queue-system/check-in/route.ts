import { NextRequest } from "next/server";
import {
  appendLeadEvent,
  getLeadById,
  updateLeadPartial,
} from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { requireMobileUserId } from "@/lib/auth/mobile-auth";
import { ensureCompanyAccess } from "@/lib/auth/mobile-company";
import {
  createMobileErrorResponse,
  createMobileSuccessResponse,
  handleMobileError,
} from "@/app/api/mobile/utils";

type Params = { params: Promise<{ companyId: string }> };

const clean = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || null;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireMobileUserId(req);
    const { companyId } = await params;
    await ensureCompanyAccess(userId, companyId);

    const body = await req.json().catch(() => ({}));
    const leadId = clean(body?.leadId);
    if (!leadId) {
      return createMobileErrorResponse("leadId is required", 400);
    }

    const lead = await getLeadById(companyId, leadId);
    if (!lead) {
      return createMobileErrorResponse("Lead not found", 404);
    }

    const requiredFields = {
      photoFront: clean(body?.photoFront),
      photoLeft: clean(body?.photoLeft),
      photoRight: clean(body?.photoRight),
      photoRear: clean(body?.photoRear),
      clusterImage: clean(body?.clusterImage),
      video360: clean(body?.video360),
    };
    const missing = Object.entries(requiredFields).find(([, value]) => !value);
    if (missing) {
      return createMobileErrorResponse(
        "Upload all required images and video before check-in.",
        400,
      );
    }

    const additionalImages = Array.isArray(body?.additionalImages)
      ? body.additionalImages
          .map((item: any) => ({
            id: clean(item?.id) ?? `${Date.now()}`,
            fileId: clean(item?.fileId),
            remark: clean(item?.remark),
          }))
          .filter((item: any) => item.fileId)
      : [];

    const workflowRequired = {
      ...(((lead as any)?.workflowRequired ?? {}) as Record<string, unknown>),
      checkinPhotoFront: requiredFields.photoFront,
      checkinPhotoLeft: requiredFields.photoLeft,
      checkinPhotoRight: requiredFields.photoRight,
      checkinPhotoRear: requiredFields.photoRear,
      checkinClusterImage: requiredFields.clusterImage,
      checkinVideo360: requiredFields.video360,
      checkinAdditionalImages: additionalImages,
      checkinMediaSubmittedAt: new Date().toISOString(),
    };

    await updateLeadPartial(companyId, leadId, {
      leadStatus: "car_in",
      leadStage: "checkin",
      workflowRequired,
      carInVideo: requiredFields.video360,
    });

    const sql = getSql();
    await sql /* sql */ `
      UPDATE leads
      SET checkin_at = ${new Date().toISOString()}
      WHERE company_id = ${companyId}
        AND id = ${leadId}
    `;

    await appendLeadEvent({
      companyId,
      leadId,
      actorUserId: userId,
      eventType: "queue_check_in_completed",
      eventPayload: {
        bookingId: clean(body?.bookingId),
        mediaSubmittedAt: workflowRequired.checkinMediaSubmittedAt,
      },
    });

    const refreshed = await getLeadById(companyId, leadId);
    return createMobileSuccessResponse({ lead: refreshed ?? lead });
  } catch (error) {
    console.error(
      "POST /api/mobile/company/[companyId]/queue-system/check-in error:",
      error,
    );
    return handleMobileError(error);
  }
}
