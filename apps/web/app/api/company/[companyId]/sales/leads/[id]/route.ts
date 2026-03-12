import { NextRequest, NextResponse } from "next/server";
import { appendLeadEvent, deleteLead, getLeadById, updateLeadPartial } from "@repo/ai-core/crm/leads/repository";
import { getSql } from "@repo/ai-core/db";
import { createInspection, getLatestInspectionForLead } from "@repo/ai-core/workshop/inspections/repository";
import { createEstimateFromInspection, replaceEstimateItems, updateEstimateHeader } from "@repo/ai-core/workshop/estimates/repository";
import { createInvoiceFromEstimate } from "@repo/ai-core/workshop/invoices/repository";
import { Files, getOpenAIClientForCompany } from "@repo/ai-core";
import { getCurrentUserIdFromRequest } from "@/lib/auth/current-user";
import { normalizeRsaStatus } from "@/lib/leads/rsa-flow";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";

type Params = { params: Promise<{ companyId: string; id: string }> };
export const runtime = "nodejs";
const ENABLE_INSPECTION_MEDIA_VALIDATION = false;

type MediaKey =
  | "inspectionPhotoFront"
  | "inspectionPhotoLeft"
  | "inspectionPhotoRight"
  | "inspectionPhotoRear"
  | "inspectionClusterImage";

type MediaInput = {
  imageIds: Record<MediaKey, string>;
  videoId: string;
};

type MediaValidationResult =
  | { ok: true; details: any }
  | { ok: false; status: number; error: string; details?: any };

type RsaInspectionPayload = {
  vin: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: string | null;
  carPlate: string | null;
  tyreSize: string | null;
  mileage: number | null;
  photoFrontFileId: string | null;
  photoLeftFileId: string | null;
  photoRightFileId: string | null;
  photoRearFileId: string | null;
  clusterImageFileId: string | null;
  video360FileId: string | null;
  healthBattery: string | null;
  healthBatterySize: string | null;
  healthBatteryPhotoFileId: string | null;
  healthBatteryVoltage: string | null;
  healthStarter: string | null;
  healthObd: string | null;
  healthObdReportPhotoFileId: string | null;
  healthObdCodes: string | null;
  healthNotes: string | null;
  healthExtra: any;
  aiValidation: any;
};

type CompleteJobLineItemInput = {
  name?: unknown;
  quantity?: unknown;
  price?: unknown;
  pictureFileId?: unknown;
};

type CompleteJobPayloadInput = {
  lineItems?: unknown;
  paymentProofFileId?: unknown;
  paymentMethod?: unknown;
  withVat?: unknown;
  vatRate?: unknown;
  notes?: unknown;
};

const REQUIRED_IMAGE_KEYS: MediaKey[] = [
  "inspectionPhotoFront",
  "inspectionPhotoLeft",
  "inspectionPhotoRight",
  "inspectionPhotoRear",
  "inspectionClusterImage",
];

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizePositiveNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n > 0 ? n : 0;
}

function normalizeVatRate(value: unknown, fallback = 0.05): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 0.25) return 0.25;
  return n;
}

async function finalizeRsaCompletion(args: {
  companyId: string;
  leadId: string;
  lead: any;
  workflowRequired: Record<string, unknown> | null;
  payload: CompleteJobPayloadInput | null;
}) {
  const existingResult = (args.workflowRequired?.completeJobResult as Record<string, unknown> | undefined) ?? null;
  if (existingResult?.invoiceId && existingResult?.estimateId) {
    return {
      estimateId: String(existingResult.estimateId),
      invoiceId: String(existingResult.invoiceId),
      totalAmount: Number(existingResult.totalAmount ?? 0) || 0,
      skipped: true,
    };
  }

  const lineItemsRaw = Array.isArray(args.payload?.lineItems) ? (args.payload!.lineItems as CompleteJobLineItemInput[]) : [];
  const lineItems = lineItemsRaw
    .map((item) => ({
      name: String(item?.name ?? "").trim(),
      quantity: normalizePositiveNumber(item?.quantity),
      price: normalizePositiveNumber(item?.price),
      pictureFileId: String(item?.pictureFileId ?? "").trim(),
    }))
    .filter((item) => item.name && item.quantity > 0 && item.price > 0 && item.pictureFileId);
  if (!lineItems.length) {
    throw new Error("Add at least one valid job line item (name, picture, qty, price) before completing.");
  }

  const paymentProofFileId = String(args.payload?.paymentProofFileId ?? "").trim();
  if (!paymentProofFileId) {
    throw new Error("Payment proof picture is required before completing job.");
  }
  const paymentProofFile = await loadCompanyFileOrNull(args.companyId, paymentProofFileId);
  if (!paymentProofFile) {
    throw new Error("Payment proof file is missing or inaccessible.");
  }
  const paymentMethod = String(args.payload?.paymentMethod ?? "cash").trim() || "cash";
  const paymentNotes = String(args.payload?.notes ?? "").trim();
  const withVatRaw = args.payload?.withVat;
  const withVat =
    withVatRaw === true ||
    String(withVatRaw ?? "").trim().toLowerCase() === "true" ||
    String(withVatRaw ?? "").trim() === "1";
  const vatRate = withVat ? normalizeVatRate(args.payload?.vatRate, 0.05) : 0;
  const subtotalAmount = lineItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const vatAmount = subtotalAmount * vatRate;
  const grandTotalAmount = subtotalAmount + vatAmount;

  for (const item of lineItems) {
    const pictureFile = await loadCompanyFileOrNull(args.companyId, item.pictureFileId);
    if (!pictureFile) {
      throw new Error(`Line item picture is missing or inaccessible for "${item.name}".`);
    }
  }

  let inspection = await getLatestInspectionForLead(args.companyId, args.leadId);
  if (!inspection) {
    inspection = await createInspection({
      companyId: args.companyId,
      leadId: args.leadId,
      carId: args.lead?.carId ?? null,
      customerId: args.lead?.customerId ?? null,
      branchId: args.lead?.branchId ?? null,
      status: "pending",
    });
  }

  const estimateResult = await createEstimateFromInspection(args.companyId, String(inspection.id));
  const estimateId = String(estimateResult.estimate.id);
  await replaceEstimateItems(
    estimateId,
    lineItems.map((item, idx) => ({
      lineNo: idx + 1,
      inspectionItemId: null,
      partName: item.name,
      description: `Evidence file: ${item.pictureFileId}`,
      type: "repair" as const,
      quantity: item.quantity,
      cost: item.price,
      sale: Number((item.price * (1 + vatRate)).toFixed(4)),
      gpPercent: 0,
      status: "approved" as const,
      approvedType: "oe" as const,
      approvedCost: item.price,
      approvedSale: Number((item.price * (1 + vatRate)).toFixed(4)),
      discount: 0,
      discountPercent: 0,
    }))
  );

  await updateEstimateHeader(args.companyId, estimateId, {
    status: "approved",
    meta: {
      autoGeneratedFromRsaCompletion: true,
      paymentProofFileId,
      paymentMethod,
      paymentNotes: paymentNotes || null,
      withVat,
      vatRate,
      subtotalAmount,
      vatAmount,
      grandTotalAmount,
      lineItems,
    },
  });

  const invoiceResult = await createInvoiceFromEstimate(args.companyId, estimateId);
  const invoiceId = String(invoiceResult.invoice.id);
  const sql = getSql();
  await sql/* sql */ `
    UPDATE invoices
    SET status = 'paid',
        payment_method = ${paymentMethod},
        paid_at = now(),
        notes = ${paymentNotes || `Payment proof file: ${paymentProofFileId}`}
    WHERE company_id = ${args.companyId} AND id = ${invoiceId}
  `;

  return {
    estimateId,
    invoiceId,
    totalAmount: Number(invoiceResult.invoice.grandTotal ?? 0) || 0,
    skipped: false,
  };
}

function parseInspectionMediaInput(workflowRequired: Record<string, unknown>): MediaInput | null {
  const imageIds = {} as Record<MediaKey, string>;
  for (const key of REQUIRED_IMAGE_KEYS) {
    const id = normalizeId(workflowRequired?.[key]);
    if (!id) return null;
    imageIds[key] = id;
  }
  const videoId = normalizeId(workflowRequired?.inspectionVideo360);
  if (!videoId) return null;
  return { imageIds, videoId };
}

function parseRsaInspectionPayload(workflowRequired: Record<string, unknown> | null): RsaInspectionPayload | null {
  if (!workflowRequired) return null;
  const toNullable = (value: unknown) => {
    const text = String(value ?? "").trim();
    return text ? text : null;
  };
  const toNullableInt = (value: unknown) => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const payload: RsaInspectionPayload = {
    vin: toNullable(workflowRequired.inspectionVin),
    carMake: toNullable(workflowRequired.inspectionMake),
    carModel: toNullable(workflowRequired.inspectionModel),
    carYear: toNullable(workflowRequired.inspectionYear),
    carPlate: toNullable(workflowRequired.inspectionPlate),
    tyreSize: toNullable(workflowRequired.inspectionTyreSize),
    mileage: toNullableInt(workflowRequired.inspectionMileage),
    photoFrontFileId: toNullable(workflowRequired.inspectionPhotoFront),
    photoLeftFileId: toNullable(workflowRequired.inspectionPhotoLeft),
    photoRightFileId: toNullable(workflowRequired.inspectionPhotoRight),
    photoRearFileId: toNullable(workflowRequired.inspectionPhotoRear),
    clusterImageFileId: toNullable(workflowRequired.inspectionClusterImage),
    video360FileId: toNullable(workflowRequired.inspectionVideo360),
    healthBattery: toNullable(workflowRequired.healthBattery),
    healthBatterySize: toNullable(
      (workflowRequired.healthExtra as Record<string, unknown> | undefined)?.healthBatterySize ??
      workflowRequired.healthBatterySize
    ),
    healthBatteryPhotoFileId: toNullable(
      (workflowRequired.healthExtra as Record<string, unknown> | undefined)?.healthBatteryPhoto ??
      workflowRequired.healthBatteryPhoto
    ),
    healthBatteryVoltage: toNullable(workflowRequired.healthBatteryVoltage),
    healthStarter: toNullable(workflowRequired.healthStarter),
    healthObd: toNullable(workflowRequired.healthObd),
    healthObdReportPhotoFileId: toNullable(
      (workflowRequired.healthExtra as Record<string, unknown> | undefined)?.healthObdReportPhoto ??
      workflowRequired.healthObdReportPhoto
    ),
    healthObdCodes: toNullable(workflowRequired.healthObdCodes),
    healthNotes: toNullable(workflowRequired.healthNotes),
    healthExtra:
      workflowRequired.healthExtra && typeof workflowRequired.healthExtra === "object"
        ? workflowRequired.healthExtra
        : null,
    aiValidation: workflowRequired.inspectionAiValidation ?? null,
  };

  const hasAny =
    Boolean(payload.vin) ||
    Boolean(payload.carMake) ||
    Boolean(payload.carModel) ||
    Boolean(payload.carYear) ||
    Boolean(payload.carPlate) ||
    Boolean(payload.tyreSize) ||
    payload.mileage !== null ||
    Boolean(payload.photoFrontFileId) ||
    Boolean(payload.photoLeftFileId) ||
    Boolean(payload.photoRightFileId) ||
    Boolean(payload.photoRearFileId) ||
    Boolean(payload.clusterImageFileId) ||
    Boolean(payload.video360FileId) ||
    Boolean(payload.healthBattery) ||
    Boolean(payload.healthBatterySize) ||
    Boolean(payload.healthBatteryPhotoFileId) ||
    Boolean(payload.healthStarter) ||
    Boolean(payload.healthObd) ||
    Boolean(payload.healthObdReportPhotoFileId) ||
    Boolean(payload.healthNotes) ||
    Boolean(payload.healthExtra) ||
    Boolean(payload.aiValidation);
  return hasAny ? payload : null;
}

async function upsertRsaInspectionRow(args: {
  companyId: string;
  leadId: string;
  payload: RsaInspectionPayload;
}) {
  const sql = getSql();
  const p = args.payload;
  await sql/* sql */ `
    INSERT INTO rsa_inspections (
      company_id,
      lead_id,
      vin,
      car_make,
      car_model,
      car_year,
      car_plate,
      tyre_size,
      mileage,
      photo_front_file_id,
      photo_left_file_id,
      photo_right_file_id,
      photo_rear_file_id,
      cluster_image_file_id,
      video_360_file_id,
      health_battery,
      health_battery_size,
      health_battery_photo_file_id,
      health_battery_voltage,
      health_starter,
      health_obd,
      health_obd_report_photo_file_id,
      health_obd_codes,
      health_notes,
      health_extra,
      ai_validation
    )
    VALUES (
      ${args.companyId}::uuid,
      ${args.leadId}::uuid,
      ${p.vin},
      ${p.carMake},
      ${p.carModel},
      ${p.carYear},
      ${p.carPlate},
      ${p.tyreSize},
      ${p.mileage},
      ${p.photoFrontFileId}::uuid,
      ${p.photoLeftFileId}::uuid,
      ${p.photoRightFileId}::uuid,
      ${p.photoRearFileId}::uuid,
      ${p.clusterImageFileId}::uuid,
      ${p.video360FileId}::uuid,
      ${p.healthBattery},
      ${p.healthBatterySize},
      ${p.healthBatteryPhotoFileId}::uuid,
      ${p.healthBatteryVoltage},
      ${p.healthStarter},
      ${p.healthObd},
      ${p.healthObdReportPhotoFileId}::uuid,
      ${p.healthObdCodes},
      ${p.healthNotes},
      ${p.healthExtra},
      ${p.aiValidation}
    )
    ON CONFLICT (company_id, lead_id)
    DO UPDATE SET
      vin = EXCLUDED.vin,
      car_make = EXCLUDED.car_make,
      car_model = EXCLUDED.car_model,
      car_year = EXCLUDED.car_year,
      car_plate = EXCLUDED.car_plate,
      tyre_size = EXCLUDED.tyre_size,
      mileage = EXCLUDED.mileage,
      photo_front_file_id = EXCLUDED.photo_front_file_id,
      photo_left_file_id = EXCLUDED.photo_left_file_id,
      photo_right_file_id = EXCLUDED.photo_right_file_id,
      photo_rear_file_id = EXCLUDED.photo_rear_file_id,
      cluster_image_file_id = EXCLUDED.cluster_image_file_id,
      video_360_file_id = EXCLUDED.video_360_file_id,
      health_battery = EXCLUDED.health_battery,
      health_battery_size = EXCLUDED.health_battery_size,
      health_battery_photo_file_id = EXCLUDED.health_battery_photo_file_id,
      health_battery_voltage = EXCLUDED.health_battery_voltage,
      health_starter = EXCLUDED.health_starter,
      health_obd = EXCLUDED.health_obd,
      health_obd_report_photo_file_id = EXCLUDED.health_obd_report_photo_file_id,
      health_obd_codes = EXCLUDED.health_obd_codes,
      health_notes = EXCLUDED.health_notes,
      health_extra = EXCLUDED.health_extra,
      ai_validation = EXCLUDED.ai_validation,
      updated_at = now()
  `;
}

async function loadCompanyFileOrNull(companyId: string, fileId: string) {
  const record = await Files.getFileById(fileId);
  if (!record) return null;
  if (record.company_id && record.company_id !== companyId) return null;
  return record;
}

async function imageFileToDataUrl(filePath: string): Promise<string> {
  const buff = await fs.readFile(filePath);
  const compressed = await sharp(buff)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside" })
    .jpeg({ quality: 72 })
    .toBuffer();
  return `data:image/jpeg;base64,${compressed.toString("base64")}`;
}

async function extractVideoFramesAsDataUrls(filePath: string): Promise<string[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inspection-video-"));
  const timestamps = ["10%", "50%", "90%"];
  const framePattern = "frame-%i.jpg";
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(filePath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .screenshots({
          timestamps,
          filename: framePattern,
          folder: tmpDir,
          size: "960x?",
        });
    });
    const files = await fs.readdir(tmpDir);
    const frameFiles = files.filter((f) => f.startsWith("frame-")).sort();
    const frames = await Promise.all(
      frameFiles.map((f) => imageFileToDataUrl(path.join(tmpDir, f)))
    );
    return frames;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function validateInspectionMediaWithAi(args: {
  companyId: string;
  workflowRequired: Record<string, unknown>;
}): Promise<MediaValidationResult> {
  const parsed = parseInspectionMediaInput(args.workflowRequired);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error: "Inspection media is incomplete. Please upload all required images and 360 video.",
    };
  }

  const imageEntries = await Promise.all(
    REQUIRED_IMAGE_KEYS.map(async (key) => {
      const record = await loadCompanyFileOrNull(args.companyId, parsed.imageIds[key]);
      return { key, record };
    })
  );
  const missingImage = imageEntries.find((x) => !x.record);
  if (missingImage) {
    return {
      ok: false,
      status: 400,
      error: `Missing or inaccessible file for ${missingImage.key}.`,
    };
  }

  const videoRecord = await loadCompanyFileOrNull(args.companyId, parsed.videoId);
  if (!videoRecord) {
    return {
      ok: false,
      status: 400,
      error: "Missing or inaccessible 360 video file.",
    };
  }

  const { client } = await getOpenAIClientForCompany(args.companyId);
  if (!client) {
    return {
      ok: false,
      status: 503,
      error: "AI validation is unavailable for this company. Configure AI provider to continue.",
    };
  }

  const imageDataEntries = await Promise.all(
    imageEntries.map(async ({ key, record }) => ({
      key,
      dataUrl: await imageFileToDataUrl(String(record!.storage_path)),
    }))
  );
  const videoFrames = await extractVideoFramesAsDataUrls(String(videoRecord.storage_path));
  if (!videoFrames.length) {
    return {
      ok: false,
      status: 400,
      error: "Could not read video frames from 360 video. Please upload a valid video.",
    };
  }

  const content: any[] = [
    {
      type: "text",
      text:
        "You are a strict vehicle-inspection media validator. Reject anything non-photographic (cartoon, illustration, icon, screenshot UI, blank, synthetic placeholder, watermark card) and wrong viewpoint.\n" +
        "Return STRICT JSON ONLY with this shape:\n" +
        "{\n" +
        '  "pass": boolean,\n' +
        '  "confidence": number,\n' +
        '  "items": {\n' +
        '    "inspectionPhotoFront": {"pass": boolean, "isRealPhoto": boolean, "view": "front|left|right|rear|cluster|other", "reason": string},\n' +
        '    "inspectionPhotoLeft": {"pass": boolean, "isRealPhoto": boolean, "view": "front|left|right|rear|cluster|other", "reason": string},\n' +
        '    "inspectionPhotoRight": {"pass": boolean, "isRealPhoto": boolean, "view": "front|left|right|rear|cluster|other", "reason": string},\n' +
        '    "inspectionPhotoRear": {"pass": boolean, "isRealPhoto": boolean, "view": "front|left|right|rear|cluster|other", "reason": string},\n' +
        '    "inspectionClusterImage": {"pass": boolean, "isRealPhoto": boolean, "view": "front|left|right|rear|cluster|other", "reason": string},\n' +
        '    "inspectionVideo360": {"pass": boolean, "isRealCarScene": boolean, "reason": string}\n' +
        "  },\n" +
        '  "rejected": string[]\n' +
        "}\n" +
        "Acceptance rules:\n" +
        "- inspectionPhotoFront must be real car FRONT view.\n" +
        "- inspectionPhotoLeft must be real car LEFT side view.\n" +
        "- inspectionPhotoRight must be real car RIGHT side view.\n" +
        "- inspectionPhotoRear must be real car REAR view.\n" +
        "- inspectionClusterImage must be real dashboard/instrument cluster showing indicators/mileage area.\n" +
        "- inspectionVideo360 passes only if extracted frames show real car scene, not static fake/dummy media.\n" +
        "When uncertain, fail conservatively.",
    },
  ];

  for (const item of imageDataEntries) {
    content.push({
      type: "text",
      text: `ITEM ${item.key}`,
    });
    content.push({
      type: "image_url",
      image_url: { url: item.dataUrl },
    });
  }
  videoFrames.forEach((frame, idx) => {
    content.push({ type: "text", text: `ITEM video_frame_${idx + 1}` });
    content.push({ type: "image_url", image_url: { url: frame } });
  });

  let parsedResult: any = null;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content }],
    });
    const raw = String(completion.choices?.[0]?.message?.content ?? "{}").trim();
    parsedResult = JSON.parse(raw);
  } catch (err: any) {
    return {
      ok: false,
      status: 502,
      error: "AI validation failed. Please retry with clearer media.",
      details: { message: err?.message ?? "ai_error" },
    };
  }

  const rejected = Array.isArray(parsedResult?.rejected)
    ? parsedResult.rejected.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
    : [];
  const items = (parsedResult?.items ?? {}) as Record<string, any>;
  const expectedViews: Record<MediaKey, string> = {
    inspectionPhotoFront: "front",
    inspectionPhotoLeft: "left",
    inspectionPhotoRight: "right",
    inspectionPhotoRear: "rear",
    inspectionClusterImage: "cluster",
  };
  const strictFailures: string[] = [];
  for (const key of REQUIRED_IMAGE_KEYS) {
    const item = items?.[key] ?? {};
    const isReal = Boolean(item?.isRealPhoto);
    const view = String(item?.view ?? "").trim().toLowerCase();
    const expected = expectedViews[key];
    if (!isReal) strictFailures.push(key);
    if (view !== expected) strictFailures.push(key);
    if (item?.pass === false) strictFailures.push(key);
  }
  const videoItem = items?.inspectionVideo360 ?? {};
  if (videoItem?.pass === false || !Boolean(videoItem?.isRealCarScene)) {
    strictFailures.push("inspectionVideo360");
  }
  const mergedRejected = Array.from(new Set([...rejected, ...strictFailures]));
  const pass = Boolean(parsedResult?.pass) && mergedRejected.length === 0;
  if (!pass) {
    return {
      ok: false,
      status: 400,
      error: "AI rejected inspection media as dummy/invalid. Please upload real car evidence.",
      details: {
        rejected: mergedRejected,
        reasons: parsedResult?.reasons ?? null,
        items,
        confidence: parsedResult?.confidence ?? null,
      },
    };
  }

  return {
    ok: true,
    details: {
      validatedAt: new Date().toISOString(),
      confidence: parsedResult?.confidence ?? null,
      reasons: parsedResult?.reasons ?? null,
    },
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ data: lead });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const currentUserId = await getCurrentUserIdFromRequest(req);
  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => ({}));
  const {
    status,
    ownerId,
    agentRemark,
    customerRemark,
    branchId,
    assignedUserId,
    serviceType,
    leadStage,
    recoveryDirection,
    recoveryFlow,
    ensureInspection,
    workflowRequired,
    validateInspectionMediaOnly,
    completeJobPayload,
  } = body ?? {};

  if (validateInspectionMediaOnly === true) {
    if (!ENABLE_INSPECTION_MEDIA_VALIDATION) {
      return NextResponse.json({ ok: true, skipped: true, reason: "inspection_media_validation_disabled" });
    }
    const validation = await validateInspectionMediaWithAi({
      companyId,
      workflowRequired:
        ((workflowRequired as Record<string, unknown> | undefined) ??
          (((lead as any).workflowRequired ?? null) as Record<string, unknown> | null)) ?? {},
    });
    if (!validation.ok) {
      const isAiDummyRejection =
        validation.status === 400 &&
        String(validation.error ?? "").toLowerCase().includes("ai rejected inspection media");
      if (isAiDummyRejection) {
        return NextResponse.json({
          ok: false,
          warningOnly: true,
          error: validation.error,
          details: validation.details ?? null,
        });
      }
      return NextResponse.json(
        { ok: false, error: validation.error, details: validation.details ?? null },
        { status: validation.status }
      );
    }
    return NextResponse.json({ ok: true, details: validation.details ?? null });
  }

  const branchIdFromBody = branchId === null ? null : branchId ?? lead.branchId ?? null;
  const branchChanged = branchIdFromBody !== lead.branchId;
  const requestedLeadStage = String(leadStage ?? lead.leadStage ?? "").trim().toLowerCase();
  const enteringCompletedStage =
    requestedLeadStage === "completed" && String(lead.leadStage ?? "").trim().toLowerCase() !== "completed";
  const enteringInspectionStage =
    requestedLeadStage === "inspection_in_progress" &&
    String(lead.leadStage ?? "").trim().toLowerCase() !== "inspection_in_progress";
  let nextWorkflowRequired: Record<string, unknown> | null =
    (workflowRequired as Record<string, unknown> | undefined) ??
    (((lead as any).workflowRequired ?? null) as Record<string, unknown> | null);

  if (enteringInspectionStage && ENABLE_INSPECTION_MEDIA_VALIDATION) {
    const validation = await validateInspectionMediaWithAi({
      companyId,
      workflowRequired: nextWorkflowRequired ?? {},
    });
    if (!validation.ok) {
      const isAiDummyRejection =
        validation.status === 400 &&
        String(validation.error ?? "").toLowerCase().includes("ai rejected inspection media");
      if (!isAiDummyRejection) {
        return NextResponse.json(
          { error: validation.error, details: validation.details ?? null },
          { status: validation.status }
        );
      }
      nextWorkflowRequired = {
        ...(nextWorkflowRequired ?? {}),
        inspectionAiValidation: {
          pass: false,
          warningOnly: true,
          warning: validation.error,
          details: validation.details ?? null,
          validatedAt: new Date().toISOString(),
        },
      };
    } else {
      nextWorkflowRequired = {
        ...(nextWorkflowRequired ?? {}),
        inspectionAiValidation: validation.details,
      };
    }
  }

  if (enteringCompletedStage && lead.leadType === "rsa") {
    try {
      const completion = await finalizeRsaCompletion({
        companyId,
        leadId: id,
        lead,
        workflowRequired: nextWorkflowRequired,
        payload: (completeJobPayload as CompleteJobPayloadInput | undefined) ?? null,
      });
      nextWorkflowRequired = {
        ...(nextWorkflowRequired ?? {}),
        completeJobResult: {
          estimateId: completion.estimateId,
          invoiceId: completion.invoiceId,
          totalAmount: completion.totalAmount,
          autoGenerated: true,
          completedAt: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return NextResponse.json(
        { error: String(err?.message ?? "Failed to process job completion.") },
        { status: 400 }
      );
    }
  }

  const nextAssignedUserId = assignedUserId ?? lead.assignedUserId ?? null;
  const normalizedStatusForUpdate =
    status === undefined || status === null || status === ""
      ? lead.leadStatus
      : lead.leadType === "rsa"
        ? normalizeRsaStatus(status)
        : status;
  const nextLeadStatus = normalizedStatusForUpdate ?? lead.leadStatus;
  const assignmentRequested =
    lead.leadType === "workshop" &&
    nextLeadStatus === "car_in" &&
    (branchIdFromBody || nextAssignedUserId) &&
    (branchChanged || nextAssignedUserId !== lead.assignedUserId || ensureInspection === true);

  if (assignmentRequested) {
    const latestInspection = await getLatestInspectionForLead(companyId, id);
    const isVerified = Boolean(latestInspection?.verifiedAt ?? (latestInspection as any)?.verified_at);
    if (isVerified) {
      return NextResponse.json(
        { error: "Inspection already verified. Reassign/assign is not allowed." },
        { status: 400 }
      );
    }
  }

  await updateLeadPartial(companyId, id, {
    leadStatus: normalizedStatusForUpdate ?? lead.leadStatus,
    leadStage: leadStage ?? lead.leadStage,
    branchId: branchIdFromBody,
    assignedUserId: nextAssignedUserId,
    serviceType: serviceType ?? lead.serviceType ?? null,
    recoveryDirection: recoveryDirection ?? lead.recoveryDirection ?? null,
    recoveryFlow: recoveryFlow ?? lead.recoveryFlow ?? null,
    assignedAt: nextAssignedUserId ? new Date().toISOString() : null,
    agentRemark: agentRemark ?? lead.agentRemark,
    customerRemark: customerRemark ?? lead.customerRemark,
    customerFeedback: lead.customerFeedback,
    sentimentScore: lead.sentimentScore,
    workflowRequired: nextWorkflowRequired,
  });

  if (lead.leadType === "rsa") {
    const inspectionPayload = parseRsaInspectionPayload(nextWorkflowRequired);
    if (inspectionPayload) {
      try {
        await upsertRsaInspectionRow({ companyId, leadId: id, payload: inspectionPayload });
      } catch (err) {
        console.error("Failed to upsert rsa_inspections row", err);
      }
    }
  }

  if (ownerId && ownerId !== lead.agentEmployeeId) {
    // simple owner update
    const sqlMod = await import("@repo/ai-core/db");
    const sql = sqlMod.getSql();
    await sql`UPDATE leads SET agent_employee_id = ${ownerId} WHERE company_id = ${companyId} AND id = ${id}`;
  }

  const updated = await getLeadById(companyId, id);
  if (updated) {
    const stageChanged = String(lead.leadStage ?? "") !== String(updated.leadStage ?? "");
    const statusChanged = String(lead.leadStatus ?? "") !== String(updated.leadStatus ?? "");
    const requiredChanged =
      workflowRequired !== undefined &&
      JSON.stringify((lead as any).workflowRequired ?? null) !== JSON.stringify((updated as any).workflowRequired ?? null);
    if (stageChanged || statusChanged || requiredChanged) {
      await appendLeadEvent({
        companyId,
        leadId: id,
        actorUserId: currentUserId ?? null,
        eventType: "workflow_step_updated",
        eventPayload: {
          from: {
            stage: lead.leadStage ?? null,
            status: lead.leadStatus ?? null,
            required: (lead as any).workflowRequired ?? null,
          },
          to: {
            stage: updated.leadStage ?? null,
            status: updated.leadStatus ?? null,
            required: (updated as any).workflowRequired ?? null,
          },
        },
      });
    }
  }
  if (updated && branchChanged) {
    await appendLeadEvent({
      companyId,
      leadId: id,
      eventType: "branch_updated",
      eventPayload: { from: lead.branchId ?? null, to: updated.branchId ?? null },
    });
  }

  if (assignmentRequested) {
    try {
      const existing = await getLatestInspectionForLead(companyId, id);
      if (!existing) {
        await createInspection({
          companyId,
          leadId: id,
          carId: lead.carId ?? null,
          customerId: lead.customerId ?? null,
          branchId: branchIdFromBody ?? null,
          status: "pending",
        });
      } else {
        const sql = getSql();
        await sql/* sql */ `
          UPDATE inspections
          SET status = 'cancelled',
              cancelled_by = ${currentUserId ?? null},
              cancelled_at = ${new Date().toISOString()},
              cancel_remarks = ${"Inspection reassigned to another workshop/branch."}
          WHERE company_id = ${companyId} AND id = ${existing.id}
        `;
        await createInspection({
          companyId,
          leadId: id,
          carId: lead.carId ?? null,
          customerId: lead.customerId ?? null,
          branchId: branchIdFromBody ?? null,
          status: "pending",
        });

      }
    } catch (err) {
      console.error("Failed to create inspection after assignment", err);
    }
  }

  // If workshop lead gets a branch and has a pickup, update linked recovery pickup lead drop-off to that branch
  if (lead.leadType === "workshop" && branchIdFromBody) {
    try {
      const sql = getSql();
      const branchRows = await sql/* sql */ `
        SELECT id, display_name, name, code, address_line1, google_location
        FROM branches
        WHERE company_id = ${companyId} AND id = ${branchIdFromBody}
        LIMIT 1
      `;
      const branch = branchRows[0];
      const branchLocation =
        branch?.address_line1 ??
        branch?.display_name ??
        branch?.name ??
        branch?.code ??
        branchIdFromBody;
      const branchGoogle = branch?.google_location ?? branchLocation;

      const recoveryRows = await sql/* sql */ `
        SELECT id
        FROM leads
        WHERE company_id = ${companyId}
          AND lead_type = 'recovery'
          AND source = 'workshop_pickup'
          AND (dropoff_to IS NULL OR dropoff_to = '' OR branch_id IS NULL)
      `;
      for (const row of recoveryRows) {
        const recoveryId = row.id as string;
        await updateLeadPartial(companyId, recoveryId, {
          dropoffTo: branchLocation,
          dropoffGoogleLocation: branchGoogle,
          recoveryFlow: "customer_to_branch",
        });
      }
    } catch (err) {
      console.error("Failed to update linked recovery lead drop-off", err);
    }
  }

  // If workshop lead is unassigned from a branch, clear drop-off for linked recovery pickup leads that pointed to that branch
  if (lead.leadType === "workshop" && branchIdFromBody === null && lead.branchId) {
    try {
      const sql = getSql();
      const branchRows = await sql/* sql */ `
        SELECT id, display_name, name, code, address_line1, google_location
        FROM branches
        WHERE company_id = ${companyId} AND id = ${lead.branchId}
        LIMIT 1
      `;
      const branch = branchRows[0];
      const branchLocation =
        branch?.address_line1 ??
        branch?.display_name ??
        branch?.name ??
        branch?.code ??
        lead.branchId;
      const branchGoogle = branch?.google_location ?? null;

      const recoveryRows = await sql/* sql */ `
        SELECT id
        FROM leads
        WHERE company_id = ${companyId}
          AND lead_type = 'recovery'
          AND source = 'workshop_pickup'
          AND (
            dropoff_to = ${branchLocation} OR dropoff_google_location = ${branchGoogle} OR branch_id = ${lead.branchId}
          )
      `;

      for (const row of recoveryRows) {
        const recoveryId = row.id as string;
        await updateLeadPartial(companyId, recoveryId, {
          dropoffTo: null,
          dropoffGoogleLocation: null,
        });
      }
    } catch (err) {
      console.error("Failed to clear linked recovery lead drop-off after unassigning branch", err);
    }
  }

  return NextResponse.json({ data: updated });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return PUT(req, { params });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { companyId, id } = await params;
  const { searchParams } = new URL(req.url);
  const archive = searchParams.get("archive") === "true";

  const lead = await getLeadById(companyId, id);
  if (!lead) return new NextResponse("Not found", { status: 404 });

  if (archive) {
    await updateLeadPartial(companyId, id, { isArchived: true });
    const updated = await getLeadById(companyId, id);
    return NextResponse.json({ data: updated });
  }

  await deleteLead(companyId, id);
  return NextResponse.json({ success: true });
}
