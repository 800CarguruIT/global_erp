"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Lead, LeadEvent, LeadStatus } from "@repo/ai-core/crm/leads/types";
import { LeadTypeBadge, LeadStatusBadge, LeadHealthBadge } from "../components/leads/LeadBadges";
import { LeadTimeline } from "../components/leads/LeadTimeline";
import { Card } from "../components/Card";
import { FileUploader } from "../components/FileUploader";

type LeadDetailMainProps = {
  companyId: string;
  leadId: string;
  onDeleted?: () => void;
  showDeleteActions?: boolean;
  useSectionCards?: boolean;
  showAcceptAction?: boolean;
  showCheckinAction?: boolean;
  showSaveAction?: boolean;
  timelineMode?: "events" | "status";
  currentBranchId?: string | null;
  timelineCutoff?: "accepted" | null;
  timelineVariant?: "default" | "centered";
};

type ParsedAutoNotes = {
  flow?: string;
  appointment?: string;
  visit?: string;
  pickupFrom?: string;
  inquiry?: string;
  recoveryLead?: string;
  location?: string;
};

type ProcessJobLineItem = {
  id: string;
  name: string;
  quantity: string;
  price: string;
  pictureFileId: string;
};

const TYRE_SIZE_OPTIONS = [
  "195/65R15",
  "205/55R16",
  "215/55R17",
  "225/45R17",
  "225/55R18",
  "235/55R19",
  "245/45R19",
];

const INSPECTION_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const INSPECTION_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const INSPECTION_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const INSPECTION_VIDEO_MAX_SIZE_BYTES = 120 * 1024 * 1024;
const AUTOSAVE_INTERVAL_MS = 5000;
const ENABLE_INSPECTION_LIVE_MEDIA_CHECK = false;
const PROCESS_JOB_VAT_RATE = 0.05;

type InspectionFieldKey =
  | "photoFront"
  | "photoLeft"
  | "photoRight"
  | "photoRear"
  | "video360"
  | "cluster"
  | "vin"
  | "make"
  | "model"
  | "year"
  | "plate"
  | "tyreSizeFront"
  | "tyreSizeRear"
  | "mileage"
  | "healthBattery"
  | "healthStarter"
  | "healthObd"
  | "healthBatterySize"
  | "healthBatteryPhoto"
  | "healthObdReportPhoto";

type InspectionFieldErrors = Partial<Record<InspectionFieldKey, string>>;

function parseLegacyMakeModelYearPlate(value: string): {
  make: string;
  model: string;
  year: string;
  plate: string;
} {
  const raw = String(value ?? "").trim();
  if (!raw) return { make: "", model: "", year: "", plate: "" };
  const [left, platePart = ""] = raw.split("-").map((s) => s.trim());
  const [make = "", model = "", year = ""] = left.split("/").map((s) => s.trim());
  return { make, model, year, plate: platePart };
}

function normalizeTyreSizePair(frontRaw: unknown, rearRaw: unknown, legacyRaw: unknown): { front: string; rear: string } {
  const front = String(frontRaw ?? "").trim();
  const rear = String(rearRaw ?? "").trim();
  const legacy = String(legacyRaw ?? "").trim();
  if (front || rear) {
    return {
      front: front || legacy,
      rear: rear || legacy,
    };
  }
  return {
    front: legacy,
    rear: legacy,
  };
}

function formatTyreSize(frontRaw: string, rearRaw: string): string {
  const front = String(frontRaw ?? "").trim();
  const rear = String(rearRaw ?? "").trim();
  if (!front && !rear) return "";
  if (!rear || rear === front) return front;
  return `${front} | ${rear}`;
}

function parseAutoAgentNotes(raw: string | null | undefined): { cleanedRemark: string; notes: ParsedAutoNotes } {
  if (!raw) return { cleanedRemark: "", notes: {} };
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  const notes: ParsedAutoNotes = {};
  const remaining: string[] = [];

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith("flow:")) {
      notes.flow = part.replace(/flow:\s*/i, "").trim();
      continue;
    }
    if (lower.startsWith("appointment:")) {
      notes.appointment = part.replace(/appointment:\s*/i, "").trim();
      continue;
    }
    if (lower.startsWith("visit:")) {
      notes.visit = part.replace(/visit:\s*/i, "").trim();
      continue;
    }
    if (lower.startsWith("pickup from:")) {
      notes.pickupFrom = part.replace(/pickup from:\s*/i, "").trim();
      continue;
    }
    if (lower.startsWith("inquiry:")) {
      notes.inquiry = part.replace(/inquiry:\s*/i, "").trim();
      continue;
    }
    const recoveryMatch = part.match(/pickup recovery lead\s+([a-z0-9]+)/i);
    if (recoveryMatch) {
      notes.recoveryLead = recoveryMatch[1];
      continue;
    }
    if (lower.startsWith("location:")) {
      notes.location = part.replace(/location:\s*/i, "").trim();
      continue;
    }
    remaining.push(part);
  }

  return { cleanedRemark: remaining.join(" | ").trim(), notes };
}

function deriveRecoveryDirection(lead: any, autoNotes: ParsedAutoNotes | null): string {
  if (lead.recoveryDirection) return lead.recoveryDirection;
  if (lead.leadType === "workshop" && (lead.pickupFrom || autoNotes?.pickupFrom)) return "pickup";
  return "-";
}

function deriveRecoveryFlow(lead: any, autoNotes: ParsedAutoNotes | null): string {
  if (lead.recoveryFlow) return lead.recoveryFlow;
  if (lead.leadType === "workshop" && (lead.pickupFrom || autoNotes?.pickupFrom)) return "customer_to_branch";
  return "-";
}

function decodeVinDetails(vinRaw: string): { make: string; year: string } {
  const vin = vinRaw.trim().toUpperCase();
  if (vin.length < 10) return { make: "", year: "" };
  const wmi = vin.slice(0, 3);
  const makeMap: Record<string, string> = {
    WBA: "BMW",
    WBS: "BMW",
    WAU: "Audi",
    WVG: "Volkswagen",
    JHM: "Honda",
    JTD: "Toyota",
    JTE: "Toyota",
    JN1: "Nissan",
    KMH: "Hyundai",
    KNA: "Kia",
    KNM: "Renault Samsung",
    SAL: "Land Rover",
    SAJ: "Jaguar",
    "1HG": "Honda",
    "1FA": "Ford",
    "1FT": "Ford",
    "1C4": "Jeep",
    "2HG": "Honda",
    "2T3": "Toyota",
    "3FA": "Ford",
    "3VW": "Volkswagen",
    "4T1": "Toyota",
    "5NPE": "Hyundai",
    "5XY": "Kia",
    VF1: "Renault",
    YV1: "Volvo",
    ZFA: "Fiat",
  };

  const yearCode = vin.charAt(9);
  const yearCodes = "ABCDEFGHJKLMNPRSTVWXY123456789";
  const idx = yearCodes.indexOf(yearCode);
  const year = idx >= 0 ? String(2010 + idx) : "";

  return { make: makeMap[wmi] ?? "", year };
}

function ratingChipClass(value: string, activeValue: string): string {
  const active = value === activeValue;
  if (activeValue === "good" || activeValue === "normal" || activeValue === "clear") {
    return active ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200" : "border-white/20";
  }
  if (activeValue === "weak" || activeValue === "slow" || activeValue === "minor") {
    return active ? "border-amber-400/60 bg-amber-500/20 text-amber-200" : "border-white/20";
  }
  return active ? "border-rose-400/60 bg-rose-500/20 text-rose-200" : "border-white/20";
}

const chipButtonBaseClass = "rounded-md border px-2 py-1 text-xs uppercase tracking-wide transition-colors hover:border-sky-300/40";

function SignaturePad({
  value,
  onChange,
  height = 140,
}: {
  value: string;
  onChange: (next: string) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hadStrokeRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(event);
    drawingRef.current = true;
    hadStrokeRef.current = false;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    hadStrokeRef.current = true;
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (hadStrokeRef.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={height}
      className="h-36 w-full touch-none rounded-md border border-slate-300 bg-white shadow-inner"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={finishStroke}
    />
  );
}

export function LeadDetailMain({
  companyId,
  leadId,
  onDeleted,
  showDeleteActions = true,
  useSectionCards = false,
  showAcceptAction = false,
  showCheckinAction = false,
  showSaveAction = true,
  timelineMode = "events",
  currentBranchId = null,
  timelineCutoff = null,
  timelineVariant = "default",
}: LeadDetailMainProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [status, setStatus] = useState<LeadStatus | "">("");
  const [stage, setStage] = useState("");
  const [agentRemark, setAgentRemark] = useState("");
  const [customerRemark, setCustomerRemark] = useState("");
  const [autoNotes, setAutoNotes] = useState<ParsedAutoNotes | null>(null);
  const [branchInfo, setBranchInfo] = useState<{ id: string; name?: string; address?: string; google?: string | null } | null>(null);
  const [isReloadingTimeline, setIsReloadingTimeline] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [workflowTabStep, setWorkflowTabStep] = useState(0);
  const [acceptLeadConfirmed, setAcceptLeadConfirmed] = useState(false);
  const [startStepConfirmed, setStartStepConfirmed] = useState(false);
  const [startJobStepConfirmed, setStartJobStepConfirmed] = useState(false);
  const [reachedStepConfirmed, setReachedStepConfirmed] = useState(false);
  const [processJobLineItems, setProcessJobLineItems] = useState<ProcessJobLineItem[]>([]);
  const [processJobPaymentMethod, setProcessJobPaymentMethod] = useState("cash");
  const [processJobPaymentProofFileId, setProcessJobPaymentProofFileId] = useState("");
  const [processJobNotes, setProcessJobNotes] = useState("");
  const [processJobWithVat, setProcessJobWithVat] = useState(true);
  const [preServiceSignatureConfirmed, setPreServiceSignatureConfirmed] = useState(false);
  const [preServiceTermsAccepted, setPreServiceTermsAccepted] = useState(false);
  const [preServiceSignature, setPreServiceSignature] = useState("");
  const [preServiceNotes, setPreServiceNotes] = useState("");
  const [postServiceSignatureConfirmed, setPostServiceSignatureConfirmed] = useState(false);
  const [postServiceTermsAccepted, setPostServiceTermsAccepted] = useState(false);
  const [postServiceSignature, setPostServiceSignature] = useState("");
  const [postServiceChecklistServiceDone, setPostServiceChecklistServiceDone] = useState(false);
  const [postServiceChecklistCleaned, setPostServiceChecklistCleaned] = useState(false);
  const [postServiceChecklistExplained, setPostServiceChecklistExplained] = useState(false);
  const [postServiceChecklistRoadTested, setPostServiceChecklistRoadTested] = useState(false);
  const [postServiceCarStatus, setPostServiceCarStatus] = useState("");
  const [postServiceNotes, setPostServiceNotes] = useState("");
  const [inspectionPhotoFront, setInspectionPhotoFront] = useState("");
  const [inspectionPhotoLeft, setInspectionPhotoLeft] = useState("");
  const [inspectionPhotoRight, setInspectionPhotoRight] = useState("");
  const [inspectionPhotoRear, setInspectionPhotoRear] = useState("");
  const [inspectionVideo360, setInspectionVideo360] = useState("");
  const [inspectionClusterImage, setInspectionClusterImage] = useState("");
  const [inspectionVin, setInspectionVin] = useState("");
  const [inspectionMake, setInspectionMake] = useState("");
  const [inspectionModel, setInspectionModel] = useState("");
  const [inspectionYear, setInspectionYear] = useState("");
  const [inspectionPlate, setInspectionPlate] = useState("");
  const [inspectionTyreSizeFront, setInspectionTyreSizeFront] = useState("");
  const [inspectionTyreSizeRear, setInspectionTyreSizeRear] = useState("");
  const [inspectionMileage, setInspectionMileage] = useState("");
  const [inspectionFieldErrors, setInspectionFieldErrors] = useState<InspectionFieldErrors>({});
  const [inspectionAutoFillNote, setInspectionAutoFillNote] = useState<string | null>(null);
  const [isVinLookupLoading, setIsVinLookupLoading] = useState(false);
  const [inspectionLiveValidationState, setInspectionLiveValidationState] =
    useState<"idle" | "checking" | "pass" | "warn" | "fail">("idle");
  const [inspectionLiveValidationMessage, setInspectionLiveValidationMessage] = useState<string | null>(null);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [healthBattery, setHealthBattery] = useState("");
  const [healthBatterySize, setHealthBatterySize] = useState("");
  const [healthBatteryPhoto, setHealthBatteryPhoto] = useState("");
  const [healthBatteryVoltage, setHealthBatteryVoltage] = useState("");
  const [healthStarter, setHealthStarter] = useState("");
  const [healthObd, setHealthObd] = useState("");
  const [healthObdReportPhoto, setHealthObdReportPhoto] = useState("");
  const [healthObdCodes, setHealthObdCodes] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [healthBrake, setHealthBrake] = useState("");
  const [healthSuspension, setHealthSuspension] = useState("");
  const [healthEngine, setHealthEngine] = useState("");
  const [healthTransmission, setHealthTransmission] = useState("");
  const [healthAc, setHealthAc] = useState("");
  const [healthLeaks, setHealthLeaks] = useState("");
  const [healthWarningLights, setHealthWarningLights] = useState("");
  const [healthRoadTest, setHealthRoadTest] = useState("");
  const [healthTyreTreadDepth, setHealthTyreTreadDepth] = useState("");
  const [healthNextServiceKm, setHealthNextServiceKm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const lastSavedInspectionSnapshotRef = useRef<string>("");
  const lastLiveValidationSnapshotRef = useRef<string>("");

  const workflowSteps = useMemo(
    () => [
      { title: "Accept lead", stage: "accepted", status: "pending" as LeadStatus },
      { title: "Start", stage: "enroute", status: "pending" as LeadStatus },
      { title: "Reach", stage: "reached", status: "pending" as LeadStatus },
      { title: "Pre-Service Form & Signature", stage: "pre_service_signed", status: "pending" as LeadStatus },
      { title: "Inspection", stage: "inspection_in_progress", status: "pending" as LeadStatus },
      { title: "Start lead job", stage: "job_started", status: "pending" as LeadStatus },
      { title: "Complete job", stage: "completed", status: "pending" as LeadStatus },
      { title: "Post-Service & Signature", stage: "post_service_signed", status: "pending" as LeadStatus },
      { title: "Close lead", stage: "closed", status: "closed_won" as LeadStatus },
    ],
    []
  );

  const applyWorkflowRequiredFromLead = (sourceLead: Lead | null) => {
    const required = ((sourceLead as any)?.workflowRequired ?? {}) as Record<string, unknown>;
    const healthExtra =
      required?.healthExtra && typeof required.healthExtra === "object"
        ? (required.healthExtra as Record<string, unknown>)
        : {};
    const fileIdOrEmpty = (value: unknown) => (typeof value === "string" ? value : "");
    setAcceptLeadConfirmed(Boolean(required?.acceptLeadConfirmed));
    setStartStepConfirmed(Boolean(required?.startStepConfirmed));
    setStartJobStepConfirmed(Boolean(required?.startJobStepConfirmed));
    setReachedStepConfirmed(Boolean(required?.reachedStepConfirmed));
    const savedProcessItems = Array.isArray(required?.processJobLineItems)
      ? (required.processJobLineItems as any[]).map((item, idx) => ({
          id: String(item?.id ?? `item-${idx + 1}`),
          name: String(item?.name ?? ""),
          quantity: String(item?.quantity ?? ""),
          price: String(item?.price ?? ""),
          pictureFileId: String(item?.pictureFileId ?? ""),
        }))
      : [];
    setProcessJobLineItems(savedProcessItems);
    setProcessJobPaymentMethod(String(required?.processJobPaymentMethod ?? "cash"));
    setProcessJobPaymentProofFileId(String(required?.processJobPaymentProofFileId ?? ""));
    setProcessJobNotes(String(required?.processJobNotes ?? ""));
    setProcessJobWithVat(required?.processJobWithVat === undefined ? true : Boolean(required?.processJobWithVat));
    setPreServiceSignatureConfirmed(Boolean(required?.preServiceSignatureConfirmed));
    setPreServiceTermsAccepted(Boolean(required?.preServiceTermsAccepted));
    setPreServiceSignature(String(required?.preServiceSignature ?? ""));
    setPostServiceSignatureConfirmed(Boolean(required?.postServiceSignatureConfirmed));
    setPostServiceTermsAccepted(Boolean(required?.postServiceTermsAccepted));
    setPostServiceSignature(String(required?.postServiceSignature ?? ""));
    setPostServiceChecklistServiceDone(Boolean(required?.postServiceChecklistServiceDone));
    setPostServiceChecklistCleaned(Boolean(required?.postServiceChecklistCleaned));
    setPostServiceChecklistExplained(Boolean(required?.postServiceChecklistExplained));
    setPostServiceChecklistRoadTested(Boolean(required?.postServiceChecklistRoadTested));
    setPostServiceCarStatus(String(required?.postServiceCarStatus ?? ""));
    setPreServiceNotes(String(required?.preServiceNotes ?? ""));
    setPostServiceNotes(String(required?.postServiceNotes ?? ""));
    setInspectionPhotoFront(fileIdOrEmpty(required?.inspectionPhotoFront));
    setInspectionPhotoLeft(fileIdOrEmpty(required?.inspectionPhotoLeft));
    setInspectionPhotoRight(fileIdOrEmpty(required?.inspectionPhotoRight));
    setInspectionPhotoRear(fileIdOrEmpty(required?.inspectionPhotoRear));
    setInspectionVideo360(fileIdOrEmpty(required?.inspectionVideo360));
    setInspectionClusterImage(fileIdOrEmpty(required?.inspectionClusterImage));
    setInspectionVin(String(required?.inspectionVin ?? ""));
    const legacy = parseLegacyMakeModelYearPlate(String(required?.inspectionMakeModelYearPlate ?? ""));
    setInspectionMake(String(required?.inspectionMake ?? legacy.make));
    setInspectionModel(String(required?.inspectionModel ?? legacy.model));
    setInspectionYear(String(required?.inspectionYear ?? legacy.year));
    setInspectionPlate(String(required?.inspectionPlate ?? legacy.plate));
    const tyrePair = normalizeTyreSizePair(
      required?.inspectionTyreSizeFront,
      required?.inspectionTyreSizeRear,
      required?.inspectionTyreSize
    );
    setInspectionTyreSizeFront(tyrePair.front);
    setInspectionTyreSizeRear(tyrePair.rear);
    setInspectionMileage(String(required?.inspectionMileage ?? ""));
    setInspectionFieldErrors({});
    setInspectionAutoFillNote(null);
    setHealthBattery(String(required?.healthBattery ?? ""));
    setHealthBatterySize(String(healthExtra.healthBatterySize ?? required?.healthBatterySize ?? ""));
    setHealthBatteryPhoto(fileIdOrEmpty(healthExtra.healthBatteryPhoto ?? required?.healthBatteryPhoto));
    setHealthBatteryVoltage(String(required?.healthBatteryVoltage ?? ""));
    setHealthStarter(String(required?.healthStarter ?? ""));
    setHealthObd(String(required?.healthObd ?? ""));
    setHealthObdReportPhoto(fileIdOrEmpty(healthExtra.healthObdReportPhoto ?? required?.healthObdReportPhoto));
    setHealthObdCodes(String(required?.healthObdCodes ?? ""));
    setHealthNotes(String(required?.healthNotes ?? ""));
    setHealthBrake(String(healthExtra.healthBrake ?? required?.healthBrake ?? ""));
    setHealthSuspension(String(healthExtra.healthSuspension ?? required?.healthSuspension ?? ""));
    setHealthEngine(String(healthExtra.healthEngine ?? required?.healthEngine ?? ""));
    setHealthTransmission(String(healthExtra.healthTransmission ?? required?.healthTransmission ?? ""));
    setHealthAc(String(healthExtra.healthAc ?? required?.healthAc ?? ""));
    setHealthLeaks(String(healthExtra.healthLeaks ?? required?.healthLeaks ?? ""));
    setHealthWarningLights(String(healthExtra.healthWarningLights ?? required?.healthWarningLights ?? ""));
    setHealthRoadTest(String(healthExtra.healthRoadTest ?? required?.healthRoadTest ?? ""));
    setHealthTyreTreadDepth(String(healthExtra.healthTyreTreadDepth ?? required?.healthTyreTreadDepth ?? ""));
    setHealthNextServiceKm(String(healthExtra.healthNextServiceKm ?? required?.healthNextServiceKm ?? ""));
  };

  const inspectionSnapshotFromLead = (sourceLead: Lead | null) => {
    const required = ((sourceLead as any)?.workflowRequired ?? {}) as Record<string, unknown>;
    const healthExtra =
      required?.healthExtra && typeof required.healthExtra === "object"
        ? (required.healthExtra as Record<string, unknown>)
        : {};
    const legacy = parseLegacyMakeModelYearPlate(String(required?.inspectionMakeModelYearPlate ?? ""));
    return JSON.stringify({
      inspectionPhotoFront: typeof required?.inspectionPhotoFront === "string" ? required.inspectionPhotoFront : "",
      inspectionPhotoLeft: typeof required?.inspectionPhotoLeft === "string" ? required.inspectionPhotoLeft : "",
      inspectionPhotoRight: typeof required?.inspectionPhotoRight === "string" ? required.inspectionPhotoRight : "",
      inspectionPhotoRear: typeof required?.inspectionPhotoRear === "string" ? required.inspectionPhotoRear : "",
      inspectionVideo360: typeof required?.inspectionVideo360 === "string" ? required.inspectionVideo360 : "",
      inspectionClusterImage: typeof required?.inspectionClusterImage === "string" ? required.inspectionClusterImage : "",
      inspectionVin: String(required?.inspectionVin ?? ""),
      inspectionMake: String(required?.inspectionMake ?? legacy.make),
      inspectionModel: String(required?.inspectionModel ?? legacy.model),
      inspectionYear: String(required?.inspectionYear ?? legacy.year),
      inspectionPlate: String(required?.inspectionPlate ?? legacy.plate),
      inspectionTyreSizeFront: normalizeTyreSizePair(
        required?.inspectionTyreSizeFront,
        required?.inspectionTyreSizeRear,
        required?.inspectionTyreSize
      ).front,
      inspectionTyreSizeRear: normalizeTyreSizePair(
        required?.inspectionTyreSizeFront,
        required?.inspectionTyreSizeRear,
        required?.inspectionTyreSize
      ).rear,
      inspectionTyreSize: formatTyreSize(
        normalizeTyreSizePair(required?.inspectionTyreSizeFront, required?.inspectionTyreSizeRear, required?.inspectionTyreSize).front,
        normalizeTyreSizePair(required?.inspectionTyreSizeFront, required?.inspectionTyreSizeRear, required?.inspectionTyreSize).rear
      ),
      inspectionMileage: String(required?.inspectionMileage ?? ""),
      healthBattery: String(required?.healthBattery ?? ""),
      healthBatterySize: String(healthExtra.healthBatterySize ?? required?.healthBatterySize ?? ""),
      healthBatteryPhoto: String(healthExtra.healthBatteryPhoto ?? required?.healthBatteryPhoto ?? ""),
      healthBatteryVoltage: String(required?.healthBatteryVoltage ?? ""),
      healthStarter: String(required?.healthStarter ?? ""),
      healthObd: String(required?.healthObd ?? ""),
      healthObdReportPhoto: String(healthExtra.healthObdReportPhoto ?? required?.healthObdReportPhoto ?? ""),
      healthObdCodes: String(required?.healthObdCodes ?? ""),
      healthNotes: String(required?.healthNotes ?? ""),
      healthBrake: String(healthExtra.healthBrake ?? required?.healthBrake ?? ""),
      healthSuspension: String(healthExtra.healthSuspension ?? required?.healthSuspension ?? ""),
      healthEngine: String(healthExtra.healthEngine ?? required?.healthEngine ?? ""),
      healthTransmission: String(healthExtra.healthTransmission ?? required?.healthTransmission ?? ""),
      healthAc: String(healthExtra.healthAc ?? required?.healthAc ?? ""),
      healthLeaks: String(healthExtra.healthLeaks ?? required?.healthLeaks ?? ""),
      healthWarningLights: String(healthExtra.healthWarningLights ?? required?.healthWarningLights ?? ""),
      healthRoadTest: String(healthExtra.healthRoadTest ?? required?.healthRoadTest ?? ""),
      healthTyreTreadDepth: String(healthExtra.healthTyreTreadDepth ?? required?.healthTyreTreadDepth ?? ""),
      healthNextServiceKm: String(healthExtra.healthNextServiceKm ?? required?.healthNextServiceKm ?? ""),
    });
  };

  const buildInspectionDraftPayload = useCallback(
    () => ({
      inspectionPhotoFront,
      inspectionPhotoLeft,
      inspectionPhotoRight,
      inspectionPhotoRear,
      inspectionVideo360,
      inspectionClusterImage,
      inspectionVin: inspectionVin.trim(),
      inspectionMake: inspectionMake.trim(),
      inspectionModel: inspectionModel.trim(),
      inspectionYear: inspectionYear.trim(),
      inspectionPlate: inspectionPlate.trim(),
      inspectionMakeModelYearPlate: `${inspectionMake.trim()} / ${inspectionModel.trim()} / ${inspectionYear.trim()} - ${inspectionPlate.trim()}`,
      inspectionTyreSizeFront: inspectionTyreSizeFront.trim(),
      inspectionTyreSizeRear: inspectionTyreSizeRear.trim(),
      inspectionTyreSize: formatTyreSize(inspectionTyreSizeFront, inspectionTyreSizeRear),
      inspectionMileage: inspectionMileage.trim(),
      healthBattery,
      healthBatterySize: healthBatterySize.trim(),
      healthBatteryPhoto,
      healthBatteryVoltage: healthBatteryVoltage.trim(),
      healthStarter,
      healthObd,
      healthObdReportPhoto,
      healthObdCodes: healthObdCodes.trim(),
      healthNotes: healthNotes || null,
      healthExtra: {
        healthBrake,
        healthSuspension,
        healthEngine,
        healthTransmission,
        healthAc,
        healthLeaks,
        healthWarningLights,
        healthRoadTest,
        healthTyreTreadDepth: healthTyreTreadDepth.trim(),
        healthNextServiceKm: healthNextServiceKm.trim(),
        healthBatterySize: healthBatterySize.trim(),
        healthBatteryPhoto,
        healthObdReportPhoto,
      },
      updatedAt: new Date().toISOString(),
    }),
    [
      healthBattery,
      healthBatterySize,
      healthBatteryPhoto,
      healthBatteryVoltage,
      healthBrake,
      healthEngine,
      healthLeaks,
      healthNextServiceKm,
      healthNotes,
      healthObd,
      healthObdReportPhoto,
      healthObdCodes,
      healthRoadTest,
      healthStarter,
      healthSuspension,
      healthTransmission,
      healthTyreTreadDepth,
      healthWarningLights,
      healthAc,
      inspectionClusterImage,
      inspectionMake,
      inspectionMileage,
      inspectionModel,
      inspectionPhotoFront,
      inspectionPhotoLeft,
      inspectionPhotoRear,
      inspectionPhotoRight,
      inspectionPlate,
      inspectionTyreSizeFront,
      inspectionTyreSizeRear,
      inspectionVideo360,
      inspectionVin,
      inspectionYear,
    ]
  );

  const inspectionSnapshot = useMemo(
    () =>
      JSON.stringify({
        inspectionPhotoFront,
        inspectionPhotoLeft,
        inspectionPhotoRight,
        inspectionPhotoRear,
        inspectionVideo360,
        inspectionClusterImage,
        inspectionVin,
        inspectionMake,
        inspectionModel,
        inspectionYear,
        inspectionPlate,
        inspectionTyreSizeFront,
        inspectionTyreSizeRear,
        inspectionTyreSize: formatTyreSize(inspectionTyreSizeFront, inspectionTyreSizeRear),
        inspectionMileage,
        healthBattery,
        healthBatterySize,
        healthBatteryPhoto,
        healthBatteryVoltage,
        healthStarter,
        healthObd,
        healthObdReportPhoto,
        healthObdCodes,
        healthNotes,
        healthBrake,
        healthSuspension,
        healthEngine,
        healthTransmission,
        healthAc,
        healthLeaks,
        healthWarningLights,
        healthRoadTest,
        healthTyreTreadDepth,
        healthNextServiceKm,
      }),
    [
      healthBattery,
      healthBatterySize,
      healthBatteryPhoto,
      healthBatteryVoltage,
      healthBrake,
      healthEngine,
      healthLeaks,
      healthNextServiceKm,
      healthNotes,
      healthObd,
      healthObdReportPhoto,
      healthObdCodes,
      healthRoadTest,
      healthStarter,
      healthSuspension,
      healthTransmission,
      healthTyreTreadDepth,
      healthWarningLights,
      healthAc,
      inspectionClusterImage,
      inspectionMake,
      inspectionMileage,
      inspectionModel,
      inspectionPhotoFront,
      inspectionPhotoLeft,
      inspectionPhotoRear,
      inspectionPhotoRight,
      inspectionPlate,
      inspectionTyreSizeFront,
      inspectionTyreSizeRear,
      inspectionVideo360,
      inspectionVin,
      inspectionYear,
    ]
  );

  const validateInspectionStep = (): InspectionFieldErrors => {
    const next: InspectionFieldErrors = {};
    if (!inspectionPhotoFront) next.photoFront = "Front picture is required.";
    if (!inspectionPhotoLeft) next.photoLeft = "Left picture is required.";
    if (!inspectionPhotoRight) next.photoRight = "Right picture is required.";
    if (!inspectionPhotoRear) next.photoRear = "Rear picture is required.";
    if (!inspectionVideo360) next.video360 = "360 video is required.";
    if (!inspectionClusterImage) next.cluster = "Cluster image is required.";
    if (!inspectionVin.trim()) next.vin = "VIN is required.";
    if (!inspectionMake.trim()) next.make = "Make is required.";
    if (!inspectionModel.trim()) next.model = "Model is required.";
    if (!inspectionYear.trim()) next.year = "Year is required.";
    if (!inspectionPlate.trim()) next.plate = "Plate is required.";
    if (!inspectionTyreSizeFront.trim()) next.tyreSizeFront = "Front tyre size is required.";
    if (!inspectionTyreSizeRear.trim()) next.tyreSizeRear = "Rear tyre size is required.";
    if (!inspectionMileage.trim()) next.mileage = "Mileage is required.";
    if (!healthBattery) next.healthBattery = "Battery status is required.";
    if (!healthStarter) next.healthStarter = "Starter status is required.";
    if (!healthBatterySize.trim()) next.healthBatterySize = "Battery size is required.";
    if (!healthBatteryPhoto) next.healthBatteryPhoto = "Battery picture is required.";
    if (!healthObdReportPhoto) next.healthObdReportPhoto = "OBD report picture is required.";
    return next;
  };

  const fetchLeadByUrl = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return (json?.data as Lead) ?? null;
  };

  const fetchEventsByUrl = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    return (json?.data as LeadEvent[]) ?? [];
  };

  useEffect(() => {
    async function loadBranch() {
      if (!companyId) return;
      if (!lead?.branchId) {
        setBranchInfo(null);
        return;
      }
      try {
        const res = await fetch(`/api/company/${companyId}/branches`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const branches = data?.data ?? data?.branches ?? [];
        const match = branches.find((b: any) => b.id === lead.branchId);
        if (match) {
          const address =
            match.google_location ??
            match.address_line1 ??
            match.addressLine1 ??
            match.display_name ??
            match.name ??
            match.code ??
            "";
          const name = match.display_name ?? match.name ?? match.code ?? match.id;
          setBranchInfo({ id: match.id, name, address, google: match.google_location ?? null });
        }
      } catch {
        // ignore
      }
    }
    loadBranch();
  }, [companyId, lead?.branchId]);

  useEffect(() => {
    let cancelled = false;
    async function loadLatestInspection() {
      if (!companyId || !lead?.id) {
        setInspectionId(null);
        return;
      }
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inspections`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const match = rows.find((row: any) => String(row?.leadId ?? "") === lead.id);
        if (!cancelled) {
          setInspectionId(match?.id ? String(match.id) : null);
        }
      } catch {
        // ignore
      }
    }
    loadLatestInspection();
    return () => {
      cancelled = true;
    };
  }, [companyId, lead?.id, lead?.updatedAt]);

  const withFallbackEvents = (currentLead: Lead | null, leadEvents: LeadEvent[]) => {
    if (leadEvents.length) return leadEvents;
    if (!currentLead) return [];
    return [
      {
        id: `synthetic-${currentLead.id}`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        actorName: currentLead.agentName ?? "System",
        eventType: "created",
        eventPayload: {
          leadType: currentLead.leadType,
          leadSource: currentLead.source,
          assignedTo: currentLead.agentName ?? currentLead.agentEmployeeId ?? null,
        },
        createdAt: currentLead.createdAt,
      },
    ];
  };

  const buildStatusTimeline = (currentLead: Lead, leadEvents: LeadEvent[]) => {
    const steps: LeadEvent[] = [];
    const acceptedEvent = leadEvents.find((e) => e.eventType === "accepted");
    const checkinEvent = leadEvents.find((e) => e.eventType === "car_in");
    const branchAssignedEvent = leadEvents.find((e) => e.eventType === "branch_updated");

    steps.push({
      id: `${currentLead.id}-created`,
      leadId: currentLead.id,
      companyId: currentLead.companyId,
      actorUserId: null,
      actorEmployeeId: null,
      eventType: "created",
      eventPayload: { order: 1 },
      createdAt: currentLead.createdAt,
    });

    const hasAssignment =
      currentLead.leadStage === "assigned" ||
      Boolean(currentLead.branchId) ||
      Boolean(currentLead.assignedUserId) ||
      Boolean(currentLead.assignedAt);
    if (hasAssignment) {
      steps.push({
        id: `${currentLead.id}-assigned`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: {
          label: "Assigned",
          actor: branchAssignedEvent?.actorName ?? branchAssignedEvent?.actorUserId ?? null,
          order: 2,
        },
        createdAt: currentLead.assignedAt ?? currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    const acceptedAt =
      (acceptedEvent?.eventPayload?.acceptedAt as string | undefined) ??
      acceptedEvent?.createdAt ??
      (currentLead.leadStatus === "accepted" ? currentLead.updatedAt : undefined);
    if (acceptedAt) {
      steps.push({
        id: `${currentLead.id}-accepted`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "accepted",
        eventPayload: {
          acceptedAt,
          actor: acceptedEvent?.actorName ?? acceptedEvent?.actorUserId ?? null,
          order: 3,
        },
        createdAt: acceptedAt,
      });
    }

    const checkinAt =
      (checkinEvent?.eventPayload?.checkinAt as string | undefined) ??
      checkinEvent?.createdAt ??
      currentLead.checkinAt ??
      (currentLead.leadStatus === "car_in" ? currentLead.updatedAt : undefined);
    if (checkinAt) {
      steps.push({
        id: `${currentLead.id}-car-in`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: {
          label: "Car check-in",
          actor: checkinEvent?.actorName ?? checkinEvent?.actorUserId ?? null,
          order: 4,
        },
        createdAt: checkinAt,
      });
    }

    if (currentLead.leadStatus === "processing") {
      steps.push({
        id: `${currentLead.id}-processing`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: { label: "Processing", order: 5 },
        createdAt: currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    if (["closed", "closed_won", "lost"].includes(currentLead.leadStatus)) {
      const label =
        currentLead.leadStatus === "closed_won"
          ? "Closed / Won"
          : currentLead.leadStatus === "lost"
          ? "Lost"
          : "Closed";
      steps.push({
        id: `${currentLead.id}-closed`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: { label, order: 6 },
        createdAt: currentLead.closedAt ?? currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    return steps;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const salesLeadUrl = `/api/company/${companyId}/sales/leads/${leadId}`;
        const loadedLead = await fetchLeadByUrl(salesLeadUrl);

        if (!loadedLead) {
          throw new Error("Lead not found");
        }

        const loadedEvents = await fetchEventsByUrl(
          `/api/company/${companyId}/crm/leads/${leadId}/events`
        );

        if (!cancelled) {
          setLead(loadedLead);
          setEvents(
            timelineMode === "status"
              ? buildStatusTimeline(loadedLead, loadedEvents)
              : withFallbackEvents(loadedLead, loadedEvents)
          );
          setStatus(loadedLead.leadStatus as LeadStatus);
          setStage(loadedLead.leadStage || "");
          const parsed = parseAutoAgentNotes(loadedLead.agentRemark);
          setAgentRemark(parsed.cleanedRemark);
          setAutoNotes(parsed.notes);
          setCustomerRemark(loadedLead.customerRemark ?? loadedLead.customerFeedback ?? "");
          applyWorkflowRequiredFromLead(loadedLead);
          lastSavedInspectionSnapshotRef.current = inspectionSnapshotFromLead(loadedLead);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError("Failed to load lead information.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, leadId]);

  async function handleSave() {
    if (!lead || !status) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: status,
          leadStage: stage || lead.leadStage,
          agentRemark,
          customerRemark,
          customerFeedback: customerRemark,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Reload lead and events to reflect latest activity/actor info
      setIsReloadingTimeline(true);
      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      setIsReloadingTimeline(false);

      const timelineEvents =
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events);

      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
        applyWorkflowRequiredFromLead(refreshedLead);
        lastSavedInspectionSnapshotRef.current = inspectionSnapshotFromLead(refreshedLead);
      } else {
        setLead((prev) =>
          prev
            ? {
                ...prev,
                leadStatus: status,
                leadStage: stage || prev.leadStage,
                agentRemark,
                customerRemark,
                customerFeedback: customerRemark,
              }
            : prev,
        );
        setAutoNotes(parseAutoAgentNotes(agentRemark).notes);
      }

      setEvents(timelineEvents);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAccept() {
    if (!lead) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/company/${companyId}/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: "accepted",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
        applyWorkflowRequiredFromLead(refreshedLead);
        lastSavedInspectionSnapshotRef.current = inspectionSnapshotFromLead(refreshedLead);
      }
      setEvents(
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError("Failed to accept lead. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCheckin() {
    if (!lead) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/company/${companyId}/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: "car_in",
          checkinAt: new Date().toISOString(),
          branchId: currentBranchId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
      }
      setEvents(
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError("Failed to check in car. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(archive: boolean) {
    if (!lead) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${lead.id}${archive ? "?archive=true" : ""}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed");
      }
      if (onDeleted) {
        onDeleted();
      } else {
        window.location.href = `/company/${companyId}/leads`;
      }
    } catch (err) {
      setDeleteError("Failed to delete/archive lead.");
    } finally {
      setDeleting(false);
    }
  }

  async function applyWorkflowStep(nextStage: string, nextStatus?: LeadStatus, extra?: Record<string, unknown>) {
    if (!lead) return;
    setWorkflowBusy(true);
    setWorkflowError(null);
    try {
      const body: Record<string, unknown> = {
        leadStage: nextStage,
      };
      if (nextStatus) body.leadStatus = nextStatus;
      if (extra) Object.assign(body, extra);

      const res = await fetch(`/api/company/${companyId}/sales/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const rejected = Array.isArray(err?.details?.rejected)
          ? err.details.rejected.map((v: unknown) => String(v ?? "").trim()).filter(Boolean)
          : [];
        const detailText = rejected.length ? ` Rejected: ${rejected.join(", ")}.` : "";
        throw new Error((err?.error ?? "Failed to update workflow step.") + detailText);
      }

      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
      }
      setEvents(
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
      );
      return true;
    } catch (err: any) {
      setWorkflowError(err?.message ?? "Failed to apply workflow step.");
      return false;
    } finally {
      setWorkflowBusy(false);
    }
  }

  const derivedWorkflowStep = useMemo(() => {
    const stage = String(lead?.leadStage ?? "").trim().toLowerCase();
    const statusVal = String(lead?.leadStatus ?? "").trim().toLowerCase();
    // Resume at the next actionable step after refresh.
    if (["closed", "closed_won", "done", "lost"].includes(statusVal) || stage === "closed") return 8;
    if (stage === "post_service_signed") return 8;
    if (stage === "completed") return 7;
    if (stage === "job_started") return 6;
    if (stage === "inspection_in_progress") return 5;
    if (stage === "pre_service_signed") return 4;
    if (stage === "reached") return 3;
    if (stage === "enroute") return 2;
    if (stage === "accepted" || statusVal === "accepted") return 1;
    return 0;
  }, [lead?.leadStage, lead?.leadStatus]);

  useEffect(() => {
    setWorkflowStep(derivedWorkflowStep);
  }, [derivedWorkflowStep]);

  useEffect(() => {
    setWorkflowTabStep(workflowStep);
  }, [workflowStep]);

  const isInspectionDirty = inspectionSnapshot !== lastSavedInspectionSnapshotRef.current;

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isInspectionDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isInspectionDirty]);

  useEffect(() => {
    if (!ENABLE_INSPECTION_LIVE_MEDIA_CHECK) {
      setInspectionLiveValidationState("idle");
      setInspectionLiveValidationMessage(null);
      return;
    }
    if (!lead?.id || workflowTabStep !== 4) return;
    const timer = window.setInterval(async () => {
      if (!isInspectionDirty || workflowBusy) return;
      setIsDraftSaving(true);
      try {
        const currentRequired = (((lead as any)?.workflowRequired ?? {}) as Record<string, unknown>);
        const res = await fetch(`/api/company/${companyId}/sales/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowRequired: {
              ...currentRequired,
              ...buildInspectionDraftPayload(),
            },
          }),
        });
        if (res.ok) {
          lastSavedInspectionSnapshotRef.current = inspectionSnapshot;
          setDraftSavedAt(new Date().toLocaleTimeString());
        }
      } catch {
        // ignore auto-save failures; user can still submit manually
      } finally {
        setIsDraftSaving(false);
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [buildInspectionDraftPayload, companyId, inspectionSnapshot, isInspectionDirty, lead, workflowBusy, workflowTabStep]);

  useEffect(() => {
    if (!lead?.id || workflowTabStep !== 4) return;
    const requiredMedia = {
      inspectionPhotoFront,
      inspectionPhotoLeft,
      inspectionPhotoRight,
      inspectionPhotoRear,
      inspectionClusterImage,
      inspectionVideo360,
    };
    const mediaReady = Object.values(requiredMedia).every((v) => String(v ?? "").trim().length > 0);
    if (!mediaReady) {
      setInspectionLiveValidationState("idle");
      setInspectionLiveValidationMessage(null);
      lastLiveValidationSnapshotRef.current = "";
      return;
    }

    const snapshot = JSON.stringify(requiredMedia);
    if (snapshot === lastLiveValidationSnapshotRef.current) return;

    const timer = window.setTimeout(async () => {
      setInspectionLiveValidationState("checking");
      setInspectionLiveValidationMessage("Checking uploaded media...");
      try {
        const currentRequired = (((lead as any)?.workflowRequired ?? {}) as Record<string, unknown>);
        const res = await fetch(`/api/company/${companyId}/sales/leads/${lead.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            validateInspectionMediaOnly: true,
            workflowRequired: {
              ...currentRequired,
              ...requiredMedia,
            },
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInspectionLiveValidationState("fail");
          setInspectionLiveValidationMessage(String(json?.error ?? "Media validation failed."));
          return;
        }
        if (json?.ok === false && json?.warningOnly) {
          setInspectionLiveValidationState("warn");
          setInspectionLiveValidationMessage(String(json?.error ?? "AI flagged media. You can continue."));
          lastLiveValidationSnapshotRef.current = snapshot;
          return;
        }
        if (json?.ok === true) {
          setInspectionLiveValidationState("pass");
          setInspectionLiveValidationMessage("Media check passed.");
          lastLiveValidationSnapshotRef.current = snapshot;
          return;
        }
        setInspectionLiveValidationState("fail");
        setInspectionLiveValidationMessage(String(json?.error ?? "Media validation failed."));
      } catch {
        setInspectionLiveValidationState("fail");
        setInspectionLiveValidationMessage("Media validation request failed.");
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    companyId,
    inspectionClusterImage,
    inspectionPhotoFront,
    inspectionPhotoLeft,
    inspectionPhotoRear,
    inspectionPhotoRight,
    inspectionVideo360,
    lead,
    workflowTabStep,
  ]);

  const clearInspectionFieldError = (key: InspectionFieldKey) => {
    setInspectionFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const autoFillVehicleFromVin = async () => {
    const vin = inspectionVin.trim().toUpperCase();
    if (!vin) {
      setInspectionAutoFillNote("Enter VIN before auto-fill.");
      return;
    }

    let changed = 0;
    let partsCount: number | null = null;
    setIsVinLookupLoading(true);
    try {
      const res = await fetch(
        `/api/company/${companyId}/sales/leads/${leadId}/vin-lookup?vin=${encodeURIComponent(vin)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(String(err?.error ?? "VIN lookup failed"));
      }
      const json = await res.json().catch(() => ({}));
      const car = json?.data?.car ?? null;
      partsCount =
        typeof json?.data?.partsCount === "number" && Number.isFinite(json.data.partsCount)
          ? json.data.partsCount
          : null;

      const apiMake = String(car?.make ?? "").trim();
      const apiModel = String(car?.model ?? "").trim();
      const apiYear = String(car?.year ?? "").trim();

      if (!inspectionMake.trim() && apiMake) {
        setInspectionMake(apiMake);
        changed += 1;
      }
      if (!inspectionModel.trim() && apiModel) {
        setInspectionModel(apiModel);
        changed += 1;
      }
      if (apiYear && inspectionYear.trim() !== apiYear) {
        setInspectionYear(apiYear);
        changed += 1;
      }
    } catch {
      // Fallback to local decode if temporary VIN API is unavailable.
    } finally {
      setIsVinLookupLoading(false);
    }

    if (changed === 0) {
      const decoded = decodeVinDetails(vin);
      if (!inspectionMake.trim() && decoded.make) {
        setInspectionMake(decoded.make);
        changed += 1;
      }
      if (!inspectionYear.trim() && decoded.year) {
        setInspectionYear(decoded.year);
        changed += 1;
      }
      if (!inspectionModel.trim() && lead?.carModel) {
        setInspectionModel(String(lead.carModel));
        changed += 1;
      }
    }

    if (changed === 0) {
      setInspectionAutoFillNote("VIN auto-fill found no new values.");
    } else if (partsCount !== null) {
      setInspectionAutoFillNote(
        `VIN auto-fill updated ${changed} field${changed > 1 ? "s" : ""}. Loaded ${partsCount} catalog parts.`
      );
    } else {
      setInspectionAutoFillNote(`VIN auto-fill updated ${changed} field${changed > 1 ? "s" : ""}.`);
    }
  };

  const jumpToInspectionField = (key: InspectionFieldKey) => {
    const idMap: Record<InspectionFieldKey, string> = {
      photoFront: "inspection-photo-front",
      photoLeft: "inspection-photo-left",
      photoRight: "inspection-photo-right",
      photoRear: "inspection-photo-rear",
      video360: "inspection-video-360",
      cluster: "inspection-cluster",
      vin: "inspection-vin",
      make: "inspection-make",
      model: "inspection-model",
      year: "inspection-year",
      plate: "inspection-plate",
      tyreSizeFront: "inspection-tyre-size-front",
      tyreSizeRear: "inspection-tyre-size-rear",
      mileage: "inspection-mileage",
      healthBattery: "inspection-health-battery",
      healthStarter: "inspection-health-starter",
      healthObd: "inspection-health-obd",
      healthBatterySize: "inspection-health-battery-size",
      healthBatteryPhoto: "inspection-health-battery-photo",
      healthObdReportPhoto: "inspection-health-obd-report-photo",
    };
    const el = document.getElementById(idMap[key]);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
        el.focus();
      }
    }
  };

  const processJobSubTotal = useMemo(
    () =>
      processJobLineItems.reduce((sum, item) => {
        const qty = Number(item.quantity);
        const price = Number(item.price);
        if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
        return sum + qty * price;
      }, 0),
    [processJobLineItems]
  );
  const processJobVatAmount = useMemo(
    () => (processJobWithVat ? processJobSubTotal * PROCESS_JOB_VAT_RATE : 0),
    [processJobSubTotal, processJobWithVat]
  );
  const processJobGrandTotal = useMemo(
    () => processJobSubTotal + processJobVatAmount,
    [processJobSubTotal, processJobVatAmount]
  );

  const addProcessJobLineItem = () => {
    setProcessJobLineItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name: "",
        quantity: "1",
        price: "",
        pictureFileId: "",
      },
    ]);
  };

  const updateProcessJobLineItem = (id: string, patch: Partial<ProcessJobLineItem>) => {
    setProcessJobLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeProcessJobLineItem = (id: string) => {
    setProcessJobLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  async function submitCurrentWorkflowStep() {
    if (workflowTabStep !== workflowStep) {
      setWorkflowError("You are viewing a previous step. Open the current step tab to continue.");
      return;
    }
    const step = workflowStep;
    const config = workflowSteps[step];
    if (!config || !lead) return;

    const currentRequired = (((lead as any)?.workflowRequired ?? {}) as Record<string, unknown>);

    if (step === 0) {
      if (!acceptLeadConfirmed) {
        setWorkflowError("Confirm acceptance in the form before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          acceptLeadConfirmed: true,
          updatedAt: new Date().toISOString(),
        },
      });
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 3) {
      if (!preServiceTermsAccepted) {
        setWorkflowError("Accept the pre-service terms and conditions before continuing.");
        return;
      }
      if (!preServiceSignature.trim()) {
        setWorkflowError("Capture customer signature before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          preServiceSignatureConfirmed: true,
          preServiceTermsAccepted: true,
          preServiceSignature: preServiceSignature.trim(),
          preServiceNotes: preServiceNotes || null,
          updatedAt: new Date().toISOString(),
        },
        agentRemark: [
          agentRemark,
          preServiceNotes ? `Pre-Service: ${preServiceNotes}` : null,
          "Pre-Service Signature: Captured",
        ]
          .filter(Boolean)
          .join(" | "),
      });
      if (ok) setPreServiceSignatureConfirmed(true);
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 1) {
      if (!startStepConfirmed) {
        setWorkflowError("Confirm start in the form before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          startStepConfirmed: true,
          updatedAt: new Date().toISOString(),
        },
      });
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 2) {
      if (!reachedStepConfirmed) {
        setWorkflowError("Confirm reached in the form before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          reachedStepConfirmed: true,
          updatedAt: new Date().toISOString(),
        },
      });
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 5) {
      if (!startJobStepConfirmed) {
        setWorkflowError("Confirm start lead job in the form before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          startJobStepConfirmed: true,
          updatedAt: new Date().toISOString(),
        },
      });
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 4) {
      const nextErrors = validateInspectionStep();
      setInspectionFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) {
        setWorkflowError("Complete all required inspection fields before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          ...buildInspectionDraftPayload(),
        },
      });
      if (!ok) return;
      setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 6) {
      const normalizedItems = processJobLineItems
        .map((item) => ({
          id: item.id,
          name: item.name.trim(),
          quantity: Number(item.quantity),
          price: Number(item.price),
          pictureFileId: item.pictureFileId.trim(),
        }))
        .filter(
          (item) =>
            item.name.length > 0 &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0 &&
            Number.isFinite(item.price) &&
            item.price > 0 &&
            item.pictureFileId.length > 0
        );
      if (!normalizedItems.length) {
        setWorkflowError("Add at least one valid line item (name, picture, qty, price).");
        return;
      }
      if (!processJobPaymentProofFileId.trim()) {
        setWorkflowError("Upload payment proof picture before completing job.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        completeJobPayload: {
          lineItems: normalizedItems,
          paymentProofFileId: processJobPaymentProofFileId.trim(),
          paymentMethod: processJobPaymentMethod,
          withVat: processJobWithVat,
          vatRate: processJobWithVat ? PROCESS_JOB_VAT_RATE : 0,
          notes: processJobNotes.trim() || null,
        },
        workflowRequired: {
          ...currentRequired,
          processJobLineItems: normalizedItems,
          processJobPaymentProofFileId: processJobPaymentProofFileId.trim(),
          processJobPaymentMethod,
          processJobWithVat,
          processJobVatRate: processJobWithVat ? PROCESS_JOB_VAT_RATE : 0,
          processJobSubTotal,
          processJobVatAmount,
          processJobPaymentAmount: processJobGrandTotal,
          processJobNotes: processJobNotes.trim() || null,
          updatedAt: new Date().toISOString(),
        },
      });
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    if (step === 7) {
      if (!postServiceTermsAccepted) {
        setWorkflowError("Accept the post-service terms and conditions before continuing.");
        return;
      }
      if (!postServiceChecklistServiceDone || !postServiceChecklistCleaned || !postServiceChecklistExplained || !postServiceChecklistRoadTested) {
        setWorkflowError("Complete the customer post-service checklist before continuing.");
        return;
      }
      if (!postServiceCarStatus.trim()) {
        setWorkflowError("Select car status before continuing.");
        return;
      }
      if (!postServiceSignature.trim()) {
        setWorkflowError("Capture customer signature before continuing.");
        return;
      }
      const ok = await applyWorkflowStep(config.stage, config.status, {
        workflowRequired: {
          ...currentRequired,
          postServiceSignatureConfirmed: true,
          postServiceTermsAccepted: true,
          postServiceSignature: postServiceSignature.trim(),
          postServiceChecklistServiceDone,
          postServiceChecklistCleaned,
          postServiceChecklistExplained,
          postServiceChecklistRoadTested,
          postServiceCarStatus: postServiceCarStatus.trim(),
          postServiceNotes: postServiceNotes.trim() || null,
          updatedAt: new Date().toISOString(),
        },
        customerRemark: [
          customerRemark,
          postServiceNotes ? `Post-Service: ${postServiceNotes}` : null,
          `Car Status: ${postServiceCarStatus.trim()}`,
          "Post-Service Signature: Captured",
        ].filter(Boolean).join(" | "),
      });
      if (ok) setPostServiceSignatureConfirmed(true);
      if (ok) setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
      return;
    }

    const ok = await applyWorkflowStep(config.stage, config.status);
    if (ok && step < workflowSteps.length - 1) {
      setWorkflowStep((prev) => Math.min(prev + 1, workflowSteps.length - 1));
    }
  }

  if (isLoading && !lead) {
    return (
      <MainPageShell title="Lead" subtitle="Loading lead details..." scopeLabel="Company workspace">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </MainPageShell>
    );
  }

  if (loadError || !lead) {
    return (
      <MainPageShell title="Lead" subtitle="Could not load this lead." scopeLabel="Company workspace">
        <p className="text-sm text-destructive">{loadError || "Lead not found."}</p>
      </MainPageShell>
    );
  }

  const displayRecoveryDirection = deriveRecoveryDirection(lead, autoNotes);
  const displayRecoveryFlow = deriveRecoveryFlow(lead, autoNotes);
  const activeWorkflowStep = workflowTabStep;
  const viewingPreviousWorkflowStep = activeWorkflowStep < workflowStep;
  const inspectionChecks = [
    { key: "photoFront" as const, label: "Front picture", done: Boolean(inspectionPhotoFront) },
    { key: "photoLeft" as const, label: "Left picture", done: Boolean(inspectionPhotoLeft) },
    { key: "photoRight" as const, label: "Right picture", done: Boolean(inspectionPhotoRight) },
    { key: "photoRear" as const, label: "Rear picture", done: Boolean(inspectionPhotoRear) },
    { key: "video360" as const, label: "360 video", done: Boolean(inspectionVideo360) },
    { key: "cluster" as const, label: "Cluster image", done: Boolean(inspectionClusterImage) },
    { key: "vin" as const, label: "VIN", done: Boolean(inspectionVin.trim()) },
    { key: "make" as const, label: "Make", done: Boolean(inspectionMake.trim()) },
    { key: "model" as const, label: "Model", done: Boolean(inspectionModel.trim()) },
    { key: "year" as const, label: "Year", done: Boolean(inspectionYear.trim()) },
    { key: "plate" as const, label: "Plate", done: Boolean(inspectionPlate.trim()) },
    { key: "tyreSizeFront" as const, label: "Front tyre size", done: Boolean(inspectionTyreSizeFront.trim()) },
    { key: "tyreSizeRear" as const, label: "Rear tyre size", done: Boolean(inspectionTyreSizeRear.trim()) },
    { key: "mileage" as const, label: "Mileage", done: Boolean(inspectionMileage.trim()) },
    { key: "healthBattery" as const, label: "Battery", done: Boolean(healthBattery) },
    { key: "healthStarter" as const, label: "Starter", done: Boolean(healthStarter) },
    { key: "healthBatterySize" as const, label: "Battery size", done: Boolean(healthBatterySize.trim()) },
    { key: "healthBatteryPhoto" as const, label: "Battery picture", done: Boolean(healthBatteryPhoto) },
    { key: "healthObdReportPhoto" as const, label: "OBD report picture", done: Boolean(healthObdReportPhoto) },
  ];
  const inspectionCompletedCount = inspectionChecks.filter((item) => item.done).length;
  const inspectionMissing = inspectionChecks.filter((item) => !item.done);
  const healthSelectionCount = [
    healthBattery,
    healthStarter,
    healthBatterySize.trim(),
    healthBatteryPhoto,
    healthObdReportPhoto,
  ].filter(Boolean).length;

  if (lead.leadType === "rsa") {
    return (
      <MainPageShell
        title="Lead Workflow"
        subtitle="Run RSA lead through the required steps."
        scopeLabel="Company workspace"
        contentClassName="border-0 p-0 bg-transparent"
        secondaryActions={
          <>
            {workflowError ? <span className="text-xs text-destructive">{workflowError}</span> : null}
            {saveError ? <span className="text-xs text-destructive">{saveError}</span> : null}
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Lead Workflow (Multi-Step)</h2>
                  <div className="text-xs text-muted-foreground">Call ID: {lead.id.slice(0, 12)}</div>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max items-center gap-2">
                    {workflowSteps.map((step, idx) => (
                      <React.Fragment key={step.stage}>
                        <div
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition ${
                            idx < workflowStep
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                              : idx === activeWorkflowStep
                              ? "border-sky-400/60 bg-sky-500/15 text-sky-300"
                              : "border-white/15 bg-white/5 text-slate-300"
                          }`}
                        >
                          <button
                            type="button"
                            disabled={idx > workflowStep}
                            onClick={() => setWorkflowTabStep(idx)}
                            className="disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {idx + 1}. {step.title}
                          </button>
                        </div>
                        {idx < workflowSteps.length - 1 ? (
                          <span
                            className={`text-[10px] ${
                              idx < workflowStep ? "text-emerald-300/80" : "text-slate-500"
                            }`}
                          >
                            ?
                          </span>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-medium">
                    Step {activeWorkflowStep + 1}: {workflowSteps[activeWorkflowStep]?.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Complete this step, then continue to the next one.
                  </div>
                  {viewingPreviousWorkflowStep ? (
                    <div className="mt-2 text-xs text-amber-300">Viewing a previous step. Current step tab is required to submit.</div>
                  ) : null}

                  {activeWorkflowStep === 0 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={acceptLeadConfirmed}
                          onChange={(e) => setAcceptLeadConfirmed(e.target.checked)}
                        />
                        I confirm this lead is accepted
                      </label>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 1 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={startStepConfirmed}
                          onChange={(e) => setStartStepConfirmed(e.target.checked)}
                        />
                        I confirm technician started this lead
                      </label>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 2 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={reachedStepConfirmed}
                          onChange={(e) => setReachedStepConfirmed(e.target.checked)}
                        />
                        I confirm technician has reached customer location
                      </label>
                      <div className="mt-2 rounded-md border border-dashed border-white/20 bg-white/5 p-3">
                        <div className="text-xs font-medium text-foreground">Map (Placeholder)</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Live map/location pin will appear here.
                        </div>
                        <div className="mt-2 h-32 rounded-md border border-white/10 bg-gradient-to-br from-slate-900/70 to-slate-800/40 p-2">
                          <div className="flex h-full items-center justify-center text-[11px] text-slate-300">
                            No live GPS connected yet
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Caller/lead location: {autoNotes?.location || lead.pickupFrom || lead.dropoffTo || "-"}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 3 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={preServiceTermsAccepted}
                          onChange={(e) => setPreServiceTermsAccepted(e.target.checked)}
                        />
                        I accept the pre-service terms and conditions
                      </label>
                      <div className="rounded-md border border-dashed border-slate-400/70 bg-slate-900/30 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Terms & Conditions</div>
                        <p className="mt-1 text-xs text-slate-200">
                          I authorize inspection/initial pre-service checks and approve recording findings before service starts.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Customer Signature</div>
                        <SignaturePad value={preServiceSignature} onChange={setPreServiceSignature} />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setPreServiceSignature("")}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
                          >
                            Clear Signature
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={preServiceNotes}
                        onChange={(e) => setPreServiceNotes(e.target.value)}
                        placeholder="Pre-service notes (optional)"
                        className="h-20 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={workflowBusy}
                        onClick={() => void submitCurrentWorkflowStep()}
                        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        Submit Pre-Service Form
                      </button>
                      {preServiceSignatureConfirmed ? (
                        <div className="text-[11px] text-emerald-500">Pre-service form submitted.</div>
                      ) : null}
                    </div>
                  ) : null}

                  {activeWorkflowStep === 4 ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">
                            Completed {inspectionCompletedCount}/{inspectionChecks.length} required fields
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {isDraftSaving ? "Saving draft..." : draftSavedAt ? `Draft saved at ${draftSavedAt}` : "Draft not saved yet"}
                          </div>
                          {inspectionLiveValidationMessage ? (
                            <div
                              className={`text-[11px] ${
                                inspectionLiveValidationState === "pass"
                                  ? "text-emerald-300"
                                  : inspectionLiveValidationState === "warn"
                                    ? "text-amber-300"
                                    : inspectionLiveValidationState === "checking"
                                      ? "text-sky-300"
                                      : "text-rose-300"
                              }`}
                            >
                              {inspectionLiveValidationMessage}
                            </div>
                          ) : null}
                        </div>
                        {inspectionMissing.length ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-200">
                            <span>Missing:</span>
                            {inspectionMissing.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => jumpToInspectionField(item.key)}
                                className="rounded border border-amber-300/50 px-1.5 py-0.5 hover:bg-amber-300/10"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-emerald-300">All required inspection items completed.</div>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="text-xs font-semibold text-slate-100">Inspection Checklist</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div id="inspection-photo-front">
                            <FileUploader label={`1. Front Picture ${inspectionPhotoFront ? "?" : ""}`} kind="image" value={inspectionPhotoFront || null} onChange={(v) => { setInspectionPhotoFront(v ?? ""); clearInspectionFieldError("photoFront"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoFront ?? null} />
                          </div>
                          <div id="inspection-photo-left">
                            <FileUploader label={`2. Left Picture ${inspectionPhotoLeft ? "?" : ""}`} kind="image" value={inspectionPhotoLeft || null} onChange={(v) => { setInspectionPhotoLeft(v ?? ""); clearInspectionFieldError("photoLeft"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoLeft ?? null} />
                          </div>
                          <div id="inspection-photo-right">
                            <FileUploader label={`3. Right Picture ${inspectionPhotoRight ? "?" : ""}`} kind="image" value={inspectionPhotoRight || null} onChange={(v) => { setInspectionPhotoRight(v ?? ""); clearInspectionFieldError("photoRight"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoRight ?? null} />
                          </div>
                          <div id="inspection-photo-rear">
                            <FileUploader label={`4. Rear Picture ${inspectionPhotoRear ? "?" : ""}`} kind="image" value={inspectionPhotoRear || null} onChange={(v) => { setInspectionPhotoRear(v ?? ""); clearInspectionFieldError("photoRear"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoRear ?? null} />
                          </div>
                          <div id="inspection-video-360" className="md:col-span-2">
                            <FileUploader label={`5. 360 Video ${inspectionVideo360 ? "?" : ""}`} kind="video" value={inspectionVideo360 || null} onChange={(v) => { setInspectionVideo360(v ?? ""); clearInspectionFieldError("video360"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_VIDEO_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_VIDEO_MIME_TYPES} helperText="Allowed: MP4/MOV/WEBM (max 120MB)" externalError={inspectionFieldErrors.video360 ?? null} />
                          </div>
                          <div id="inspection-cluster" className="md:col-span-2">
                            <FileUploader label={`6. Cluster Image (warnings/mileage) ${inspectionClusterImage ? "?" : ""}`} kind="image" value={inspectionClusterImage || null} onChange={(v) => { setInspectionClusterImage(v ?? ""); clearInspectionFieldError("cluster"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.cluster ?? null} />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <input
                            id="inspection-vin"
                            value={inspectionVin}
                            onChange={(e) => {
                              setInspectionVin(e.target.value.toUpperCase());
                              clearInspectionFieldError("vin");
                              setInspectionAutoFillNote(null);
                            }}
                            placeholder="4. Enter Car VIN"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                          {inspectionFieldErrors.vin ? <p className="text-xs text-destructive">{inspectionFieldErrors.vin}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={autoFillVehicleFromVin}
                            disabled={isVinLookupLoading}
                            className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                          >
                            {isVinLookupLoading ? "Fetching VIN..." : "Auto-fill from VIN"}
                          </button>
                          {inspectionAutoFillNote ? <span className="text-xs text-muted-foreground">{inspectionAutoFillNote}</span> : null}
                        </div>
                        <input
                          id="inspection-make"
                          value={inspectionMake}
                          onChange={(e) => {
                            setInspectionMake(e.target.value);
                            clearInspectionFieldError("make");
                          }}
                          placeholder="5a. Car Make"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.make ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.make}</p> : null}
                        <input
                          id="inspection-model"
                          value={inspectionModel}
                          onChange={(e) => {
                            setInspectionModel(e.target.value);
                            clearInspectionFieldError("model");
                          }}
                          placeholder="5b. Car Model"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.model ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.model}</p> : null}
                        <input
                          id="inspection-year"
                          value={inspectionYear}
                          onChange={(e) => {
                            setInspectionYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
                            clearInspectionFieldError("year");
                          }}
                          placeholder="5c. Car Year"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.year ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.year}</p> : null}
                        <input
                          id="inspection-plate"
                          value={inspectionPlate}
                          onChange={(e) => {
                            setInspectionPlate(e.target.value.toUpperCase());
                            clearInspectionFieldError("plate");
                          }}
                          placeholder="5d. Car Plate"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.plate ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.plate}</p> : null}
                        <select
                          id="inspection-tyre-size-front"
                          value={inspectionTyreSizeFront}
                          onChange={(e) => {
                            setInspectionTyreSizeFront(e.target.value);
                            clearInspectionFieldError("tyreSizeFront");
                          }}
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                        >
                          <option value="">6a. Front Tyre Size</option>
                          {TYRE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <select
                          id="inspection-tyre-size-rear"
                          value={inspectionTyreSizeRear}
                          onChange={(e) => {
                            setInspectionTyreSizeRear(e.target.value);
                            clearInspectionFieldError("tyreSizeRear");
                          }}
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                        >
                          <option value="">6b. Rear Tyre Size</option>
                          {TYRE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <input
                          id="inspection-mileage"
                          value={inspectionMileage}
                          onChange={(e) => {
                            setInspectionMileage(e.target.value.replace(/[^\d]/g, ""));
                            clearInspectionFieldError("mileage");
                          }}
                          placeholder="7. Enter Car Mileage"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.tyreSizeFront ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.tyreSizeFront}</p> : null}
                        {inspectionFieldErrors.tyreSizeRear ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.tyreSizeRear}</p> : null}
                        {inspectionFieldErrors.mileage ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.mileage}</p> : null}
                      </div>

                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">8. Car Health Check</div>
                          <div className="rounded border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                            {healthSelectionCount}/5 checks
                          </div>
                        </div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div id="inspection-health-battery">
                            <div className="mb-1 text-xs text-slate-200">Battery Condition</div>
                            <div className="flex flex-wrap gap-2">
                              {["good", "weak", "replace"].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setHealthBattery(value);
                                    clearInspectionFieldError("healthBattery");
                                  }}
                                  className={`${chipButtonBaseClass} ${ratingChipClass(value, healthBattery)}`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                            {inspectionFieldErrors.healthBattery ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthBattery}</p> : null}
                          </div>
                          <div id="inspection-health-starter">
                            <div className="mb-1 text-xs text-slate-200">Starter</div>
                            <div className="flex flex-wrap gap-2">
                              {["normal", "slow", "faulty"].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setHealthStarter(value);
                                    clearInspectionFieldError("healthStarter");
                                  }}
                                  className={`${chipButtonBaseClass} ${ratingChipClass(value, healthStarter)}`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                            {inspectionFieldErrors.healthStarter ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthStarter}</p> : null}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            id="inspection-health-battery-size"
                            value={healthBatterySize}
                            onChange={(e) => {
                              setHealthBatterySize(e.target.value.toUpperCase());
                              clearInspectionFieldError("healthBatterySize");
                            }}
                            placeholder="Battery size (required, e.g. 55D23L)"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                          <input
                            value={healthBatteryVoltage}
                            onChange={(e) => setHealthBatteryVoltage(e.target.value)}
                            placeholder="Battery voltage (optional, e.g. 12.4V)"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                        </div>
                        {inspectionFieldErrors.healthBatterySize ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthBatterySize}</p> : null}
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div id="inspection-health-battery-photo">
                            <FileUploader
                              label={`Battery Picture ${healthBatteryPhoto ? "?" : ""}`}
                              kind="image"
                              value={healthBatteryPhoto || null}
                              onChange={(v) => {
                                setHealthBatteryPhoto(v ?? "");
                                clearInspectionFieldError("healthBatteryPhoto");
                              }}
                              showPreview
                              showFileIdField={false}
                              capture="environment"
                              maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                              acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                              helperText="Upload battery photo (required, max 10MB)"
                              externalError={inspectionFieldErrors.healthBatteryPhoto ?? null}
                            />
                          </div>
                          <div id="inspection-health-obd-report-photo">
                            <FileUploader
                              label={`OBD Report Picture ${healthObdReportPhoto ? "?" : ""}`}
                              kind="image"
                              value={healthObdReportPhoto || null}
                              onChange={(v) => {
                                setHealthObdReportPhoto(v ?? "");
                                clearInspectionFieldError("healthObdReportPhoto");
                              }}
                              showPreview
                              showFileIdField={false}
                              capture="environment"
                              maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                              acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                              helperText="Upload OBD report picture (required, max 10MB)"
                              externalError={inspectionFieldErrors.healthObdReportPhoto ?? null}
                            />
                          </div>
                        </div>
                        <textarea
                          value={healthNotes}
                          onChange={(e) => setHealthNotes(e.target.value)}
                          placeholder="Additional health notes (optional)"
                          className="mt-2 h-16 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 5 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={startJobStepConfirmed}
                          onChange={(e) => setStartJobStepConfirmed(e.target.checked)}
                        />
                        I confirm technician started lead job
                      </label>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 6 ? (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold">Process Job Line Items</div>
                        <button
                          type="button"
                          onClick={addProcessJobLineItem}
                          className="rounded-md border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide hover:bg-white/10"
                        >
                          Add Item
                        </button>
                      </div>
                      {processJobLineItems.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground">No line items yet. Add at least one item.</div>
                      ) : (
                        <div className="space-y-3">
                          {processJobLineItems.map((item, idx) => (
                            <div key={item.id} className="rounded-md border border-white/15 bg-white/5 p-2">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-[11px] font-semibold">Item {idx + 1}</div>
                                <button
                                  type="button"
                                  onClick={() => removeProcessJobLineItem(item.id)}
                                  className="rounded border border-rose-400/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-300 hover:bg-rose-500/10"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                <input
                                  value={item.name}
                                  onChange={(e) => updateProcessJobLineItem(item.id, { name: e.target.value })}
                                  placeholder="Item name"
                                  className="h-9 w-full rounded-md border border-white/20 bg-slate-950/60 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                                />
                                <input
                                  value={item.quantity}
                                  onChange={(e) => updateProcessJobLineItem(item.id, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
                                  placeholder="Quantity"
                                  className="h-9 w-full rounded-md border border-white/20 bg-slate-950/60 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                                />
                                <input
                                  value={item.price}
                                  onChange={(e) => updateProcessJobLineItem(item.id, { price: e.target.value.replace(/[^\d.]/g, "") })}
                                  placeholder="Unit price"
                                  className="h-9 w-full rounded-md border border-white/20 bg-slate-950/60 px-2 text-xs text-slate-100 placeholder:text-slate-500"
                                />
                                <FileUploader
                                  label={`Item Picture ${item.pictureFileId ? "?" : ""}`}
                                  kind="image"
                                  value={item.pictureFileId || null}
                                  onChange={(v) => updateProcessJobLineItem(item.id, { pictureFileId: v ?? "" })}
                                  showPreview
                                  showFileIdField={false}
                                  capture="environment"
                                  maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                                  acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                                  helperText="Required evidence picture"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-md border border-white/15 bg-white/5 p-2">
                        <div className="mb-2 text-xs font-semibold">Collect Payment</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <select
                            value={processJobPaymentMethod}
                            onChange={(e) => setProcessJobPaymentMethod(e.target.value)}
                            className="h-9 w-full rounded-md border border-white/20 bg-slate-950/60 px-2 text-xs text-slate-100"
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="online">Online</option>
                          </select>
                          <label className="flex h-9 items-center gap-2 rounded-md border border-white/15 bg-slate-950/40 px-2 text-xs text-slate-200">
                            <input
                              type="checkbox"
                              checked={processJobWithVat}
                              onChange={(e) => setProcessJobWithVat(e.target.checked)}
                            />
                            With VAT (5%)
                          </label>
                          <div className="md:col-span-2 rounded-md border border-white/15 bg-slate-950/40 p-2 text-xs text-slate-200">
                            <div className="flex items-center justify-between">
                              <span>Subtotal</span>
                              <span>{processJobSubTotal.toFixed(2)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between">
                              <span>VAT ({(PROCESS_JOB_VAT_RATE * 100).toFixed(0)}%)</span>
                              <span>{processJobVatAmount.toFixed(2)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between font-semibold text-slate-100">
                              <span>Total {processJobWithVat ? "(With VAT)" : "(Without VAT)"}</span>
                              <span>{processJobGrandTotal.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <FileUploader
                              label={`Payment Proof Picture ${processJobPaymentProofFileId ? "?" : ""}`}
                              kind="image"
                              value={processJobPaymentProofFileId || null}
                              onChange={(v) => setProcessJobPaymentProofFileId(v ?? "")}
                              showPreview
                              showFileIdField={false}
                              capture="environment"
                              maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                              acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                              helperText="Required payment proof picture"
                            />
                          </div>
                          <textarea
                            value={processJobNotes}
                            onChange={(e) => setProcessJobNotes(e.target.value)}
                            placeholder="Payment notes (optional)"
                            className="md:col-span-2 h-16 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 7 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={postServiceTermsAccepted}
                          onChange={(e) => setPostServiceTermsAccepted(e.target.checked)}
                        />
                        I (customer) accept the post-service terms and conditions
                      </label>
                      <div className="rounded-md border border-dashed border-slate-400/70 bg-slate-900/30 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Terms & Conditions</div>
                        <p className="mt-1 text-xs text-slate-200">
                          I (customer) confirm the service checklist and car condition have been reviewed and accepted.
                        </p>
                      </div>
                      <div className="rounded-md border border-white/15 bg-white/5 p-2">
                        <div className="text-xs font-semibold">Customer Post-Service Checklist</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistServiceDone}
                              onChange={(e) => setPostServiceChecklistServiceDone(e.target.checked)}
                            />
                            I confirm service completed
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistCleaned}
                              onChange={(e) => setPostServiceChecklistCleaned(e.target.checked)}
                            />
                            I confirm car cleaned
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistExplained}
                              onChange={(e) => setPostServiceChecklistExplained(e.target.checked)}
                            />
                            I confirm work explained to me
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistRoadTested}
                              onChange={(e) => setPostServiceChecklistRoadTested(e.target.checked)}
                            />
                            I confirm road-test status explained
                          </label>
                        </div>
                      </div>
                      <select
                        value={postServiceCarStatus}
                        onChange={(e) => setPostServiceCarStatus(e.target.value)}
                        className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                      >
                        <option value="">Select Car Status</option>
                        <option value="ready_for_delivery">Ready for delivery</option>
                        <option value="delivered_to_customer">Delivered to customer</option>
                        <option value="needs_attention">Needs attention / rework</option>
                      </select>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Customer Signature</div>
                        <SignaturePad value={postServiceSignature} onChange={setPostServiceSignature} />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setPostServiceSignature("")}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
                          >
                            Clear Signature
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={postServiceNotes}
                        onChange={(e) => setPostServiceNotes(e.target.value)}
                        placeholder="Post-service notes (optional)"
                        className="h-20 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={workflowBusy || viewingPreviousWorkflowStep}
                        onClick={() => void submitCurrentWorkflowStep()}
                        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        Submit Post-Service Form
                      </button>
                      {viewingPreviousWorkflowStep ? (
                        <div className="text-[11px] text-amber-300">Open the current step tab to submit.</div>
                      ) : null}
                      {workflowError ? <div className="text-[11px] text-destructive">{workflowError}</div> : null}
                      {postServiceSignatureConfirmed ? (
                        <div className="text-[11px] text-emerald-500">Post-service form submitted.</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={workflowBusy || activeWorkflowStep <= 0}
                      onClick={() => setWorkflowTabStep((prev) => Math.max(0, prev - 1))}
                      className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={workflowBusy || viewingPreviousWorkflowStep}
                      onClick={() => void submitCurrentWorkflowStep()}
                      className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      {workflowBusy
                        ? "Processing..."
                        : activeWorkflowStep === workflowSteps.length - 1
                        ? "Submit & Close"
                        : "Save & Next"}
                    </button>
                    {inspectionId ? (
                      <a
                        href={`/company/${companyId}/inspections/${inspectionId}`}
                        className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                      >
                        Open Inspection
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Timeline</h2>
              </div>
              {isReloadingTimeline ? (
                <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
              ) : (
                <LeadTimeline events={events} variant={timelineVariant} />
              )}
            </div>
          </Card>
        </div>
      </MainPageShell>
    );
  }

  return (
    <MainPageShell
      title="Lead Details"
      subtitle="Manage status, remarks and track the full timeline."
      scopeLabel="Company workspace"
      contentClassName="border-0 p-0 bg-transparent"
      primaryAction={
        showSaveAction ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        ) : undefined
      }
      secondaryActions={
        <>
          {saveSuccess && <span className="text-xs text-emerald-600">Saved.</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {deleteError && <span className="text-xs text-destructive">{deleteError}</span>}
          {showAcceptAction && lead?.leadStatus !== "accepted" && lead?.leadStatus !== "car_in" && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={isSaving}
              className="rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
            >
              Accept lead
            </button>
          )}
          {showCheckinAction && lead?.leadStatus === "accepted" && (
            <button
              type="button"
              onClick={handleCheckin}
              disabled={isSaving}
              className="rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
            >
              Car check-in
            </button>
          )}
          {showDeleteActions && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDelete(true)}
                disabled={deleting}
                className="rounded-md border px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
              >
                {deleting ? "Archiving..." : "Archive"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(false)}
                disabled={deleting}
                className="rounded-md border border-destructive px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {lead.leadType === "rsa" ? (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Lead Workflow (Multi-Step)</h2>
                  <div className="text-xs text-muted-foreground">Call ID: {lead.id.slice(0, 12)}</div>
                </div>
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max items-center gap-2">
                    {workflowSteps.map((step, idx) => (
                      <React.Fragment key={step.stage}>
                        <div
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition ${
                            idx < workflowStep
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                              : idx === activeWorkflowStep
                              ? "border-sky-400/60 bg-sky-500/15 text-sky-300"
                              : "border-white/15 bg-white/5 text-slate-300"
                          }`}
                        >
                          <button
                            type="button"
                            disabled={idx > workflowStep}
                            onClick={() => setWorkflowTabStep(idx)}
                            className="disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {idx + 1}. {step.title}
                          </button>
                        </div>
                        {idx < workflowSteps.length - 1 ? (
                          <span
                            className={`text-[10px] ${
                              idx < workflowStep ? "text-emerald-300/80" : "text-slate-500"
                            }`}
                          >
                            ?
                          </span>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-medium">
                    Step {activeWorkflowStep + 1}: {workflowSteps[activeWorkflowStep]?.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Complete this step, then continue to the next one.
                  </div>
                  {viewingPreviousWorkflowStep ? (
                    <div className="mt-2 text-xs text-amber-300">Viewing a previous step. Current step tab is required to submit.</div>
                  ) : null}

                  {activeWorkflowStep === 3 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={preServiceTermsAccepted}
                          onChange={(e) => setPreServiceTermsAccepted(e.target.checked)}
                        />
                        I accept the pre-service terms and conditions
                      </label>
                      <div className="rounded-md border border-dashed border-slate-400/70 bg-slate-900/30 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Terms & Conditions</div>
                        <p className="mt-1 text-xs text-slate-200">
                          I authorize inspection/initial pre-service checks and approve recording findings before service starts.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Customer Signature</div>
                        <SignaturePad value={preServiceSignature} onChange={setPreServiceSignature} />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setPreServiceSignature("")}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
                          >
                            Clear Signature
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={preServiceNotes}
                        onChange={(e) => setPreServiceNotes(e.target.value)}
                        placeholder="Pre-service notes (optional)"
                        className="h-20 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={workflowBusy}
                        onClick={() => void submitCurrentWorkflowStep()}
                        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        Submit Pre-Service Form
                      </button>
                      {preServiceSignatureConfirmed ? (
                        <div className="text-[11px] text-emerald-500">Pre-service form submitted.</div>
                      ) : null}
                    </div>
                  ) : null}

                  {activeWorkflowStep === 4 ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">
                            Completed {inspectionCompletedCount}/{inspectionChecks.length} required fields
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {isDraftSaving ? "Saving draft..." : draftSavedAt ? `Draft saved at ${draftSavedAt}` : "Draft not saved yet"}
                          </div>
                          {inspectionLiveValidationMessage ? (
                            <div
                              className={`text-[11px] ${
                                inspectionLiveValidationState === "pass"
                                  ? "text-emerald-300"
                                  : inspectionLiveValidationState === "warn"
                                    ? "text-amber-300"
                                    : inspectionLiveValidationState === "checking"
                                      ? "text-sky-300"
                                      : "text-rose-300"
                              }`}
                            >
                              {inspectionLiveValidationMessage}
                            </div>
                          ) : null}
                        </div>
                        {inspectionMissing.length ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amber-200">
                            <span>Missing:</span>
                            {inspectionMissing.map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => jumpToInspectionField(item.key)}
                                className="rounded border border-amber-300/50 px-1.5 py-0.5 hover:bg-amber-300/10"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-emerald-300">All required inspection items completed.</div>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="text-xs font-semibold text-slate-100">Inspection Checklist</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div id="inspection-photo-front">
                            <FileUploader label={`1. Front Picture ${inspectionPhotoFront ? "?" : ""}`} kind="image" value={inspectionPhotoFront || null} onChange={(v) => { setInspectionPhotoFront(v ?? ""); clearInspectionFieldError("photoFront"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoFront ?? null} />
                          </div>
                          <div id="inspection-photo-left">
                            <FileUploader label={`2. Left Picture ${inspectionPhotoLeft ? "?" : ""}`} kind="image" value={inspectionPhotoLeft || null} onChange={(v) => { setInspectionPhotoLeft(v ?? ""); clearInspectionFieldError("photoLeft"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoLeft ?? null} />
                          </div>
                          <div id="inspection-photo-right">
                            <FileUploader label={`3. Right Picture ${inspectionPhotoRight ? "?" : ""}`} kind="image" value={inspectionPhotoRight || null} onChange={(v) => { setInspectionPhotoRight(v ?? ""); clearInspectionFieldError("photoRight"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoRight ?? null} />
                          </div>
                          <div id="inspection-photo-rear">
                            <FileUploader label={`4. Rear Picture ${inspectionPhotoRear ? "?" : ""}`} kind="image" value={inspectionPhotoRear || null} onChange={(v) => { setInspectionPhotoRear(v ?? ""); clearInspectionFieldError("photoRear"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.photoRear ?? null} />
                          </div>
                          <div id="inspection-video-360" className="md:col-span-2">
                            <FileUploader label={`5. 360 Video ${inspectionVideo360 ? "?" : ""}`} kind="video" value={inspectionVideo360 || null} onChange={(v) => { setInspectionVideo360(v ?? ""); clearInspectionFieldError("video360"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_VIDEO_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_VIDEO_MIME_TYPES} helperText="Allowed: MP4/MOV/WEBM (max 120MB)" externalError={inspectionFieldErrors.video360 ?? null} />
                          </div>
                          <div id="inspection-cluster" className="md:col-span-2">
                            <FileUploader label={`6. Cluster Image (warnings/mileage) ${inspectionClusterImage ? "?" : ""}`} kind="image" value={inspectionClusterImage || null} onChange={(v) => { setInspectionClusterImage(v ?? ""); clearInspectionFieldError("cluster"); }} showPreview showFileIdField={false} capture="environment" maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES} acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES} helperText="Allowed: JPEG/PNG/WEBP/HEIC (max 10MB)" externalError={inspectionFieldErrors.cluster ?? null} />
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <input
                            value={inspectionVin}
                            onChange={(e) => {
                              setInspectionVin(e.target.value.toUpperCase());
                              clearInspectionFieldError("vin");
                              setInspectionAutoFillNote(null);
                            }}
                            placeholder="4. Enter Car VIN"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                          {inspectionFieldErrors.vin ? <p className="text-xs text-destructive">{inspectionFieldErrors.vin}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={autoFillVehicleFromVin}
                            disabled={isVinLookupLoading}
                            className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                          >
                            {isVinLookupLoading ? "Fetching VIN..." : "Auto-fill from VIN"}
                          </button>
                          {inspectionAutoFillNote ? <span className="text-xs text-muted-foreground">{inspectionAutoFillNote}</span> : null}
                        </div>
                        <input
                          value={inspectionMake}
                          onChange={(e) => {
                            setInspectionMake(e.target.value);
                            clearInspectionFieldError("make");
                          }}
                          placeholder="5a. Car Make"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.make ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.make}</p> : null}
                        <input
                          value={inspectionModel}
                          onChange={(e) => {
                            setInspectionModel(e.target.value);
                            clearInspectionFieldError("model");
                          }}
                          placeholder="5b. Car Model"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.model ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.model}</p> : null}
                        <input
                          value={inspectionYear}
                          onChange={(e) => {
                            setInspectionYear(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
                            clearInspectionFieldError("year");
                          }}
                          placeholder="5c. Car Year"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.year ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.year}</p> : null}
                        <input
                          value={inspectionPlate}
                          onChange={(e) => {
                            setInspectionPlate(e.target.value.toUpperCase());
                            clearInspectionFieldError("plate");
                          }}
                          placeholder="5d. Car Plate"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.plate ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.plate}</p> : null}
                        <select
                          value={inspectionTyreSizeFront}
                          onChange={(e) => {
                            setInspectionTyreSizeFront(e.target.value);
                            clearInspectionFieldError("tyreSizeFront");
                          }}
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                        >
                          <option value="">6a. Front Tyre Size</option>
                          {TYRE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <select
                          value={inspectionTyreSizeRear}
                          onChange={(e) => {
                            setInspectionTyreSizeRear(e.target.value);
                            clearInspectionFieldError("tyreSizeRear");
                          }}
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                        >
                          <option value="">6b. Rear Tyre Size</option>
                          {TYRE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                        <input
                          value={inspectionMileage}
                          onChange={(e) => {
                            setInspectionMileage(e.target.value.replace(/[^\d]/g, ""));
                            clearInspectionFieldError("mileage");
                          }}
                          placeholder="7. Enter Car Mileage"
                          className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                        {inspectionFieldErrors.tyreSizeFront ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.tyreSizeFront}</p> : null}
                        {inspectionFieldErrors.tyreSizeRear ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.tyreSizeRear}</p> : null}
                        {inspectionFieldErrors.mileage ? <p className="-mt-1 text-xs text-destructive">{inspectionFieldErrors.mileage}</p> : null}
                      </div>

                      <div className="rounded-md border border-slate-400/70 bg-slate-900/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">8. Car Health Check</div>
                          <div className="rounded border border-sky-300/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                            {healthSelectionCount}/5 checks
                          </div>
                        </div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div id="inspection-health-battery">
                            <div className="mb-1 text-xs text-slate-200">Battery Condition</div>
                            <div className="flex flex-wrap gap-2">
                              {["good", "weak", "replace"].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setHealthBattery(value);
                                    clearInspectionFieldError("healthBattery");
                                  }}
                                  className={`${chipButtonBaseClass} ${ratingChipClass(value, healthBattery)}`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                            {inspectionFieldErrors.healthBattery ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthBattery}</p> : null}
                          </div>
                          <div id="inspection-health-starter">
                            <div className="mb-1 text-xs text-slate-200">Starter</div>
                            <div className="flex flex-wrap gap-2">
                              {["normal", "slow", "faulty"].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setHealthStarter(value);
                                    clearInspectionFieldError("healthStarter");
                                  }}
                                  className={`${chipButtonBaseClass} ${ratingChipClass(value, healthStarter)}`}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                            {inspectionFieldErrors.healthStarter ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthStarter}</p> : null}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            id="inspection-health-battery-size"
                            value={healthBatterySize}
                            onChange={(e) => {
                              setHealthBatterySize(e.target.value.toUpperCase());
                              clearInspectionFieldError("healthBatterySize");
                            }}
                            placeholder="Battery size (required, e.g. 55D23L)"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                          <input
                            value={healthBatteryVoltage}
                            onChange={(e) => setHealthBatteryVoltage(e.target.value)}
                            placeholder="Battery voltage (optional, e.g. 12.4V)"
                            className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500"
                          />
                        </div>
                        {inspectionFieldErrors.healthBatterySize ? <p className="mt-1 text-xs text-destructive">{inspectionFieldErrors.healthBatterySize}</p> : null}
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div id="inspection-health-battery-photo">
                            <FileUploader
                              label={`Battery Picture ${healthBatteryPhoto ? "?" : ""}`}
                              kind="image"
                              value={healthBatteryPhoto || null}
                              onChange={(v) => {
                                setHealthBatteryPhoto(v ?? "");
                                clearInspectionFieldError("healthBatteryPhoto");
                              }}
                              showPreview
                              showFileIdField={false}
                              capture="environment"
                              maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                              acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                              helperText="Upload battery photo (required, max 10MB)"
                              externalError={inspectionFieldErrors.healthBatteryPhoto ?? null}
                            />
                          </div>
                          <div id="inspection-health-obd-report-photo">
                            <FileUploader
                              label={`OBD Report Picture ${healthObdReportPhoto ? "?" : ""}`}
                              kind="image"
                              value={healthObdReportPhoto || null}
                              onChange={(v) => {
                                setHealthObdReportPhoto(v ?? "");
                                clearInspectionFieldError("healthObdReportPhoto");
                              }}
                              showPreview
                              showFileIdField={false}
                              capture="environment"
                              maxSizeBytes={INSPECTION_IMAGE_MAX_SIZE_BYTES}
                              acceptMimeTypes={INSPECTION_IMAGE_MIME_TYPES}
                              helperText="Upload OBD report picture (required, max 10MB)"
                              externalError={inspectionFieldErrors.healthObdReportPhoto ?? null}
                            />
                          </div>
                        </div>
                        <textarea
                          value={healthNotes}
                          onChange={(e) => setHealthNotes(e.target.value)}
                          placeholder="Additional health notes (optional)"
                          className="mt-2 h-16 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  ) : null}

                  {activeWorkflowStep === 7 ? (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={postServiceTermsAccepted}
                          onChange={(e) => setPostServiceTermsAccepted(e.target.checked)}
                        />
                        I (customer) accept the post-service terms and conditions
                      </label>
                      <div className="rounded-md border border-dashed border-slate-400/70 bg-slate-900/30 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-100">Terms & Conditions</div>
                        <p className="mt-1 text-xs text-slate-200">
                          I (customer) confirm the service checklist and car condition have been reviewed and accepted.
                        </p>
                      </div>
                      <div className="rounded-md border border-white/15 bg-white/5 p-2">
                        <div className="text-xs font-semibold">Customer Post-Service Checklist</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistServiceDone}
                              onChange={(e) => setPostServiceChecklistServiceDone(e.target.checked)}
                            />
                            I confirm service completed
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistCleaned}
                              onChange={(e) => setPostServiceChecklistCleaned(e.target.checked)}
                            />
                            I confirm car cleaned
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistExplained}
                              onChange={(e) => setPostServiceChecklistExplained(e.target.checked)}
                            />
                            I confirm work explained to me
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={postServiceChecklistRoadTested}
                              onChange={(e) => setPostServiceChecklistRoadTested(e.target.checked)}
                            />
                            I confirm road-test status explained
                          </label>
                        </div>
                      </div>
                      <select
                        value={postServiceCarStatus}
                        onChange={(e) => setPostServiceCarStatus(e.target.value)}
                        className="h-10 w-full rounded-md border border-white/20 bg-slate-950/60 px-3 text-xs text-slate-100"
                      >
                        <option value="">Select Car Status</option>
                        <option value="ready_for_delivery">Ready for delivery</option>
                        <option value="delivered_to_customer">Delivered to customer</option>
                        <option value="needs_attention">Needs attention / rework</option>
                      </select>
                      <div className="space-y-1">
                        <div className="text-xs font-medium">Customer Signature</div>
                        <SignaturePad value={postServiceSignature} onChange={setPostServiceSignature} />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setPostServiceSignature("")}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
                          >
                            Clear Signature
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={postServiceNotes}
                        onChange={(e) => setPostServiceNotes(e.target.value)}
                        placeholder="Post-service notes (optional)"
                        className="h-20 w-full rounded-md border border-white/20 bg-slate-950/60 p-2 text-xs text-slate-100 placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        disabled={workflowBusy || viewingPreviousWorkflowStep}
                        onClick={() => void submitCurrentWorkflowStep()}
                        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                      >
                        Submit Post-Service Form
                      </button>
                      {viewingPreviousWorkflowStep ? (
                        <div className="text-[11px] text-amber-300">Open the current step tab to submit.</div>
                      ) : null}
                      {workflowError ? <div className="text-[11px] text-destructive">{workflowError}</div> : null}
                      {postServiceSignatureConfirmed ? (
                        <div className="text-[11px] text-emerald-500">Post-service form submitted.</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={workflowBusy || activeWorkflowStep <= 0}
                      onClick={() => setWorkflowTabStep((prev) => Math.max(0, prev - 1))}
                      className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={workflowBusy || viewingPreviousWorkflowStep}
                      onClick={() => void submitCurrentWorkflowStep()}
                      className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      {workflowBusy
                        ? "Processing..."
                        : activeWorkflowStep === workflowSteps.length - 1
                        ? "Submit & Close"
                        : "Save & Next"}
                    </button>
                    {inspectionId ? (
                      <a
                        href={`/company/${companyId}/inspections/${inspectionId}`}
                        className="rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
                      >
                        Open Inspection
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Current workflow: stage <span className="font-medium text-foreground">{lead.leadStage || "-"}</span>, status{" "}
                  <span className="font-medium text-foreground">{lead.leadStatus || "-"}</span>
                  {inspectionId ? (
                    <>
                      {" "}- Inspection:{" "}
                      <a className="underline hover:text-primary" href={`/company/${companyId}/inspections/${inspectionId}`}>
                        {inspectionId.slice(0, 8)}
                      </a>
                    </>
                  ) : null}
                </div>
                {workflowError ? <div className="text-xs text-destructive">{workflowError}</div> : null}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {useSectionCards ? (
              <>
                <Card className="p-4">
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold">Customer</h2>
                    {lead.customerName ? (
                      <>
                        <div className="text-sm">{lead.customerName}</div>
                        {lead.customerPhone && <div className="text-xs text-muted-foreground">{lead.customerPhone}</div>}
                        {lead.customerEmail && <div className="text-xs text-muted-foreground">{lead.customerEmail}</div>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No customer linked.</p>
                    )}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold">Car</h2>
                    {lead.carPlateNumber ? (
                      <>
                        <div className="text-sm">{lead.carPlateNumber}</div>
                        {lead.carModel && <div className="text-xs text-muted-foreground">{lead.carModel}</div>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">No car linked.</p>
                    )}
                  </div>
                </Card>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Customer</h2>
                  {lead.customerName ? (
                    <>
                      <div className="text-sm">{lead.customerName}</div>
                      {lead.customerPhone && <div className="text-xs text-muted-foreground">{lead.customerPhone}</div>}
                      {lead.customerEmail && <div className="text-xs text-muted-foreground">{lead.customerEmail}</div>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No customer linked.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Car</h2>
                  {lead.carPlateNumber ? (
                    <>
                      <div className="text-sm">{lead.carPlateNumber}</div>
                      {lead.carModel && <div className="text-xs text-muted-foreground">{lead.carModel}</div>}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No car linked.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {useSectionCards ? (
            <Card className="p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1 text-sm">
                  <div className="text-xs text-muted-foreground">Type & Stage</div>
                  <LeadTypeBadge type={lead.leadType as any} />
                  <div className="mt-1">
                    <select
                      className="w-full rounded-md border bg-background p-1 text-xs"
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                    >
                      <option value="">Use current: {lead.leadStage}</option>
                      <option value="new">New</option>
                      <option value="enroute">Enroute</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <LeadStatusBadge status={lead.leadStatus as any} />
                <div className="mt-1">
                <select
                  className="w-full rounded-md border bg-background p-1 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus | "")}
                >
                  <option value="open">Open</option>
                  <option value="accepted">Accepted</option>
                  <option value="car_in">Car In</option>
                  <option value="processing">Processing</option>
                  <option value="closed_won">Closed / Won</option>
                  <option value="lost">Lost</option>
                </select>
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">Source: {lead.source || "Unknown"}</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="text-xs text-muted-foreground">Health</div>
                  <LeadHealthBadge score={lead.healthScore ?? null} />
                  {lead.sentimentScore != null && (
                    <div className="text-xs text-muted-foreground">Sentiment: {lead.sentimentScore}</div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1 text-sm">
                <div className="text-xs text-muted-foreground">Type & Stage</div>
                <LeadTypeBadge type={lead.leadType as any} />
                <div className="mt-1">
                  <select
                    className="w-full rounded-md border bg-background p-1 text-xs"
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                  >
                    <option value="">Use current: {lead.leadStage}</option>
                    <option value="new">New</option>
                    <option value="enroute">Enroute</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-xs text-muted-foreground">Status</div>
                <LeadStatusBadge status={lead.leadStatus as any} />
                <div className="mt-1">
                  <select
                    className="w-full rounded-md border bg-background p-1 text-xs"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LeadStatus | "")}
                  >
                    <option value="open">Open</option>
                    <option value="car_in">Car In</option>
                    <option value="processing">Processing</option>
                    <option value="closed_won">Closed / Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div className="text-xs text-muted-foreground capitalize">Source: {lead.source || "Unknown"}</div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-xs text-muted-foreground">Health</div>
                <LeadHealthBadge score={lead.healthScore ?? null} />
                {lead.sentimentScore != null && (
                  <div className="text-xs text-muted-foreground">Sentiment: {lead.sentimentScore}</div>
                )}
              </div>
            </div>
          )}

          {useSectionCards ? (
            <Card className="p-4">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Lead fields</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: "Lead ID", value: lead.id },
                    { label: "Service type", value: lead.serviceType || "-" },
                    { label: "Branch", value: branchInfo?.name || lead.branchId || "-" },
                    { label: "Recovery direction", value: displayRecoveryDirection },
                    { label: "Recovery flow", value: displayRecoveryFlow },
                    { label: "Pickup from", value: lead.pickupFrom || autoNotes?.pickupFrom || "-" },
                    {
                      label: "Drop-off to",
                      value:
                        lead.dropoffGoogleLocation ||
                        branchInfo?.google ||
                        lead.dropoffTo ||
                        branchInfo?.address ||
                        branchInfo?.name ||
                        "-",
                    },
                    { label: "Assigned user", value: lead.assignedUserId || "-" },
                    { label: "Agent employee", value: lead.agentEmployeeId || "-" },
                    {
                      label: "Created at",
                      value: lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "-",
                    },
                    {
                      label: "Updated at",
                      value: lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : "-",
                    },
                  ].map((item) => (
                    <div key={item.label} className="text-sm">
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="truncate">{item.value}</div>
                    </div>
                  ))}
                  {autoNotes &&
                    (autoNotes.flow ||
                      autoNotes.appointment ||
                      autoNotes.visit ||
                      autoNotes.pickupFrom ||
                      autoNotes.inquiry ||
                      autoNotes.recoveryLead ||
                      autoNotes.location) && (
                      <div className="md:col-span-2">
                        <div className="mt-3 pt-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">Workshop details</div>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            {[
                              { label: "Flow", value: autoNotes.flow },
                              { label: "Appointment", value: autoNotes.appointment },
                              { label: "Visit type", value: autoNotes.visit },
                              { label: "Pickup location", value: autoNotes.pickupFrom },
                              { label: "Inquiry", value: autoNotes.inquiry },
                              { label: "Recovery lead", value: autoNotes.recoveryLead },
                              { label: "Location link", value: autoNotes.location },
                            ]
                              .filter((item) => item.value)
                              .map((item) => (
                                <div key={item.label} className="text-sm">
                                  <div className="text-xs text-muted-foreground">{item.label}</div>
                                  <div className="truncate">{item.value}</div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-2 rounded-md p-3">
              <h2 className="text-sm font-semibold">Lead fields</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: "Lead ID", value: lead.id },
                  { label: "Service type", value: lead.serviceType || "-" },
                  { label: "Branch", value: branchInfo?.name || lead.branchId || "-" },
                  { label: "Recovery direction", value: displayRecoveryDirection },
                  { label: "Recovery flow", value: displayRecoveryFlow },
                  { label: "Pickup from", value: lead.pickupFrom || autoNotes?.pickupFrom || "-" },
                  {
                    label: "Drop-off to",
                    value:
                      lead.dropoffGoogleLocation ||
                      branchInfo?.google ||
                      lead.dropoffTo ||
                      branchInfo?.address ||
                      branchInfo?.name ||
                      "-",
                  },
                  { label: "Assigned user", value: lead.assignedUserId || "-" },
                  { label: "Agent employee", value: lead.agentEmployeeId || "-" },
                  {
                    label: "Created at",
                    value: lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "-",
                  },
                  {
                    label: "Updated at",
                    value: lead.updatedAt ? new Date(lead.updatedAt).toLocaleString() : "-",
                  },
                ].map((item) => (
                  <div key={item.label} className="text-sm">
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="truncate">{item.value}</div>
                  </div>
                ))}
                {autoNotes &&
                  (autoNotes.flow ||
                    autoNotes.appointment ||
                    autoNotes.visit ||
                    autoNotes.pickupFrom ||
                    autoNotes.inquiry ||
                    autoNotes.recoveryLead ||
                    autoNotes.location) && (
                    <div className="md:col-span-2">
                      <div className="mt-3 pt-3">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">Workshop details</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {[
                            { label: "Flow", value: autoNotes.flow },
                            { label: "Appointment", value: autoNotes.appointment },
                            { label: "Visit type", value: autoNotes.visit },
                            { label: "Pickup location", value: autoNotes.pickupFrom },
                            { label: "Inquiry", value: autoNotes.inquiry },
                            { label: "Recovery lead", value: autoNotes.recoveryLead },
                            { label: "Location link", value: autoNotes.location },
                          ]
                            .filter((item) => item.value)
                            .map((item) => (
                              <div key={item.label} className="text-sm">
                                <div className="text-xs text-muted-foreground">{item.label}</div>
                                <div className="truncate">{item.value}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

          {useSectionCards ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Agent remarks</h2>
                  <textarea
                    className="h-24 w-full rounded-md bg-background p-2 text-sm"
                    placeholder="Add or update agent remarks"
                    value={agentRemark}
                    onChange={(e) => setAgentRemark(e.target.value)}
                  />
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Customer remarks / feedback</h2>
                  <textarea
                    className="h-24 w-full rounded-md bg-background p-2 text-sm"
                    placeholder="Customer sentiment / feedback"
                    value={customerRemark}
                    onChange={(e) => setCustomerRemark(e.target.value)}
                  />
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Agent remarks</h2>
                <textarea
                  className="h-24 w-full rounded-md bg-background p-2 text-sm"
                  placeholder="Add or update agent remarks"
                  value={agentRemark}
                  onChange={(e) => setAgentRemark(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Customer remarks / feedback</h2>
                <textarea
                  className="h-24 w-full rounded-md bg-background p-2 text-sm"
                  placeholder="Customer sentiment / feedback"
                  value={customerRemark}
                  onChange={(e) => setCustomerRemark(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {useSectionCards ? (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Timeline</h2>
              </div>
              {isReloadingTimeline ? (
                <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
              ) : (
                <LeadTimeline events={events} variant={timelineVariant} />
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Timeline</h2>
            </div>
            {isReloadingTimeline ? (
              <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
            ) : (
              <LeadTimeline events={events} variant={timelineVariant} />
            )}
          </div>
        )}
      </div>
    </MainPageShell>
  );
}



