"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppLayout, Card, FileUploader, useTheme } from "@repo/ui";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

type Params =
  | { params: { companyId: string; inspectionId: string } }
  | { params: Promise<{ companyId: string; inspectionId: string }> };

type InspectionData = {
  inspection: any;
  items: any[];
  preInspection?: any | null;
  collectCar?: {
    sourceType?: "recovery" | "walkin" | "unknown";
    sourceMedia?: Record<string, string | null>;
    latestReview?: {
      completed?: boolean;
      hasDifference?: boolean;
      note?: string | null;
      reuploadMedia?: Record<string, string | null>;
      reviewedAt?: string | null;
      reviewedBy?: string | null;
    } | null;
    logs?: Array<{
      id?: string;
      hasDifference?: boolean;
      note?: string | null;
      reviewedAt?: string | null;
      reviewedBy?: string | null;
    }>;
  } | null;
};
type InspectionLogEntry = {
  id: string;
  action: string;
  by: string;
  at: string;
  message?: string;
};
type InspectionIssueEntry = {
  id: string;
  description: string;
  imageFileId: string;
};
type VinCatalogPartGroup = {
  id: string;
  level: number;
  name: string;
};
type VinCatalogPart = {
  code: string;
  name: string;
  groups: VinCatalogPartGroup[];
};
type VinCatalogGroupOption = {
  key: string;
  label: string;
  level: number;
};
type LineItemAiAnswerValue = "" | "yes" | "no" | "na";
type LineItemAiQuestion = {
  id: string;
  text: string;
  critical?: boolean;
};
type LineItemAiContext = {
  partName: string;
  partNumber: string;
  groupName: string;
  description: string;
  status: string;
};
type SmartFaultSuggestion = {
  id: string;
  label: string;
  reason: string;
};

type CheckValue = "good" | "avg" | "bad" | "";
type ProcessCheckValue = "ok" | "issue" | "na" | "";
type ProcessCheckKey = "oil" | "battery" | "tyre" | "obd";
type CarMediaKey = "front" | "rear" | "right" | "left" | "video";
type CarMediaReviewStatus = "pending" | "verified" | "rejected";

const checkItems = [
  { key: "engine", label: "Engine" },
  { key: "steering", label: "Steering" },
  { key: "tyres", label: "Tyres" },
  { key: "ac", label: "A/C Cooling" },
  { key: "body", label: "Car Body" },
  { key: "gear", label: "Gear" },
  { key: "suspension", label: "Suspension" },
  { key: "brakes", label: "Brakes" },
  { key: "battery", label: "Battery" },
  { key: "infotainment", label: "Infotainment" },
];

const processCheckItems: Array<{ key: ProcessCheckKey; label: string }> = [
  { key: "oil", label: "Oil Check" },
  { key: "battery", label: "Battery Check" },
  { key: "tyre", label: "Tyre Check" },
  { key: "obd", label: "OBD Check" },
];
const REPORT_CATEGORY_WEIGHTS: Record<string, number> = {
  Engine: 15,
  Transmission: 12,
  Brakes: 16,
  Suspension: 12,
  Steering: 10,
  "Tires & Wheels": 10,
  Electrical: 10,
  "Body & Exterior": 7,
  Interior: 4,
  "Fluids / Maintenance": 4,
};
const lineItemStatusOptions = ["Safety Risk", "Mandatory", "Recommended", "Optional"] as const;
const TYRE_SIZE_OPTIONS = [
  "195/65R15",
  "205/55R16",
  "215/55R17",
  "225/45R17",
  "225/55R18",
  "235/55R19",
  "245/45R19",
];
const carMediaKeys: CarMediaKey[] = ["front", "rear", "right", "left", "video"];
const carMediaRejectReasons = ["Blur", "Wrong angle", "Not same car", "Blocked view", "Poor lighting"];

const preInspectionQuestionLabels: Record<string, string> = {
  q1: "Any performance issue?",
  q2: "Any unusual sound or vibration?",
  q3: "Any warning light on dashboard?",
  q4: "Any fluid leak noticed?",
  q5: "Any urgent priority for inspection?",
};
const formatQuestionKeyLabel = (key: string) =>
  key
    .replace(/^q(\d+)$/i, "Question $1")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isSystemPreInspectionKey = (key: string) => {
  const normalized = key.trim().toLowerCase();
  return (
    normalized === "meta" ||
    normalized === "__meta" ||
    normalized.startsWith("meta_") ||
    normalized.startsWith("__meta") ||
    normalized.includes("signature")
  );
};

const toDisplayText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => toDisplayText(item)).filter(Boolean);
    return items.join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const collectPreInspectionDetails = (value: unknown, path = ""): Array<{ key: string; value: string }> => {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") {
    const text = toDisplayText(value);
    if (!text) return [];
    return [{ key: path || "Answer", value: text }];
  }
  if (Array.isArray(value)) {
    const text = toDisplayText(value);
    if (!text) return [];
    return [{ key: path || "Answer", value: text }];
  }
  const obj = value as Record<string, unknown>;
  return Object.entries(obj).flatMap(([k, v]) => {
    if (k === "choice") return [];
    if (isSystemPreInspectionKey(k)) return [];
    const nextPath = path ? `${path}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return collectPreInspectionDetails(v, nextPath);
    }
    const text = toDisplayText(v);
    if (text.startsWith("data:image/") || text.startsWith("data:video/")) return [];
    if (text.length > 500) return [];
    if (!text) return [];
    return [{ key: nextPath, value: text }];
  });
};

const formatDetailKey = (key: string) =>
  key
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .join(" / ");

export function InspectionDetailPageClient({
  params,
  forceWorkshopView = false,
  workshopBranchIdProp = null,
}: Params & { forceWorkshopView?: boolean; workshopBranchIdProp?: string | null }) {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<any | null>(null);
  const [preInspection, setPreInspection] = useState<any | null>(null);
  const [collectCar, setCollectCar] = useState<InspectionData["collectCar"]>(null);
  const [inspectionStep, setInspectionStep] = useState(1);
  const [collectCarDifference, setCollectCarDifference] = useState<"" | "yes" | "no">("");
  const [collectCarNote, setCollectCarNote] = useState("");
  const [collectCarReuploadMedia, setCollectCarReuploadMedia] = useState<Record<string, string>>({});
  const [collectCarSaving, setCollectCarSaving] = useState(false);
  const [inspectionIssueEntries, setInspectionIssueEntries] = useState<InspectionIssueEntry[]>([]);
  const [isAddingIssueNote, setIsAddingIssueNote] = useState(false);
  const [newIssueNoteDescription, setNewIssueNoteDescription] = useState("");
  const [newIssueNoteImageFileId, setNewIssueNoteImageFileId] = useState("");
  const [processChecks, setProcessChecks] = useState<Record<ProcessCheckKey, ProcessCheckValue>>({
    oil: "",
    battery: "",
    tyre: "",
    obd: "",
  });
  const [processCheckMedia, setProcessCheckMedia] = useState<Record<ProcessCheckKey, string>>({
    oil: "",
    battery: "",
    tyre: "",
    obd: "",
  });
  const [processCheckMediaMulti, setProcessCheckMediaMulti] = useState<Record<ProcessCheckKey, string[]>>({
    oil: [],
    battery: [],
    tyre: [],
    obd: [],
  });
  const [processCheckIssueNotes, setProcessCheckIssueNotes] = useState<Record<ProcessCheckKey, string>>({
    oil: "",
    battery: "",
    tyre: "",
    obd: "",
  });
  const [processCheckUploading, setProcessCheckUploading] = useState<Record<ProcessCheckKey, boolean>>({
    oil: false,
    battery: false,
    tyre: false,
    obd: false,
  });
  const [processMediaVerified, setProcessMediaVerified] = useState<Record<string, boolean>>({
    oil: false,
    battery: false,
    tyre: false,
    obd: false,
  });
  const [carMediaReview, setCarMediaReview] = useState<Record<CarMediaKey, CarMediaReviewStatus>>({
    front: "pending",
    rear: "pending",
    right: "pending",
    left: "pending",
    video: "pending",
  });
  const [carMediaReplacement, setCarMediaReplacement] = useState<Record<CarMediaKey, string>>({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
  });
  const [carMediaRejectReason, setCarMediaRejectReason] = useState<Record<CarMediaKey, string>>({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
  });
  const [carMediaRejectNote, setCarMediaRejectNote] = useState<Record<CarMediaKey, string>>({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
  });
  const [tyreSizeFront, setTyreSizeFront] = useState("");
  const [tyreSizeRear, setTyreSizeRear] = useState("");
  const [clusterImageId, setClusterImageId] = useState("");
  const [inspectionVin, setInspectionVin] = useState("");
  const [inspectionMake, setInspectionMake] = useState("");
  const [inspectionModel, setInspectionModel] = useState("");
  const [inspectionYear, setInspectionYear] = useState("");
  const [vinLookupLoading, setVinLookupLoading] = useState(false);
  const [vinLookupNote, setVinLookupNote] = useState<string | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [car, setCar] = useState<any | null>(null);
  const [leadPlate, setLeadPlate] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [carInVideoId, setCarInVideoId] = useState("");
  const [carOutVideoId, setCarOutVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nextStepSaving, setNextStepSaving] = useState(false);
  const [videoUploading, setVideoUploading] = useState<"in" | "out" | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<Record<"in" | "out", number>>({
    in: 0,
    out: 0,
  });
  const [actorName, setActorName] = useState("System");
  const [inspectionLogs, setInspectionLogs] = useState<InspectionLogEntry[]>([]);
  const [advisorApproved, setAdvisorApproved] = useState(false);
  const [advisorApprovedAt, setAdvisorApprovedAt] = useState<string | null>(null);
  const [advisorApprovedBy, setAdvisorApprovedBy] = useState<string | null>(null);
  const [customerApproved, setCustomerApproved] = useState(false);
  const [customerApprovedAt, setCustomerApprovedAt] = useState<string | null>(null);
  const [customerApprovedBy, setCustomerApprovedBy] = useState<string | null>(null);
  const initialRemarksRef = useRef("");
  const initialStatusRef = useRef("pending");
  const initialPartsSignatureRef = useRef("[]");
  const initialChecksSignatureRef = useRef("{}");
  const autosaveInitializedRef = useRef(false);
  const autosaveLastSignatureRef = useRef("");
  const [form, setForm] = useState({
    advisorName: "",
    inspectorName: "",
    carInMileage: "",
    customerComplain: "",
    inspectorRemarks: "",
  });
  const [products, setProducts] = useState<Array<{ id: number; name: string; cost: number; type: string }>>([]);
  const [productResults, setProductResults] = useState<Array<{ id: number; name: string; cost: number; type: string }>>([]);
  const [productOpenIndex, setProductOpenIndex] = useState<number | null>(null);
  const [vinCatalogParts, setVinCatalogParts] = useState<VinCatalogPart[]>([]);
  const [vinCatalogGroups, setVinCatalogGroups] = useState<VinCatalogGroupOption[]>([]);
  const [vinCatalogLoading, setVinCatalogLoading] = useState(false);
  const vinCatalogLoadedVinRef = useRef("");
  const [checks, setChecks] = useState<Record<string, CheckValue>>({});
  const [lineItemErrors, setLineItemErrors] = useState<Record<number, { part?: string; qty?: string; media?: string }>>(
    {}
  );
  const [parts, setParts] = useState<
    Array<{
      id?: string;
      productId?: number | null;
      productType?: string | null;
      part: string;
      description: string;
      qty: string;
      reason: string;
      catalogGroupKey?: string;
      catalogPartCode?: string;
      clientRowKey?: string;
      partOrdered?: number | null;
      orderStatus?: string | null;

      mediaFileId?: string | null;
      isSaving?: boolean;
      isSaved?: boolean;
    }>
  >([]);
  const [lineItemAiAnswers, setLineItemAiAnswers] = useState<
    Record<string, Record<string, LineItemAiAnswerValue>>
  >({});
  const [lineItemAiQuestionsByRow, setLineItemAiQuestionsByRow] = useState<Record<string, LineItemAiQuestion[]>>({});
  const [lineItemAiRecommendationByRow, setLineItemAiRecommendationByRow] = useState<Record<string, string>>({});
  const [lineItemAiLoadingByRow, setLineItemAiLoadingByRow] = useState<Record<string, boolean>>({});
  const [lineItemSmartSuggestionsByRow, setLineItemSmartSuggestionsByRow] = useState<Record<string, SmartFaultSuggestion[]>>({});
  const [lineItemSmartSuggestionsLoadingByRow, setLineItemSmartSuggestionsLoadingByRow] = useState<Record<string, boolean>>({});
  const [lineItemSmartSuggestionsFetchedByRow, setLineItemSmartSuggestionsFetchedByRow] = useState<Record<string, boolean>>({});
  const [dismissedSmartSuggestionsByRow, setDismissedSmartSuggestionsByRow] = useState<Record<string, string[]>>({});
  const [bulkAddGroupKey, setBulkAddGroupKey] = useState("");
  const [bulkAddPartCodes, setBulkAddPartCodes] = useState<string[]>([]);
  const [bulkPartSearch, setBulkPartSearch] = useState("");
  const [expandedLineItemsByRow, setExpandedLineItemsByRow] = useState<Record<string, boolean>>({});
  const partsRef = useRef<typeof parts>([]);

  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setInspectionId(p?.inspectionId ?? null);
    });
  }, [params]);

  useEffect(() => {
    autosaveInitializedRef.current = false;
    autosaveLastSignatureRef.current = "";
  }, [companyId, inspectionId]);

  useEffect(() => {
    if (!companyId || !inspectionId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load inspection");
        const data: { data: InspectionData } = await res.json();
        const payload = data?.data?.inspection ?? null;
        setPreInspection(data?.data?.preInspection ?? null);
        const collectCarPayload = data?.data?.collectCar ?? null;
        setCollectCar(collectCarPayload);
        const latestCollectCarReview = collectCarPayload?.latestReview ?? null;
        if (latestCollectCarReview?.completed) {
          setCollectCarDifference(latestCollectCarReview?.hasDifference ? "yes" : "no");
          setCollectCarNote(String(latestCollectCarReview?.note ?? ""));
          setCollectCarReuploadMedia(
            Object.entries((latestCollectCarReview?.reuploadMedia ?? {}) as Record<string, string | null>).reduce(
              (acc, [key, fileId]) => {
                if (fileId) acc[key] = String(fileId);
                return acc;
              },
              {} as Record<string, string>
            )
          );
        } else {
          setCollectCarDifference("");
          setCollectCarNote("");
          setCollectCarReuploadMedia({});
        }
        setInspection(payload);
        setLeadId(payload?.leadId ?? null);
        const draft = payload?.draftPayload ?? {};
        const savedStepRaw = Number(draft.inspectionStep ?? 1);
        const savedStep = Number.isFinite(savedStepRaw) ? Math.min(6, Math.max(1, Math.trunc(savedStepRaw))) : 1;
        setInspectionStep(savedStep);
        setForm((prev) => ({
          advisorName: draft.advisorName ?? prev.advisorName,
          inspectorName: draft.inspectorName ?? prev.inspectorName,
          carInMileage: draft.carInMileage ?? prev.carInMileage,
          customerComplain: draft.customerComplain ?? prev.customerComplain,
          inspectorRemarks: draft.inspectorRemarks ?? prev.inspectorRemarks,
        }));
        const savedIssueEntries = Array.isArray(draft.inspectionIssueEntries)
          ? (draft.inspectionIssueEntries as any[])
              .map((entry) => ({
                id: String(entry?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
                description: String(entry?.description ?? ""),
                imageFileId: String(entry?.imageFileId ?? ""),
              }))
              .filter((entry) => entry.description || entry.imageFileId)
          : [];
        if (savedIssueEntries.length > 0) {
          setInspectionIssueEntries(savedIssueEntries);
        } else {
          const legacyNote = String(draft.inspectionIssueNotes ?? "").trim();
          setInspectionIssueEntries(
            legacyNote
              ? [
                  {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    description: legacyNote,
                    imageFileId: "",
                  },
                ]
              : []
          );
        }
        setProcessChecks({
          oil: String(draft.processChecks?.oil ?? "") as ProcessCheckValue,
          battery: String(draft.processChecks?.battery ?? "") as ProcessCheckValue,
          tyre: String(draft.processChecks?.tyre ?? "") as ProcessCheckValue,
          obd: String(draft.processChecks?.obd ?? "") as ProcessCheckValue,
        });
        setProcessCheckMedia({
          oil: String(draft.processCheckMedia?.oil ?? ""),
          battery: String(draft.processCheckMedia?.battery ?? ""),
          tyre: String(draft.processCheckMedia?.tyre ?? ""),
          obd: String(draft.processCheckMedia?.obd ?? ""),
        });
        setProcessCheckMediaMulti({
          oil: Array.isArray(draft.processCheckMediaMulti?.oil)
            ? (draft.processCheckMediaMulti.oil as any[]).map((id) => String(id ?? "")).filter(Boolean)
            : draft.processCheckMedia?.oil
            ? [String(draft.processCheckMedia.oil)]
            : [],
          battery: Array.isArray(draft.processCheckMediaMulti?.battery)
            ? (draft.processCheckMediaMulti.battery as any[]).map((id) => String(id ?? "")).filter(Boolean)
            : draft.processCheckMedia?.battery
            ? [String(draft.processCheckMedia.battery)]
            : [],
          tyre: Array.isArray(draft.processCheckMediaMulti?.tyre)
            ? (draft.processCheckMediaMulti.tyre as any[]).map((id) => String(id ?? "")).filter(Boolean)
            : draft.processCheckMedia?.tyre
            ? [String(draft.processCheckMedia.tyre)]
            : [],
          obd: Array.isArray(draft.processCheckMediaMulti?.obd)
            ? (draft.processCheckMediaMulti.obd as any[]).map((id) => String(id ?? "")).filter(Boolean)
            : draft.processCheckMedia?.obd
            ? [String(draft.processCheckMedia.obd)]
            : [],
        });
        setProcessCheckIssueNotes({
          oil: String(draft.processCheckIssueNotes?.oil ?? ""),
          battery: String(draft.processCheckIssueNotes?.battery ?? ""),
          tyre: String(draft.processCheckIssueNotes?.tyre ?? ""),
          obd: String(draft.processCheckIssueNotes?.obd ?? ""),
        });
        setProcessMediaVerified({
          oil: Boolean(draft.processMediaVerified?.oil),
          battery: Boolean(draft.processMediaVerified?.battery),
          tyre: Boolean(draft.processMediaVerified?.tyre),
          obd: Boolean(draft.processMediaVerified?.obd),
        });
        setCarMediaReview({
          front: String(draft.carMediaReview?.front ?? "pending") as CarMediaReviewStatus,
          rear: String(draft.carMediaReview?.rear ?? "pending") as CarMediaReviewStatus,
          right: String(draft.carMediaReview?.right ?? "pending") as CarMediaReviewStatus,
          left: String(draft.carMediaReview?.left ?? "pending") as CarMediaReviewStatus,
          video: String(draft.carMediaReview?.video ?? "pending") as CarMediaReviewStatus,
        });
        setCarMediaReplacement({
          front: String(draft.carMediaReplacement?.front ?? ""),
          rear: String(draft.carMediaReplacement?.rear ?? ""),
          right: String(draft.carMediaReplacement?.right ?? ""),
          left: String(draft.carMediaReplacement?.left ?? ""),
          video: String(draft.carMediaReplacement?.video ?? ""),
        });
        setCarMediaRejectReason({
          front: String(draft.carMediaRejectReason?.front ?? ""),
          rear: String(draft.carMediaRejectReason?.rear ?? ""),
          right: String(draft.carMediaRejectReason?.right ?? ""),
          left: String(draft.carMediaRejectReason?.left ?? ""),
          video: String(draft.carMediaRejectReason?.video ?? ""),
        });
        setCarMediaRejectNote({
          front: String(draft.carMediaRejectNote?.front ?? ""),
          rear: String(draft.carMediaRejectNote?.rear ?? ""),
          right: String(draft.carMediaRejectNote?.right ?? ""),
          left: String(draft.carMediaRejectNote?.left ?? ""),
          video: String(draft.carMediaRejectNote?.video ?? ""),
        });
        setTyreSizeFront(String(draft.tyreSizeFront ?? ""));
        setTyreSizeRear(String(draft.tyreSizeRear ?? ""));
        setClusterImageId(String(draft.clusterImageId ?? ""));
        setInspectionVin(String(draft.inspectionVin ?? ""));
        setInspectionMake(String(draft.inspectionMake ?? ""));
        setInspectionModel(String(draft.inspectionModel ?? ""));
        setInspectionYear(String(draft.inspectionYear ?? ""));
        initialRemarksRef.current = draft.inspectorRemarks ?? "";
        initialStatusRef.current = String(payload?.status ?? "pending").toLowerCase();
        setChecks(draft.checks ?? {});
        initialChecksSignatureRef.current = JSON.stringify(draft.checks ?? {});
        setInspectionLogs(Array.isArray(draft.activityLogs) ? draft.activityLogs : []);
        setAdvisorApproved(Boolean(draft.advisorApproved));
        setAdvisorApprovedAt(draft.advisorApprovedAt ?? null);
        setAdvisorApprovedBy(draft.advisorApprovedBy ?? null);
        setCustomerApproved(Boolean(draft.customerApproved));
        setCustomerApprovedAt(draft.customerApprovedAt ?? null);
        setCustomerApprovedBy(draft.customerApprovedBy ?? null);
        setLineItemAiAnswers(
          draft.lineItemAiAnswers && typeof draft.lineItemAiAnswers === "object"
            ? (draft.lineItemAiAnswers as Record<string, Record<string, LineItemAiAnswerValue>>)
            : {}
        );
        setLineItemAiQuestionsByRow(
          draft.lineItemAiQuestionsByRow && typeof draft.lineItemAiQuestionsByRow === "object"
            ? (draft.lineItemAiQuestionsByRow as Record<string, LineItemAiQuestion[]>)
            : {}
        );
        setLineItemAiRecommendationByRow(
          draft.lineItemAiRecommendationByRow && typeof draft.lineItemAiRecommendationByRow === "object"
            ? (draft.lineItemAiRecommendationByRow as Record<string, string>)
            : {}
        );
        if (payload?.customerId) {
          const custRes = await fetch(
            `/api/customers/${payload.customerId}?companyId=${companyId}`
          );
          if (custRes.ok) {
            const cust = await custRes.json();
            setCustomer(cust);
          }
        }
        if (payload?.carId) {
          const carRes = await fetch(
            `/api/cars/${payload.carId}?companyId=${companyId}`
          );
          if (carRes.ok) {
            const carData = await carRes.json();
            setCar(carData);
          }
        }
        if (payload?.leadId) {
          const leadRes = await fetch(
            `/api/company/${companyId}/sales/leads/${payload.leadId}`
          );
          if (leadRes.ok) {
            const leadJson = await leadRes.json().catch(() => ({}));
            const lead = leadJson?.data?.lead ?? leadJson?.data?.data ?? leadJson?.data ?? {};
            setCarInVideoId(lead?.carInVideo ?? lead?.carin_video ?? "");
            setCarOutVideoId(lead?.carOutVideo ?? lead?.carout_video ?? "");
            setLeadPlate(
              lead?.plateNumber ??
                lead?.plate_number ??
                lead?.carPlateNumber ??
                lead?.car_plate_number ??
                lead?.car?.plateNumber ??
                lead?.car?.plate_number ??
                ""
            );
            setForm((prev) => ({
              ...prev,
              advisorName: lead?.branchName ?? lead?.branch_name ?? prev.advisorName,
              customerComplain: lead?.customerRemark ?? prev.customerComplain,
            }));
          }
        }
        if (payload?.id && companyId) {
          const itemsRes = await fetch(
            `/api/company/${companyId}/workshop/inspections/${payload.id}/line-items?source=inspection&isAdd=0`
          );
          const itemsJson = itemsRes.ok ? await itemsRes.json().catch(() => ({})) : {};
          const items = itemsJson?.data ?? [];
          if (items.length) {
            const aiQuestionsByRowFromItems: Record<string, LineItemAiQuestion[]> = {};
            const aiAnswersByRowFromItems: Record<string, Record<string, LineItemAiAnswerValue>> = {};
            const aiRecommendationByRowFromItems: Record<string, string> = {};
            const mappedParts = items.map((item: any) => ({
              clientRowKey:
                item.clientRowKey ??
                item.client_row_key ??
                item.id ??
                `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              id: item.id,
              productId: item.productId ?? item.product_id ?? null,
              productType: item.productType ?? item.product_type ?? item.type ?? null,
              part: item.productName ?? item.product_name ?? "",
              description: item.description ?? "",
              qty: String(item.quantity ?? 1),
              reason: item.reason ?? "Mandatory",
              catalogGroupKey: item.catalogGroupKey ?? item.catalog_group_key ?? "",
              catalogPartCode: item.catalogPartCode ?? item.catalog_part_code ?? item.partNumber ?? item.part_number ?? "",
              clientRowKey:
                item.clientRowKey ??
                item.client_row_key ??
                item.id ??
                `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              mediaFileId: item.mediaFileId ?? item.media_file_id ?? null,
              partOrdered: item.partOrdered ?? item.part_ordered ?? 0,
              orderStatus: item.orderStatus ?? item.order_status ?? null,
              isSaved: true,
            })).map((row) => {
              const source = items.find((it: any) => String(it?.id ?? "") === String(row.id ?? ""));
              const rowKey = String(row.clientRowKey ?? row.id ?? "");
              if (rowKey) {
                if (Array.isArray(source?.aiQuestions ?? source?.ai_questions)) {
                  aiQuestionsByRowFromItems[rowKey] = (source?.aiQuestions ?? source?.ai_questions) as LineItemAiQuestion[];
                }
                if (source?.aiAnswers && typeof source.aiAnswers === "object") {
                  aiAnswersByRowFromItems[rowKey] = source.aiAnswers as Record<string, LineItemAiAnswerValue>;
                } else if (source?.ai_answers && typeof source.ai_answers === "object") {
                  aiAnswersByRowFromItems[rowKey] = source.ai_answers as Record<string, LineItemAiAnswerValue>;
                }
                const rec = String(source?.aiRecommendation ?? source?.ai_recommendation ?? "").trim();
                if (rec) aiRecommendationByRowFromItems[rowKey] = rec;
              }
              return row;
            });
            setParts(mappedParts);
            setLineItemAiQuestionsByRow((prev) => ({ ...prev, ...aiQuestionsByRowFromItems }));
            setLineItemAiAnswers((prev) => ({ ...prev, ...aiAnswersByRowFromItems }));
            setLineItemAiRecommendationByRow((prev) => ({ ...prev, ...aiRecommendationByRowFromItems }));
            initialPartsSignatureRef.current = JSON.stringify(
              mappedParts.map((p) => ({
                id: p.id ?? null,
                part: p.part?.trim?.() ?? "",
                description: p.description?.trim?.() ?? "",
                qty: String(p.qty ?? ""),
                reason: p.reason ?? "",
                catalogGroupKey: p.catalogGroupKey ?? "",
                catalogPartCode: p.catalogPartCode ?? "",
                clientRowKey: p.clientRowKey ?? "",
                mediaFileId: p.mediaFileId ?? null,
                productId: p.productId ?? null,
              }))
            );
          }
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load inspection");
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, inspectionId]);

  useEffect(() => {
    if (!companyId) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const name = data?.user?.fullName ?? data?.user?.email ?? "";
        if (!name) return;
        setForm((prev) => ({
          ...prev,
          inspectorName: prev.inspectorName || name,
        }));
        setActorName(name);
      })
      .catch(() => {
        // ignore
      });
  }, [companyId]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProducts(data?.data ?? []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (productOpenIndex === null) {
      setProductResults([]);
      return;
    }
    const query = parts[productOpenIndex]?.part?.trim() ?? "";
    let active = true;
    const timer = setTimeout(() => {
      const url = query ? `/api/products?search=${encodeURIComponent(query)}` : "/api/products";
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setProductResults(data?.data ?? []);
        })
        .catch(() => {
          if (!active) return;
          setProductResults([]);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productOpenIndex, parts]);

  const plateLabel = useMemo(() => {
    const direct =
      car?.plate_number ||
      car?.plateNumber ||
      inspection?.plate_number ||
      inspection?.plateNumber ||
      inspection?.car_plate_number ||
      inspection?.carPlateNumber ||
      inspection?.draftPayload?.plateNumber ||
      inspection?.draftPayload?.plate_number ||
      leadPlate ||
      "";
    return String(direct || "").trim() || "Plate";
  }, [car, inspection, leadPlate]);
  const startedAt = inspection?.startAt ?? inspection?.start_at ?? null;
  const completedAt = inspection?.completeAt ?? inspection?.complete_at ?? null;
  const verifiedAt = inspection?.verifiedAt ?? inspection?.verified_at ?? null;
  const cancelledAt = inspection?.cancelledAt ?? inspection?.cancelled_at ?? null;
  const cancelledBy = inspection?.cancelledBy ?? inspection?.cancelled_by ?? null;
  const cancelRemarks = inspection?.cancelRemarks ?? inspection?.cancel_remarks ?? null;
  const isCancelled = String(inspection?.status ?? "").toLowerCase() === "cancelled" || Boolean(cancelledAt);
  const isVerified = Boolean(verifiedAt);
  const isLegacyCompletedReadonly =
    String(inspection?.status ?? "").toLowerCase() === "completed" &&
    Boolean(inspection?.draftPayload?.legacySnapshot);
  const isReadOnly = isCancelled || isVerified || isLegacyCompletedReadonly;
  const collectCarLatestReview = collectCar?.latestReview ?? null;
  const collectCarCompleted = Boolean(collectCarLatestReview?.completed);
  const collectCarSourceType = collectCar?.sourceType ?? "unknown";
  const collectCarSourceMedia = useMemo(
    () => (collectCar?.sourceMedia ?? {}) as Record<string, string | null>,
    [collectCar?.sourceMedia]
  );
  const collectCarLogs = Array.isArray(collectCar?.logs) ? collectCar.logs : [];
  const collectCarNeedsReupload = collectCarDifference === "yes";
  const collectCarMissingReupload = Object.entries(collectCarSourceMedia)
    .filter(([, fileId]) => Boolean(fileId))
    .some(([key]) => !collectCarReuploadMedia[key]);
  const isCollectCarPending = !isReadOnly && !collectCarCompleted;
  useEffect(() => {
    if (isCollectCarPending) setInspectionStep(1);
  }, [isCollectCarPending]);
  useEffect(() => {
    const vin = inspectionVin.trim().toUpperCase();
    if (!vin || vin === vinCatalogLoadedVinRef.current) return;
    setVinCatalogParts([]);
    setVinCatalogGroups([]);
  }, [inspectionVin]);
  const currentStatus = String(inspection?.status ?? "pending").toLowerCase();
  const isWorkshopView = forceWorkshopView || searchParams.get("view") === "workshop" || Boolean(workshopBranchIdProp);
  const workshopBranchId = workshopBranchIdProp ?? searchParams.get("branchId");
  const backHref =
    isWorkshopView && companyId && workshopBranchId
      ? `/company/${companyId}/branches/${workshopBranchId}/workshop`
      : companyId
      ? `/company/${companyId}/inspections`
      : "#";

  const updateCheck = (key: string, value: CheckValue) => {
    setChecks((prev) => ({ ...prev, [key]: value }));
  };

  const serializePartsForCompare = (rows: typeof parts) =>
    JSON.stringify(
      rows.map((p) => ({
        id: p.id ?? null,
        part: p.part?.trim?.() ?? "",
        description: p.description?.trim?.() ?? "",
        qty: String(p.qty ?? ""),
        reason: p.reason ?? "",
        catalogGroupKey: p.catalogGroupKey ?? "",
        catalogPartCode: p.catalogPartCode ?? "",
        clientRowKey: p.clientRowKey ?? "",
        mediaFileId: p.mediaFileId ?? null,
        productId: p.productId ?? null,
      }))
    );

  const appendInspectionLog = (
    action: InspectionLogEntry["action"],
    at: string,
    message?: string,
    baseLogs: InspectionLogEntry[] = inspectionLogs
  ) => {
    const entry: InspectionLogEntry = {
      id: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      by: actorName || form.inspectorName || "System",
      at,
      message,
    };
    const next = [entry, ...baseLogs];
    setInspectionLogs(next);
    return next;
  };

  const buildInspectionLogEntry = useCallback(
    (action: InspectionLogEntry["action"], at: string, message?: string): InspectionLogEntry => ({
      id: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      by: actorName || form.inspectorName || "System",
      at,
      message,
    }),
    [actorName, form.inspectorName]
  );

  const buildDraftPayload = useCallback(
    (
      activityLogs: InspectionLogEntry[],
      rows: typeof parts = parts,
      approvals?: {
        advisorApproved?: boolean;
        advisorApprovedAt?: string | null;
        advisorApprovedBy?: string | null;
        customerApproved?: boolean;
        customerApprovedAt?: string | null;
        customerApprovedBy?: string | null;
      },
      overrides?: {
        inspectionIssueEntries?: InspectionIssueEntry[];
      }
    ) => ({
      advisorName: form.advisorName,
      inspectorName: form.inspectorName,
      carInMileage: form.carInMileage,
      customerComplain: form.customerComplain,
      inspectorRemarks: form.inspectorRemarks,
      inspectionIssueEntries: (overrides?.inspectionIssueEntries ?? inspectionIssueEntries).map((entry) => ({
        id: entry.id,
        description: entry.description,
        imageFileId: entry.imageFileId,
      })),
      inspectionIssueNotes: (overrides?.inspectionIssueEntries ?? inspectionIssueEntries)
        .map((entry) => entry.description.trim())
        .filter(Boolean)
        .join("\n"),
      checks,
      processChecks,
      processCheckMedia,
      processCheckMediaMulti,
      processCheckIssueNotes,
      processMediaVerified,
      carMediaReview,
      carMediaReplacement,
      carMediaRejectReason,
      carMediaRejectNote,
      tyreSizeFront,
      tyreSizeRear,
      clusterImageId,
      inspectionVin: inspectionVin.trim().toUpperCase(),
      inspectionMake: inspectionMake.trim(),
      inspectionModel: inspectionModel.trim(),
      inspectionYear: inspectionYear.trim(),
      parts: rows.map((p) => ({
        id: p.id,
        productId: p.productId ?? null,
        productType: p.productType ?? null,
        part: p.part,
        description: p.description,
        qty: p.qty,
        reason: p.reason,
        catalogGroupKey: p.catalogGroupKey ?? "",
        catalogPartCode: p.catalogPartCode ?? "",
        clientRowKey: p.clientRowKey ?? "",
        mediaFileId: p.mediaFileId ?? null,
      })),
      lineItemAiAnswers,
      lineItemAiQuestionsByRow,
      lineItemAiRecommendationByRow,
      advisorApproved: approvals?.advisorApproved ?? advisorApproved,
      advisorApprovedAt: approvals?.advisorApprovedAt ?? advisorApprovedAt,
      advisorApprovedBy: approvals?.advisorApprovedBy ?? advisorApprovedBy,
      customerApproved: approvals?.customerApproved ?? customerApproved,
      customerApprovedAt: approvals?.customerApprovedAt ?? customerApprovedAt,
      customerApprovedBy: approvals?.customerApprovedBy ?? customerApprovedBy,
      collectCarReview: collectCarLatestReview ?? null,
      inspectionStep,
      activityLogs,
    }),
    [
      advisorApproved,
      advisorApprovedAt,
      advisorApprovedBy,
      carMediaRejectNote,
      carMediaRejectReason,
      carMediaReplacement,
      carMediaReview,
      checks,
      clusterImageId,
      collectCarLatestReview,
      customerApproved,
      customerApprovedAt,
      customerApprovedBy,
      form.advisorName,
      form.carInMileage,
      form.customerComplain,
      form.inspectorName,
      form.inspectorRemarks,
      inspectionIssueEntries,
      inspectionMake,
      inspectionModel,
      inspectionVin,
      inspectionYear,
      inspectionStep,
      lineItemAiAnswers,
      lineItemAiQuestionsByRow,
      lineItemAiRecommendationByRow,
      parts,
      processChecks,
      processCheckMedia,
      processCheckMediaMulti,
      processCheckIssueNotes,
      processMediaVerified,
      tyreSizeFront,
      tyreSizeRear,
    ]
  );

  useEffect(() => {
    if (!companyId || !inspectionId) return;
    if (loading || saving || collectCarSaving) return;
    if (isReadOnly) return;

    const signature = JSON.stringify(buildDraftPayload(inspectionLogs, parts));
    if (!autosaveInitializedRef.current) {
      autosaveInitializedRef.current = true;
      autosaveLastSignatureRef.current = signature;
      return;
    }
    if (signature === autosaveLastSignatureRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftPayload: buildDraftPayload(inspectionLogs, parts),
          }),
        });
        if (!res.ok) return;
        autosaveLastSignatureRef.current = signature;
      } catch {
        // silent autosave failure; manual save actions remain available
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [
    advisorApproved,
    advisorApprovedAt,
    advisorApprovedBy,
    buildDraftPayload,
    carMediaRejectNote,
    carMediaRejectReason,
    carMediaReplacement,
    carMediaReview,
    checks,
    clusterImageId,
    collectCarLatestReview,
    collectCarSaving,
    companyId,
    customerApproved,
    customerApprovedAt,
    customerApprovedBy,
    form,
    inspectionId,
    inspectionIssueEntries,
    inspectionLogs,
    inspectionMake,
    inspectionModel,
    inspectionVin,
    inspectionYear,
    isReadOnly,
    loading,
    parts,
    processChecks,
    processCheckMedia,
    processMediaVerified,
    saving,
    tyreSizeFront,
    tyreSizeRear,
  ]);

  const collectMediaLabel = (key: string) => {
    const normalized = key.toLowerCase();
    if (normalized.includes("front")) return "Front Image";
    if (normalized.includes("rear")) return "Rear Image";
    if (normalized.includes("left")) return "Left Image";
    if (normalized.includes("right")) return "Right Image";
    if (normalized.includes("cluster")) return "Cluster Image";
    if (normalized.includes("video")) return "Video";
    return key.replace(/[_-]+/g, " ");
  };
  const isVideoMediaKey = (key: string) => key.toLowerCase().includes("video");

  const saveCollectCarReview = async () => {
    if (!companyId || !inspectionId) return;
    if (!collectCarDifference) {
      toast.error("Choose whether there is any difference before collecting car.");
      return;
    }
    if (collectCarNeedsReupload && collectCarMissingReupload) {
      toast.error("Upload replacement media for all available source files.");
      return;
    }
    setCollectCarSaving(true);
    setError(null);
    const actionAt = new Date().toISOString();
    const hasDifference = collectCarDifference === "yes";
    const reuploadMedia = collectCarNeedsReupload
      ? Object.entries(collectCarReuploadMedia).reduce((acc, [key, fileId]) => {
          if (fileId) acc[key] = fileId;
          return acc;
        }, {} as Record<string, string>)
      : {};
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect_car_review",
          hasDifference,
          note: collectCarNote.trim() || null,
          reuploadMedia,
          reviewedBy: actorName || form.inspectorName || "System",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Failed to save collect-car stage.");
      setCollectCar((prev) => ({
        ...(prev ?? {}),
        latestReview: {
          completed: true,
          hasDifference,
          note: collectCarNote.trim() || null,
          reviewedAt: actionAt,
          reviewedBy: actorName || form.inspectorName || "System",
          reuploadMedia,
        },
        logs: [
          {
            id: `${actionAt}-${Math.random().toString(36).slice(2, 8)}`,
            hasDifference,
            note: collectCarNote.trim() || null,
            reviewedAt: actionAt,
            reviewedBy: actorName || form.inspectorName || "System",
          },
          ...(Array.isArray(prev?.logs) ? prev!.logs : []),
        ],
      }));
      toast.success("Collect car stage completed.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save collect car stage");
    } finally {
      setCollectCarSaving(false);
    }
  };

  const updateProcessCheck = (key: ProcessCheckKey, value: ProcessCheckValue) => {
    setProcessChecks((prev) => ({ ...prev, [key]: value }));
  };

  const uploadProcessCheckFiles = async (key: ProcessCheckKey, files: FileList | null) => {
    if (!files?.length) return;
    if (isReadOnly || isCollectCarPending) return;
    setProcessCheckUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const nextIds: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", "image");
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(String(body?.error ?? "Failed to upload image"));
        }
        const body = await res.json().catch(() => ({}));
        const fileId = String(body?.fileId ?? "");
        if (fileId) nextIds.push(fileId);
      }
      if (!nextIds.length) return;
      setProcessCheckMediaMulti((prev) => {
        const merged = [...(prev[key] ?? []), ...nextIds];
        setProcessCheckMedia((singlePrev) => ({ ...singlePrev, [key]: merged[0] ?? "" }));
        return { ...prev, [key]: merged };
      });
      setProcessMediaVerified((prev) => ({ ...prev, [key]: false }));
      toast.success(`${nextIds.length} file(s) uploaded for ${processCheckItems.find((x) => x.key === key)?.label ?? key}.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to upload files");
    } finally {
      setProcessCheckUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const persistStep3MediaReview = async (overrides?: {
    review?: Record<CarMediaKey, CarMediaReviewStatus>;
    replacement?: Record<CarMediaKey, string>;
    processVerified?: Record<string, boolean>;
    rejectReason?: Record<CarMediaKey, string>;
    rejectNote?: Record<CarMediaKey, string>;
    inspectionIssueEntries?: InspectionIssueEntry[];
  }) => {
    if (!companyId || !inspectionId) return false;
    const nextReview = overrides?.review ?? carMediaReview;
    const nextReplacement = overrides?.replacement ?? carMediaReplacement;
    const nextProcessVerified = overrides?.processVerified ?? processMediaVerified;
    const nextRejectReason = overrides?.rejectReason ?? carMediaRejectReason;
    const nextRejectNote = overrides?.rejectNote ?? carMediaRejectNote;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftPayload: {
            ...buildDraftPayload(inspectionLogs, parts),
            inspectionIssueEntries: (overrides?.inspectionIssueEntries ?? inspectionIssueEntries).map((entry) => ({
              id: entry.id,
              description: entry.description,
              imageFileId: entry.imageFileId,
            })),
            inspectionIssueNotes: (overrides?.inspectionIssueEntries ?? inspectionIssueEntries)
              .map((entry) => entry.description.trim())
              .filter(Boolean)
              .join("\n"),
            processMediaVerified: nextProcessVerified,
            carMediaReview: nextReview,
            carMediaReplacement: nextReplacement,
            carMediaRejectReason: nextRejectReason,
            carMediaRejectNote: nextRejectNote,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body?.error ?? "Failed to save media verification"));
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save media verification.");
      return false;
    }
  };

  const autoFillVehicleFromVin = async () => {
    if (!companyId) return;
    const vin = inspectionVin.trim().toUpperCase();
    if (!vin) {
      setVinLookupNote("Enter VIN first.");
      return;
    }
    setVinLookupLoading(true);
    setVinLookupNote(null);
    try {
      const localRes = await fetch(`/api/cars?companyId=${companyId}&search=${encodeURIComponent(vin)}&pageSize=50`, {
        cache: "no-store",
      });
      const localJson = localRes.ok ? await localRes.json().catch(() => ({})) : {};
      const localCars = Array.isArray(localJson?.data) ? localJson.data : [];
      const exact = localCars.find((row: any) => String(row?.vin ?? "").trim().toUpperCase() === vin);
      if (exact) {
        setInspectionMake((prev) => prev || String(exact?.make ?? ""));
        setInspectionModel((prev) => prev || String(exact?.model ?? ""));
        setInspectionYear((prev) => prev || String(exact?.modelYear ?? exact?.model_year ?? ""));
        setTyreSizeFront((prev) => prev || String(exact?.tyreSizeFront ?? exact?.tyre_size_front ?? ""));
        setTyreSizeRear((prev) => prev || String(exact?.tyreSizeBack ?? exact?.tyre_size_back ?? ""));
        if (!form.carInMileage && (exact?.mileage ?? null) !== null) {
          setForm((prev) => ({ ...prev, carInMileage: String(exact?.mileage ?? "") }));
        }
        setVinLookupNote(`VIN found in database${exact?.code ? ` (${exact.code})` : ""}. Car data loaded.`);
        return;
      }

      if (!leadId) {
        setVinLookupNote("VIN not found in database.");
        return;
      }

      const vinRes = await fetch(
        `/api/company/${companyId}/sales/leads/${leadId}/vin-lookup?vin=${encodeURIComponent(vin)}`,
        { cache: "no-store" }
      );
      if (!vinRes.ok) {
        const err = await vinRes.json().catch(() => ({}));
        throw new Error(String(err?.error ?? "VIN lookup failed"));
      }
      const vinJson = await vinRes.json().catch(() => ({}));
      const vinCar = vinJson?.data?.car ?? null;
      if (vinCar) {
        setInspectionMake((prev) => prev || String(vinCar?.make ?? ""));
        setInspectionModel((prev) => prev || String(vinCar?.model ?? ""));
        setInspectionYear((prev) => prev || String(vinCar?.year ?? ""));
        setVinLookupNote("VIN decoded from catalog and vehicle fields auto-filled.");
      } else {
        setVinLookupNote("VIN lookup finished with no matched vehicle details.");
      }
    } catch (err: any) {
      setVinLookupNote(err?.message ?? "VIN lookup failed.");
    } finally {
      setVinLookupLoading(false);
    }
  };

  const buildVinCatalogGroupOptions = (partsList: VinCatalogPart[]): VinCatalogGroupOption[] => {
    const map = new Map<string, VinCatalogGroupOption>();
    for (const part of partsList) {
      for (const group of part.groups ?? []) {
        const id = String(group?.id ?? "").trim();
        const name = String(group?.name ?? "").trim();
        const level = Number(group?.level ?? 0) || 0;
        if (!id && !name) continue;
        const key = `${id || name}::${level}`;
        if (!map.has(key)) {
          map.set(key, { key, label: name || id || `Group ${level || "-"}`, level });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  };

  const ensureVinCatalogForLineItems = useCallback(async () => {
    const vin = inspectionVin.trim().toUpperCase();
    if (!companyId || !leadId) {
      toast.error("Lead context is missing for VIN part groups.");
      return false;
    }
    if (!vin) {
      toast.error("Enter VIN in Step 4 first.");
      return false;
    }
    if (vinCatalogLoadedVinRef.current === vin && vinCatalogParts.length > 0) return true;
    setVinCatalogLoading(true);
    try {
      const res = await fetch(
        `/api/company/${companyId}/sales/leads/${leadId}/vin-lookup?vin=${encodeURIComponent(vin)}`,
        { cache: "no-store" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(body?.error ?? "Failed to load VIN part groups"));
      const rawParts = Array.isArray(body?.data?.parts) ? body.data.parts : [];
      const normalizedParts: VinCatalogPart[] = rawParts.map((part: any) => ({
        code: String(part?.code ?? "").trim(),
        name: String(part?.name ?? "").trim(),
        groups: Array.isArray(part?.groups)
          ? part.groups.map((group: any) => ({
              id: String(group?.id ?? "").trim(),
              level: Number(group?.level ?? 0) || 0,
              name: String(group?.name ?? "").trim(),
            }))
          : [],
      }));
      setVinCatalogParts(normalizedParts);
      setVinCatalogGroups(buildVinCatalogGroupOptions(normalizedParts));
      vinCatalogLoadedVinRef.current = vin;
      if (!normalizedParts.length) {
        toast.error("No VIN catalog parts found for this car.");
        return false;
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load VIN part groups.");
      return false;
    } finally {
      setVinCatalogLoading(false);
    }
  }, [companyId, inspectionVin, leadId, vinCatalogParts.length]);


  const updatePart = (
    index: number,
    field: "part" | "description" | "qty" | "reason",
    value: string,
    extra?: { productId?: number | null; mediaFileId?: string | null; productType?: string | null }
  ) => {
    setParts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current?.partOrdered === 1 || current?.orderStatus === "Ordered" || current?.orderStatus === "Received") {
        return prev;
      }
      next[index] = {
        ...next[index],
        [field]: value,
        productId: extra?.productId ?? next[index].productId,
        productType: extra?.productType ?? next[index].productType,
        mediaFileId: extra?.mediaFileId ?? next[index].mediaFileId,
        isSaved: false,
      };
      return next;
    });
    if (field === "part" || field === "qty") {
      setLineItemErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: undefined },
      }));
    }
  };

  const updatePartMedia = (index: number, mediaFileId: string | null) => {
    setParts((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current?.partOrdered === 1 || current?.orderStatus === "Ordered" || current?.orderStatus === "Received") {
        return prev;
      }
      next[index] = { ...next[index], mediaFileId, isSaved: false };
      return next;
    });
    setLineItemErrors((prev) => ({
      ...prev,
      [index]: { ...prev[index], media: undefined },
    }));
  };

  const normalizeProductType = (value?: string | null) =>
    (value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  const resolveProductType = (row: (typeof parts)[number]) => {
    if (row.productType) return row.productType;
    const match = products.find((product) => product.id === row.productId);
    return match?.type ?? "";
  };

  const getMediaRequirement = (row: (typeof parts)[number]) => {
    const type = normalizeProductType(resolveProductType(row));
    const isSparePart = type.includes("spare") && type.includes("part");
    const isTyre = type.includes("tyre") || type.includes("tire");
    if (isSparePart) {
      return { required: true, kind: "image" as const, label: "Image" };
    }
    if (isTyre) {
      return { required: true, kind: "video" as const, label: "Video" };
    }
    return { required: false, kind: "image" as const, label: "Media" };
  };

  const serializeChecksForCompare = (value: Record<string, CheckValue>) => JSON.stringify(value ?? {});
  const processChecksCompleted = processCheckItems.every(
    (item) => Boolean(processChecks[item.key]) && (processCheckMediaMulti[item.key]?.length ?? 0) > 0
  );
  const processIssueNotesComplete = processCheckItems.every(
    (item) => processChecks[item.key] !== "issue" || Boolean((processCheckIssueNotes[item.key] ?? "").trim())
  );
  const hasAnyProcessIssue = processCheckItems.some((item) => processChecks[item.key] === "issue");
  const step1Complete = isReadOnly || collectCarCompleted;
  const step2Complete = isReadOnly || Boolean(startedAt);
  const rejectedMediaMissingReplacement = useMemo(
    () => carMediaKeys.some((key) => carMediaReview[key] === "rejected" && !carMediaReplacement[key]),
    [carMediaReplacement, carMediaReview]
  );
  const step3Complete = isReadOnly || !rejectedMediaMissingReplacement;
  const carMediaCounts = useMemo(() => {
    const entries = carMediaKeys.map((key) => carMediaReview[key]);
    return {
      total: entries.length,
      verified: entries.filter((v) => v === "verified").length,
      rejected: entries.filter((v) => v === "rejected").length,
      pending: entries.filter((v) => v === "pending").length,
    };
  }, [carMediaReview]);
  const sortedCarMediaKeys = useMemo(() => {
    const rank: Record<CarMediaReviewStatus, number> = { rejected: 0, pending: 1, verified: 2 };
    return [...carMediaKeys].sort((a, b) => rank[carMediaReview[a]] - rank[carMediaReview[b]]);
  }, [carMediaReview]);
  const step4Complete =
    isReadOnly ||
    (Boolean((tyreSizeFront ?? "").trim()) &&
      Boolean((tyreSizeRear ?? "").trim()) &&
      Boolean((form.carInMileage ?? "").trim()) &&
      Boolean((inspectionVin ?? "").trim()));
  const hasUnsavedLineItems = parts.some((p) => !p.isSaved);
  const hasUnsavedChanges =
    !isReadOnly &&
    ((form.inspectorRemarks ?? "").trim() !== (initialRemarksRef.current ?? "").trim() ||
      serializePartsForCompare(parts) !== initialPartsSignatureRef.current ||
      serializeChecksForCompare(checks) !== initialChecksSignatureRef.current);
  const requiredMediaMissing = parts.some((row) => getMediaRequirement(row).required && !row.mediaFileId);
  const step5Complete =
    isReadOnly ||
    (!hasUnsavedLineItems &&
      !requiredMediaMissing &&
      parts.length > 0 &&
      processChecksCompleted &&
      (!hasAnyProcessIssue || processIssueNotesComplete));
  const canCompleteInspection =
    !saving &&
    !isReadOnly &&
    !isCollectCarPending &&
    step3Complete &&
    step4Complete &&
    step5Complete &&
    Boolean(companyId && inspectionId) &&
    !hasUnsavedLineItems &&
    !requiredMediaMissing &&
    Boolean((form.inspectorRemarks ?? "").trim());
  const inspectionSteps = [
    { id: 1, label: "Collect Car", done: step1Complete },
    { id: 2, label: "Start Inspection", done: step2Complete },
    { id: 3, label: "Checks & Notes", done: step3Complete },
    { id: 4, label: "Vehicle Data", done: step4Complete },
    { id: 5, label: "Inspection", done: step5Complete },
    { id: 6, label: "Review & Complete", done: Boolean(completedAt) || canCompleteInspection },
  ];
  const canOpenStep = (stepId: number) => {
    if (stepId <= 1 || isReadOnly) return true;
    if (stepId === 2) return step1Complete;
    if (stepId === 3) return step1Complete && step2Complete;
    if (stepId === 4) return step1Complete && step2Complete && step3Complete;
    if (stepId === 5) return step1Complete && step2Complete && step3Complete && step4Complete;
    return step1Complete && step2Complete && step3Complete && step4Complete && step5Complete;
  };
  const aiQuestions = useMemo(() => {
    if (inspectionStep === 1) {
      return [
        "Do source photos/videos match the current car condition?",
        "If there is a mismatch, did you upload replacement media for each required angle?",
      ];
    }
    if (inspectionStep === 2) {
      return ["Is collect car stage completed?", "Ready to mark inspection as started now?"];
    }
    if (inspectionStep === 3) {
      return [
        "Did you verify or reject each car media item (front/rear/right/left/360)?",
        "If any media is rejected, did you upload replacement media?",
      ];
    }
    if (inspectionStep === 4) {
      return [
        "Did you enter tyre size front/rear and mileage?",
        "Did VIN lookup return make/model/year or an existing car match?",
      ];
    }
    if (inspectionStep === 5) {
      return [
        "Are Oil/Battery/Tyre/OBD checks completed with images?",
        "Did you add and save all required parts/line items with mandatory media?",
      ];
    }
    return [
      "Before completion: are all mandatory steps done and inspector remarks added?",
      "Do you want to update draft one last time before completing inspection?",
    ];
  }, [inspectionStep]);
  const requestLineItemAi = useCallback(
    async (
      rowKey: string,
      context: LineItemAiContext,
      answers?: Record<string, LineItemAiAnswerValue>,
      existingQuestions?: LineItemAiQuestion[]
    ) => {
      if (!companyId || !context.partName.trim()) return;
      setLineItemAiLoadingByRow((prev) => ({ ...prev, [rowKey]: true }));
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inspections/ai-line-item`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            context,
            answers: answers ?? null,
            questions: existingQuestions ?? null,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(body?.error ?? "Failed to generate AI questions"));
        const questions = Array.isArray(body?.questions) ? (body.questions as LineItemAiQuestion[]) : [];
        const recommendation = String(body?.recommendation ?? "");
        if (questions.length > 0) {
          setLineItemAiQuestionsByRow((prev) => ({ ...prev, [rowKey]: questions }));
        }
        if (recommendation) {
          setLineItemAiRecommendationByRow((prev) => ({ ...prev, [rowKey]: recommendation }));
        } else if (answers && questions.length > 0) {
          setLineItemAiRecommendationByRow((prev) => ({
            ...prev,
            [rowKey]: "Answer AI questions to generate recommendation.",
          }));
        }
      } catch (err: any) {
        setLineItemAiRecommendationByRow((prev) => ({
          ...prev,
          [rowKey]: err?.message ?? "AI generation failed.",
        }));
      } finally {
        setLineItemAiLoadingByRow((prev) => ({ ...prev, [rowKey]: false }));
      }
    },
    [companyId]
  );
  const buildSimpleRecommendationFromAnswers = useCallback(
    (
      partName: string,
      questions: LineItemAiQuestion[],
      answers: Record<string, LineItemAiAnswerValue> | undefined
    ) => {
      if (!questions.length) return "";
      const hasUnanswered = questions.some((q) => !answers?.[q.id]);
      if (hasUnanswered) return `Answer all questions for ${partName || "this part"} to get recommendation.`;
      const criticalYes = questions.some((q) => q.critical && answers?.[q.id] === "yes");
      const anyYes = questions.some((q) => answers?.[q.id] === "yes");
      const allNoOrNa = questions.every((q) => answers?.[q.id] === "no" || answers?.[q.id] === "na");
      if (criticalYes) {
        return `Recommended: Replace ${partName || "this part"} immediately and perform safety recheck.`;
      }
      if (anyYes) {
        return `Recommended: Service ${partName || "this part"} soon and monitor after repair.`;
      }
      if (allNoOrNa) {
        return `Recommended: No immediate replacement for ${partName || "this part"}; monitor in next inspection.`;
      }
      return `Recommended: Continue inspection checks for ${partName || "this part"}.`;
    },
    []
  );
  const generateSmartFaultSuggestions = useCallback(
    (partName: string, category: string, description: string): SmartFaultSuggestion[] => {
      const context = `${partName} ${category} ${description}`.toLowerCase();
      const suggestions: SmartFaultSuggestion[] = [];
      const add = (id: string, label: string, reason: string) => suggestions.push({ id, label, reason });

      if (
        context.includes("brake pad") ||
        (context.includes("brake") && (context.includes("worn") || context.includes("wear")))
      ) {
        add("brake-discs", "Check Brake Discs", "Brake pad wear commonly affects disc condition.");
        add("brake-fluid", "Check Brake Fluid", "Brake heat and wear can degrade fluid performance.");
        add("brake-sensor", "Check Brake Sensor", "Brake wear sensors may be damaged or triggered.");
      }
      if (
        (context.includes("tire") || context.includes("tyre")) &&
        (context.includes("worn") || context.includes("uneven") || context.includes("wear"))
      ) {
        add("wheel-alignment", "Check Wheel Alignment", "Uneven tire wear often indicates alignment issues.");
        add("wheel-bearing", "Check Wheel Bearing", "Bearing play can lead to abnormal tire wear.");
        add("suspension-arm", "Check Suspension Arm", "Suspension geometry issues can create uneven wear.");
      }
      if (context.includes("oil leak") || (context.includes("engine") && context.includes("leak"))) {
        add("adjacent-seals", "Check Adjacent Seals", "Leaks often spread from nearby seals.");
        add("gaskets", "Check Gaskets", "Damaged gaskets are common leak sources.");
        add(
          "underbody-contamination",
          "Check Underbody Contamination",
          "Oil spread under vehicle can hide secondary issues."
        );
      }
      if ((context.includes("battery") && context.includes("issue")) || context.includes("battery weak")) {
        add("charging-system", "Check Charging System", "Alternator/charging faults can mimic battery failure.");
        add("battery-terminals", "Check Battery Terminals", "Poor terminal contact can cause intermittent faults.");
      }

      const deduped = Array.from(new Map(suggestions.map((s) => [s.id, s])).values());
      return deduped.slice(0, 5);
    },
    []
  );
  const requestSmartFaultSuggestions = useCallback(
    async (
      rowKey: string,
      context: {
        partName: string;
        partNumber: string;
        vin: string;
        category: string;
        groupName: string;
        description: string;
        status: string;
      }
    ) => {
      if (!companyId || !context.partName.trim()) return;
      const fallback = generateSmartFaultSuggestions(context.partName, context.category, context.description);
      setLineItemSmartSuggestionsLoadingByRow((prev) => ({ ...prev, [rowKey]: true }));
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inspections/ai-related-suggestions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context, fallback }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(body?.error ?? "Failed to fetch related suggestions"));
        const suggestions = Array.isArray(body?.suggestions) ? (body.suggestions as SmartFaultSuggestion[]) : [];
        setLineItemSmartSuggestionsByRow((prev) => ({
          ...prev,
          [rowKey]: suggestions.length > 0 ? suggestions : fallback,
        }));
      } catch {
        setLineItemSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: fallback }));
      } finally {
        setLineItemSmartSuggestionsLoadingByRow((prev) => ({ ...prev, [rowKey]: false }));
        setLineItemSmartSuggestionsFetchedByRow((prev) => ({ ...prev, [rowKey]: true }));
      }
    },
    [companyId, generateSmartFaultSuggestions]
  );
  useEffect(() => {
    for (const row of parts) {
      const rowKey = String(row.clientRowKey ?? row.id ?? "").trim();
      const partName = String(row.part ?? "").trim();
      if (!rowKey || !partName) continue;
      if ((lineItemSmartSuggestionsByRow[rowKey] ?? []).length > 0) continue;
      if (lineItemSmartSuggestionsLoadingByRow[rowKey]) continue;
      if (lineItemSmartSuggestionsFetchedByRow[rowKey]) continue;
      const groupKey = String(row.catalogGroupKey ?? "");
      const groupLabel = vinCatalogGroups.find((group) => group.key === groupKey)?.label ?? "";
      void requestSmartFaultSuggestions(rowKey, {
        partName,
        partNumber: String(row.catalogPartCode ?? ""),
        vin: inspectionVin.trim().toUpperCase(),
        category: groupLabel,
        groupName: groupLabel,
        description: String(row.description ?? ""),
        status: String(row.reason ?? ""),
      });
    }
  }, [
    inspectionVin,
    lineItemSmartSuggestionsByRow,
    lineItemSmartSuggestionsLoadingByRow,
    lineItemSmartSuggestionsFetchedByRow,
    parts,
    requestSmartFaultSuggestions,
    vinCatalogGroups,
  ]);
  const lineItemAiInsights = useMemo(() => {
    const hasRequiredMedia = (row: (typeof parts)[number]) => {
      const resolvedType = row.productType ?? products.find((product) => product.id === row.productId)?.type ?? "";
      const type = normalizeProductType(resolvedType);
      const isSparePart = type.includes("spare") && type.includes("part");
      const isTyre = type.includes("tyre") || type.includes("tire");
      return isSparePart || isTyre;
    };
    const total = parts.length;
    const unsaved = parts.filter((p) => !p.isSaved).length;
    const missingGroup = parts.filter((p) => !(p.catalogGroupKey ?? "").trim()).length;
    const missingPart = parts.filter((p) => !(p.part ?? "").trim()).length;
    const missingStatus = parts.filter((p) => !(p.reason ?? "").trim()).length;
    const requiredMediaMissingCount = parts.filter((row) => hasRequiredMedia(row) && !row.mediaFileId).length;

    const questions: string[] = [];
    const suggestions: string[] = [];

    questions.push(
      total === 0
        ? "No line items added yet. Do you want to add the first line item?"
        : `${total} line item(s) added. Are all parts selected from the correct VIN group?`
    );
    if (missingGroup > 0) questions.push(`${missingGroup} row(s) are missing car group selection. Select group first.`);
    if (missingPart > 0) questions.push(`${missingPart} row(s) are missing part selection.`);
    if (missingStatus > 0) questions.push(`${missingStatus} row(s) are missing status (Safety Risk/Mandatory/Recommended/Optional).`);
    if (requiredMediaMissingCount > 0) {
      questions.push(`${requiredMediaMissingCount} row(s) are missing required media (image/video).`);
    }
    if (unsaved > 0) questions.push(`${unsaved} row(s) are not saved yet. Save them before moving ahead.`);

    if (total === 0) {
      suggestions.push("Click Add Line Item, then choose Car Group and Part Number from VIN catalog.");
    } else {
      suggestions.push("Use Safety Risk only for urgent safety-related parts that must be addressed first.");
      suggestions.push("Use Mandatory for required repairs; Recommended for advised repairs; Optional for cosmetic/non-critical.");
      if (requiredMediaMissingCount > 0) suggestions.push("Upload media for each required row right after selecting part.");
      if (unsaved > 0) suggestions.push("Save each row once complete to avoid losing unsaved line items.");
    }

    return { questions, suggestions };
  }, [parts, products]);
  const selectedPartsByGroup = useMemo(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        parts: string[];
        reasons: string[];
        severityCounts: Record<(typeof lineItemStatusOptions)[number], number>;
      }
    >();
    for (const row of parts) {
      const key = String(row.catalogGroupKey ?? "").trim();
      if (!key) continue;
      const label = vinCatalogGroups.find((group) => group.key === key)?.label || "Unknown Group";
      if (!grouped.has(key)) {
        grouped.set(key, {
          label,
          parts: [],
          reasons: [],
          severityCounts: { "Safety Risk": 0, Mandatory: 0, Recommended: 0, Optional: 0 },
        });
      }
      const entry = grouped.get(key)!;
      const partLabel = String(row.part ?? "").trim() || String(row.catalogPartCode ?? "").trim();
      if (partLabel) entry.parts.push(partLabel);
      const reason = String(row.reason ?? "").trim();
      if (reason) {
        entry.reasons.push(reason);
        if (reason in entry.severityCounts) {
          entry.severityCounts[reason as (typeof lineItemStatusOptions)[number]] += 1;
        }
      }
    }
    const scoreForReason = (reason: string) => {
      const normalized = reason.toLowerCase();
      if (normalized.includes("safety risk")) return 25;
      if (normalized.includes("mandatory")) return 60;
      if (normalized.includes("recommended")) return 80;
      if (normalized.includes("optional")) return 100;
      return 100;
    };
    return Array.from(grouped.entries())
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        parts: Array.from(new Set(entry.parts)),
        severityCounts: entry.severityCounts,
        healthPercent: entry.reasons.length
          ? Math.round(entry.reasons.reduce((sum, reason) => sum + scoreForReason(reason), 0) / entry.reasons.length)
          : 100,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [parts, vinCatalogGroups]);
  const groupSummaryByKey = useMemo(
    () => new Map(selectedPartsByGroup.map((entry) => [entry.key, entry])),
    [selectedPartsByGroup]
  );
  const groupedLineItemOrder = useMemo(
    () =>
      parts
        .map((row, index) => {
          const groupKey = String(row.catalogGroupKey ?? "").trim() || "__ungrouped__";
          const groupLabel =
            groupKey === "__ungrouped__"
              ? "Ungrouped"
              : vinCatalogGroups.find((group) => group.key === groupKey)?.label || "Unknown Group";
          return { row, index, groupKey, groupLabel };
        })
        .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.index - b.index),
    [parts, vinCatalogGroups]
  );
  const reportFindings = useMemo(() => {
    const explainWhy = (status: string, partName: string) => {
      if (status === "Safety Risk") return `${partName} may impact safe driving/braking/vehicle control and needs urgent attention.`;
      if (status === "Mandatory") return `${partName} is in a condition that should be repaired soon to avoid larger failures.`;
      if (status === "Recommended") return `${partName} is currently usable but shows wear/condition that should be addressed.`;
      return `${partName} has a minor or optional observation and can be planned with future maintenance.`;
    };
    return parts
      .filter((row) => String(row.part ?? "").trim())
      .map((row) => {
        const groupKey = String(row.catalogGroupKey ?? "").trim();
        const groupLabel = vinCatalogGroups.find((group) => group.key === groupKey)?.label;
        const keyPrefix = groupKey.includes("::") ? groupKey.split("::")[0] : groupKey;
        const normalizedText = `${String(row.part ?? "")} ${String(row.description ?? "")}`.toLowerCase();
        const partCode = String(row.catalogPartCode ?? "").trim().toLowerCase();
        const catalogDerivedLabel =
          vinCatalogParts.find((part) => {
            const code = String(part.code ?? "").trim().toLowerCase();
            const name = String(part.name ?? "").trim().toLowerCase();
            if (partCode && code === partCode) return true;
            return name && normalizedText.includes(name);
          })?.groups?.[0]?.name ?? "";
        const heuristicCategory = (() => {
          if (/(brake|disc|pad|rotor|caliper|abs)/.test(normalizedText)) return "Brakes";
          if (/(engine|fuel|timing|oil|coolant|exhaust|ignition)/.test(normalizedText)) return "Engine";
          if (/(suspension|strut|shock|control arm|stabilizer|bush)/.test(normalizedText)) return "Suspension";
          if (/(steering|rack|tie rod|power steering)/.test(normalizedText)) return "Steering";
          if (/(tire|tyre|wheel|rim|alignment|balanc)/.test(normalizedText)) return "Tires & Wheels";
          if (/(transmission|gearbox|gear|clutch|drivetrain|axle|differential)/.test(normalizedText)) return "Transmission";
          if (/(battery|electrical|sensor|ecu|obd|alternator|starter|infotainment|ac)/.test(normalizedText)) return "Electrical";
          if (/(body|exterior|door|bumper|fender|hood|mirror|glass|paint|panel)/.test(normalizedText)) return "Body & Exterior";
          if (/(interior|seat|dashboard|trim|cabin|upholstery)/.test(normalizedText)) return "Interior";
          if (/(fluid|maintenance|filter|service|lubricant)/.test(normalizedText)) return "Fluids / Maintenance";
          return "General";
        })();
        const partGroup =
          String(groupLabel ?? "").trim() ||
          String(catalogDerivedLabel ?? "").trim() ||
          (/[a-z]/i.test(keyPrefix) ? keyPrefix.replace(/[_-]+/g, " ").trim() : "") ||
          heuristicCategory;
        const status = String(row.reason ?? "Recommended");
        const recommendation =
          lineItemAiRecommendationByRow[String(row.clientRowKey ?? row.id ?? "")] ||
          `Inspect/repair ${row.part} and confirm condition after service.`;
        const partLower = String(row.part ?? "").toLowerCase().trim();
        const matchedIssueEvidence =
          inspectionIssueEntries.find((entry) => {
            const desc = String(entry.description ?? "").toLowerCase().trim();
            if (!desc || !entry.imageFileId) return false;
            if (!partLower) return false;
            return desc.includes(partLower) || partLower.includes(desc);
          }) ??
          inspectionIssueEntries.find((entry) => Boolean(entry.imageFileId)) ??
          null;
        const evidenceFileId =
          String(row.mediaFileId ?? "").trim() || String(matchedIssueEvidence?.imageFileId ?? "").trim();
        return {
          partName: row.part,
          partNumber: String(row.catalogPartCode ?? ""),
          partGroup,
          severity: status,
          observedCondition: row.description || `${row.part} requires inspection attention.`,
          whyItMatters: explainWhy(status, row.part),
          recommendedAction: recommendation,
          mediaAttached: Boolean(evidenceFileId),
          mediaFileId: evidenceFileId,
        };
      });
  }, [parts, vinCatalogGroups, vinCatalogParts, lineItemAiRecommendationByRow, inspectionIssueEntries]);
  const reportCategoryNames = useMemo(
    () => [
      "Engine",
      "Transmission",
      "Brakes",
      "Suspension",
      "Steering",
      "Tires & Wheels",
      "Electrical",
      "Body & Exterior",
      "Interior",
      "Fluids / Maintenance",
    ],
    []
  );
  const mapGroupToReportCategory = useCallback((groupLabel: string) => {
    const label = String(groupLabel ?? "").toLowerCase();
    if (/(engine|fuel|exhaust|ignition|timing|coolant|oil)/.test(label)) return "Engine";
    if (/(transmission|gearbox|gear|clutch|drivetrain|axle|differential)/.test(label)) return "Transmission";
    if (/(brake|disc|pad|rotor|caliper|abs)/.test(label)) return "Brakes";
    if (/(suspension|strut|shock|control arm|stabilizer|bush)/.test(label)) return "Suspension";
    if (/(steering|rack|tie rod|power steering)/.test(label)) return "Steering";
    if (/(tire|tyre|wheel|rim|alignment|balanc)/.test(label)) return "Tires & Wheels";
    if (/(electrical|battery|alternator|starter|wiring|sensor|obd|ecu|infotainment|ac)/.test(label)) return "Electrical";
    if (/(body|exterior|door|bumper|fender|hood|mirror|glass|paint|panel)/.test(label)) return "Body & Exterior";
    if (/(interior|seat|dashboard|trim|cabin|upholstery)/.test(label)) return "Interior";
    if (/(fluid|maintenance|filter|service|lubricant)/.test(label)) return "Fluids / Maintenance";
    return "Fluids / Maintenance";
  }, []);
  const reportCategoryHealth = useMemo(() => {
    const groupedScores = new Map<string, number[]>();
    for (const group of selectedPartsByGroup) {
      const category = mapGroupToReportCategory(group.label);
      const arr = groupedScores.get(category) ?? [];
      arr.push(group.healthPercent);
      groupedScores.set(category, arr);
    }
    return reportCategoryNames.map((category) => {
      const scores = groupedScores.get(category) ?? [];
      const healthPercent = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
      return { category, healthPercent };
    });
  }, [mapGroupToReportCategory, reportCategoryNames, selectedPartsByGroup]);
  const overallHealthPercent = useMemo(() => {
    if (!reportCategoryHealth.length) return 100;
    let weightedTotal = 0;
    let totalWeight = 0;
    for (const entry of reportCategoryHealth) {
      const weight = REPORT_CATEGORY_WEIGHTS[entry.category] ?? 0;
      if (!weight) continue;
      const health = Math.max(0, Math.min(100, Number(entry.healthPercent) || 0));
      weightedTotal += health * weight;
      totalWeight += weight;
    }
    if (!totalWeight) return 100;
    return Math.round(weightedTotal / totalWeight);
  }, [reportCategoryHealth]);
  const reportPriorityFindings = useMemo(
    () => ({
      "Safety Risk": reportFindings.filter((f) => f.severity === "Safety Risk"),
      Mandatory: reportFindings.filter((f) => f.severity === "Mandatory"),
      Recommended: reportFindings.filter((f) => f.severity === "Recommended"),
      Optional: reportFindings.filter((f) => f.severity === "Optional"),
    }),
    [reportFindings]
  );
  const reportMediaGallery = useMemo(() => {
    const mediaFromReview = (key: CarMediaKey) =>
      String(carMediaReplacement[key] || collectCarSourceMedia[key] || "").trim();
    const items = [
      { key: "front", label: "Front View", fileId: mediaFromReview("front") },
      { key: "rear", label: "Rear View", fileId: mediaFromReview("rear") },
      { key: "odometer", label: "Odometer", fileId: String(clusterImageId ?? "").trim() },
      { key: "left", label: "Left Side", fileId: mediaFromReview("left") },
      { key: "right", label: "Right Side", fileId: mediaFromReview("right") },
    ].filter((item) => Boolean(item.fileId));
    return items;
  }, [carMediaReplacement, clusterImageId, collectCarSourceMedia]);
  const reportWorkshopBranding = useMemo(() => {
    const logoUrl = String(
      inspection?.workshopLogo ??
        inspection?.branchLogo ??
        inspection?.companyLogo ??
        inspection?.draftPayload?.workshopLogo ??
        ""
    ).trim();
    const workshopName =
      String(
        inspection?.workshopName ??
          inspection?.branchName ??
          form.advisorName ??
          "Premium Workshop"
      ).trim() || "Premium Workshop";
    const contact =
      String(
        inspection?.workshopContact ??
          inspection?.branchPhone ??
          customer?.phone ??
          "Contact available at workshop reception"
      ).trim() || "Contact available at workshop reception";
    return { logoUrl, workshopName, contact };
  }, [customer?.phone, form.advisorName, inspection]);
  const reportFinalSummaryText = useMemo(() => {
    const safetyCount = reportPriorityFindings["Safety Risk"].length;
    const mandatoryCount = reportPriorityFindings.Mandatory.length;
    const recommendedCount = reportPriorityFindings.Recommended.length;
    const optionalCount = reportPriorityFindings.Optional.length;
    return `Your vehicle was inspected across key systems including engine, brakes, suspension, steering, electrical, body and tires. The current overall health score is ${overallHealthPercent}%. ${safetyCount > 0 ? `${safetyCount} safety-related issue(s) require immediate attention.` : "No immediate safety risk items were identified."} ${mandatoryCount > 0 ? `${mandatoryCount} mandatory repair item(s) should be addressed soon.` : "No mandatory repairs are pending."} ${recommendedCount > 0 ? `${recommendedCount} recommended maintenance item(s) were identified to preserve reliability.` : "No additional recommended maintenance items were identified."} ${optionalCount > 0 ? `${optionalCount} optional/cosmetic item(s) can be planned based on preference.` : "No optional/cosmetic items were recorded."}`.trim();
  }, [overallHealthPercent, reportPriorityFindings]);
  const printInspectionReport = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);
  const downloadInspectionReportPdf = useCallback(async () => {
    if (!companyId || !inspectionId) return;
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inspections/${inspectionId}/print`,
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Failed to generate PDF report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `inspection-report-${inspectionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(String(err?.message ?? "Failed to download inspection report PDF."));
    }
  }, [companyId, inspectionId]);
  const progressStages = [
    { key: "pending", label: "Draft", done: true },
    { key: "started", label: "Started", done: Boolean(startedAt) },
    { key: "advisor", label: "Advisor Approved", done: advisorApproved },
    { key: "customer", label: "Customer Approved", done: customerApproved },
    { key: "completed", label: "Completed", done: Boolean(completedAt) },
    { key: "verified", label: "Verified", done: Boolean(verifiedAt) },
  ];
  const primaryStages = progressStages.filter((stage) => stage.key !== "advisor" && stage.key !== "customer");
  const approvalStages = progressStages.filter((stage) => stage.key === "advisor" || stage.key === "customer");

  useEffect(() => {
    if (!isReadOnly) return;
    if (parts.length !== 1) return;
    const row = parts[0];
    if (row.id || row.part || row.description || row.mediaFileId) return;
    setParts([]);
  }, [isReadOnly, parts]);

  const uploadFileWithProgress = (file: File, target: "in" | "out") =>
    new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload");
      xhr.responseType = "text";

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
        setVideoUploadProgress((prev) => ({ ...prev, [target]: percent }));
      };

      xhr.onload = () => {
        let body: any = {};
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          body = {};
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(body?.error ?? "Failed to upload video"));
          return;
        }
        const fileId = String(body?.fileId ?? "");
        if (!fileId) {
          reject(new Error("Invalid upload response"));
          return;
        }
        setVideoUploadProgress((prev) => ({ ...prev, [target]: 100 }));
        resolve(fileId);
      };

      xhr.onerror = () => reject(new Error("Network error while uploading video"));
      xhr.onabort = () => reject(new Error("Video upload cancelled"));

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "video");
      xhr.send(formData);
    });

  const uploadInspectionVideo = async (file: File, target: "in" | "out") => {
    if (isReadOnly) {
      toast.error("Verified/cancelled inspection is read-only.");
      return;
    }
    if (isCollectCarPending) {
      toast.error("Complete Collect Car stage first.");
      return;
    }
    if (!companyId || !inspectionId || !leadId) {
      toast.error("Missing inspection context to save video.");
      return;
    }
    const previousInVideoId = carInVideoId;
    const previousOutVideoId = carOutVideoId;
    try {
      setVideoUploading(target);
      setVideoUploadProgress((prev) => ({ ...prev, [target]: 0 }));
      const fileId = await uploadFileWithProgress(file, target);
      const nextCarInVideoId = target === "in" ? fileId : previousInVideoId || "";
      const nextCarOutVideoId = target === "out" ? fileId : previousOutVideoId || "";
      setCarInVideoId(nextCarInVideoId);
      setCarOutVideoId(nextCarOutVideoId);

      const leadRes = await fetch(`/api/company/${companyId}/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carInVideo: nextCarInVideoId || null,
          carOutVideo: nextCarOutVideoId || null,
        }),
      });
      if (!leadRes.ok) throw new Error("Failed to save video URL to lead");

      const actionAt = new Date().toISOString();
      const actionMessage =
        target === "in"
          ? previousInVideoId
            ? "Car in video replaced"
            : "Car in video uploaded"
          : previousOutVideoId
          ? "Car out video replaced"
          : "Car out video uploaded";
      const videoLog = buildInspectionLogEntry("updated", actionAt, actionMessage);
      const nextLogs = [videoLog, ...inspectionLogs];
      const inspectionRes = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftPayload: buildDraftPayload(nextLogs),
        }),
      });
      if (!inspectionRes.ok) throw new Error("Failed to save inspection video log");
      setInspectionLogs(nextLogs);

      toast.success(target === "in" ? "Car in video uploaded." : "Car out video uploaded.");
    } catch (err: any) {
      setCarInVideoId(previousInVideoId);
      setCarOutVideoId(previousOutVideoId);
      toast.error(err?.message ?? "Failed to upload video");
    } finally {
      setVideoUploading(null);
      setVideoUploadProgress((prev) => ({ ...prev, [target]: 0 }));
    }
  };

  const carInDropzone = useDropzone({
    accept: { "video/*": [] },
    multiple: false,
    disabled: isReadOnly || isCollectCarPending || videoUploading !== null,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;
      void uploadInspectionVideo(file, "in");
    },
  });

  const carOutDropzone = useDropzone({
    accept: { "video/*": [] },
    multiple: false,
    disabled: isReadOnly || isCollectCarPending || videoUploading !== null,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;
      void uploadInspectionVideo(file, "out");
    },
  });

  const saveLineItem = async (index: number) => {
    if (!companyId || !inspectionId) return;
    if (isReadOnly) {
      toast.error("Verified/cancelled inspection is read-only.");
      return;
    }
    if (isCollectCarPending) {
      toast.error("Complete Collect Car stage first.");
      return;
    }
    const currentParts = partsRef.current;
    const row = currentParts[index];
    if (row?.partOrdered === 1 || row?.orderStatus === "Ordered" || row?.orderStatus === "Received") {
      toast.error("Ordered/received items cannot be edited.");
      return;
    }
    setError(null);
    const nextErrors: { part?: string; qty?: string; media?: string } = {};
    if (!row.part.trim()) {
      nextErrors.part = "Part is required.";
    }
    const qtyNumber = Number(row.qty);
    if (!Number.isFinite(qtyNumber) || qtyNumber < 1) {
      nextErrors.qty = "Quantity must be a number and at least 1.";
    }
    const mediaRequirement = getMediaRequirement(row);
    if (mediaRequirement.required && !row.mediaFileId) {
      nextErrors.media = `${mediaRequirement.label} upload is required.`;
    }
    if (nextErrors.part || nextErrors.qty || nextErrors.media) {
      setLineItemErrors((prev) => ({ ...prev, [index]: nextErrors }));
      return;
    }
    const wasExisting = Boolean(row.id);
    setParts((prev) => prev.map((p, i) => (i === index ? { ...p, isSaving: true } : p)));
    try {
      const payload = {
        leadId: leadId ?? null,
        productId: row.productId ?? null,
        productName: row.part,
        partNumber: row.catalogPartCode?.trim?.() || null,
        catalogGroupKey: row.catalogGroupKey?.trim?.() || null,
        clientRowKey: row.clientRowKey ?? null,
        description: row.description,
        quantity: qtyNumber,
        reason: row.reason,
        mediaFileId: row.mediaFileId ?? null,
        aiQuestions: lineItemAiQuestionsByRow[row.clientRowKey || row.id || `row-${index}`] ?? [],
        aiAnswers: lineItemAiAnswers[row.clientRowKey || row.id || `row-${index}`] ?? {},
        aiRecommendation: lineItemAiRecommendationByRow[row.clientRowKey || row.id || `row-${index}`] ?? null,
      };
      const res = await fetch(
        `/api/company/${companyId}/workshop/inspections/${inspectionId}/line-items` +
          (row.id ? `/${row.id}` : ""),
        {
          method: row.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Failed to save line item");
      const data = await res.json();
      const saved = data?.data ?? {};
      const nextParts = currentParts.map((p, i) =>
        i === index
          ? {
              ...p,
              id: saved.id ?? p.id,
              clientRowKey: saved.clientRowKey ?? saved.client_row_key ?? p.clientRowKey,
              catalogGroupKey: saved.catalogGroupKey ?? saved.catalog_group_key ?? p.catalogGroupKey,
              catalogPartCode: saved.partNumber ?? saved.part_number ?? p.catalogPartCode,
              isSaved: true,
              isSaving: false,
            }
          : p
      );
      setParts(nextParts);
      const actionAt = new Date().toISOString();
      const actionMessage = `${wasExisting ? "Line item updated" : "Line item added"}: ${row.part || "Unnamed part"}`;
      const nextLogs = appendInspectionLog("updated", actionAt, actionMessage);
      await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftPayload: buildDraftPayload(nextLogs, nextParts),
        }),
      });
      initialPartsSignatureRef.current = serializePartsForCompare(nextParts);
      initialChecksSignatureRef.current = serializeChecksForCompare(checks);
      toast.success("Line item saved successfully.");
      setLineItemErrors((prev) => ({ ...prev, [index]: {} }));
    } catch (err) {
      setParts((prev) => prev.map((p, i) => (i === index ? { ...p, isSaving: false } : p)));
      setError("Failed to save line item");
    }
  };

  const deleteLineItem = async (index: number) => {
    if (isReadOnly) {
      toast.error("Verified/cancelled inspection is read-only.");
      return;
    }
    if (isCollectCarPending) {
      toast.error("Complete Collect Car stage first.");
      return;
    }
    const row = parts[index];
    if (row?.partOrdered === 1 || row?.orderStatus === "Ordered" || row?.orderStatus === "Received") {
      toast.error("Ordered/received items cannot be deleted.");
      return;
    }
    if (row.id && companyId && inspectionId) {
      await fetch(
        `/api/company/${companyId}/workshop/inspections/${inspectionId}/line-items/${row.id}`,
        { method: "DELETE" }
      ).catch(() => null);
    }
    const rowKey = row?.clientRowKey || row?.id || `row-${index}`;
    setParts((prev) => prev.filter((_, i) => i !== index));
    setLineItemAiAnswers((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemAiQuestionsByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemAiRecommendationByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemAiLoadingByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemSmartSuggestionsByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemSmartSuggestionsLoadingByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setLineItemSmartSuggestionsFetchedByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setDismissedSmartSuggestionsByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    setExpandedLineItemsByRow((prev) => {
      const next = { ...prev };
      delete next[rowKey];
      return next;
    });
    toast.success("Line item deleted successfully.");
  };

  const makeLineItemClientRowKey = useCallback(
    () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const buildLineItemDraftFromCatalog = useCallback(
    (
      partName: string,
      partCode: string,
      groupKey: string,
      base?: Partial<(typeof parts)[number]>
    ) => ({
      part: partName,
      description: base?.description || partCode,
      qty: base?.qty || "1",
      reason: base?.reason || "Mandatory",
      catalogGroupKey: groupKey,
      catalogPartCode: partCode,
      clientRowKey: makeLineItemClientRowKey(),
      productId: null,
      productType: null,
      mediaFileId: null,
      isSaved: false,
    }),
    [makeLineItemClientRowKey]
  );
  const addSmartSuggestionAsLineItem = useCallback(
    async (
      index: number,
      rowKey: string,
      source: { catalogGroupKey?: string; reason?: string; description?: string },
      suggestion: SmartFaultSuggestion
    ) => {
      const rawLabel = suggestion.label.trim();
      const normalizedTarget = rawLabel.toLowerCase();
      const normalizedNeedle = normalizedTarget
        .replace(/^check\s+/i, "")
        .replace(/^inspect\s+/i, "")
        .replace(/[^a-z0-9\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      const parsedCodeMatch = rawLabel.match(/\(([^)]+)\)\s*$/);
      const parsedCode = String(parsedCodeMatch?.[1] ?? "").trim();
      const groupCandidates = vinCatalogParts.filter((part) =>
        (part.groups ?? []).some((group) => {
          const groupId = String(group?.id ?? "").trim();
          const groupName = String(group?.name ?? "").trim();
          const groupLevel = Number(group?.level ?? 0) || 0;
          const key = `${groupId || groupName}::${groupLevel}`;
          return key === String(source.catalogGroupKey ?? "");
        })
      );
      const matchedCatalogPart =
        (parsedCode
          ? groupCandidates.find((part) => String(part.code ?? "").trim().toLowerCase() === parsedCode.toLowerCase())
          : null) ??
        groupCandidates.find((part) => {
          const partName = String(part.name ?? "").toLowerCase().trim();
          if (!partName) return false;
          return partName.includes(normalizedNeedle) || normalizedNeedle.includes(partName);
        }) ??
        null;
      const resolvedPartName = matchedCatalogPart?.name?.trim() || rawLabel;
      const resolvedPartCode = matchedCatalogPart?.code?.trim() || parsedCode;
      const exists = parts.some((p) => String(p.part ?? "").trim().toLowerCase() === normalizedTarget);
      if (exists) {
        toast.message("Suggestion already exists in line items.");
        setDismissedSmartSuggestionsByRow((prev) => ({
          ...prev,
          [rowKey]: Array.from(new Set([...(prev[rowKey] ?? []), suggestion.id])),
        }));
        return;
      }
      const nextRow = buildLineItemDraftFromCatalog(
        resolvedPartName,
        resolvedPartCode,
        source.catalogGroupKey ?? "",
        {
          reason: source.reason || "Recommended",
          description: source.description || "",
        }
      );
      setParts((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, nextRow);
        return next;
      });
      if (nextRow.clientRowKey) {
        setExpandedLineItemsByRow((prev) => ({ ...prev, [nextRow.clientRowKey as string]: true }));
      }
      setDismissedSmartSuggestionsByRow((prev) => ({
        ...prev,
        [rowKey]: Array.from(new Set([...(prev[rowKey] ?? []), suggestion.id])),
      }));
      if (nextRow.clientRowKey) {
        void requestLineItemAi(
          nextRow.clientRowKey,
          {
            partName: resolvedPartName,
            partNumber: resolvedPartCode,
            groupName: "",
            description: source.description ?? "",
            status: source.reason ?? "Recommended",
          },
          undefined,
          undefined
        );
        void requestSmartFaultSuggestions(nextRow.clientRowKey, {
          partName: resolvedPartName,
          partNumber: resolvedPartCode,
          vin: inspectionVin.trim().toUpperCase(),
          category: "",
          groupName: "",
          description: source.description ?? "",
          status: source.reason ?? "Recommended",
        });
      }
      toast.success(`${resolvedPartName} added.`);
    },
    [buildLineItemDraftFromCatalog, inspectionVin, parts, requestLineItemAi, requestSmartFaultSuggestions, vinCatalogParts]
  );

  const addLineItemRow = async () => {
    const ready = await ensureVinCatalogForLineItems();
    if (!ready) return;
    toast.message("Use Car Group and Parts selection above to add line items.");
  };

  const saveAllDraftLineItems = async () => {
    if (isReadOnly || isCollectCarPending) return;
    const draftIndexes = partsRef.current
      .map((row, idx) => (!row.isSaved ? idx : -1))
      .filter((idx) => idx >= 0);
    if (!draftIndexes.length) {
      toast.success("No draft line items to save.");
      return;
    }
    for (const idx of draftIndexes) {
      await saveLineItem(idx);
    }
  };

  const bulkAddPartsFromGroup = useCallback(async () => {
    const ready = await ensureVinCatalogForLineItems();
    if (!ready) return;
    if (!bulkAddGroupKey) {
      toast.error("Select car group first.");
      return;
    }
    if (!bulkAddPartCodes.length) {
      toast.error("Select at least one part.");
      return;
    }
    const selectedParts = bulkAddPartCodes
      .map((code) =>
        vinCatalogParts.find(
          (part) =>
            part.code === code &&
            (part.groups ?? []).some((group) => {
              const groupId = String(group?.id ?? "").trim();
              const groupName = String(group?.name ?? "").trim();
              const groupLevel = Number(group?.level ?? 0) || 0;
              const key = `${groupId || groupName}::${groupLevel}`;
              return key === bulkAddGroupKey;
            })
        )
      )
      .filter(Boolean) as VinCatalogPart[];
    if (!selectedParts.length) {
      toast.error("No valid parts selected for this group.");
      return;
    }
    const groupLabel = vinCatalogGroups.find((group) => group.key === bulkAddGroupKey)?.label ?? "";
    const newRows = selectedParts.map((part) =>
      buildLineItemDraftFromCatalog(part.name || part.code || "", part.code || "", bulkAddGroupKey)
    );
    setParts((prev) => [...prev, ...newRows]);
    setExpandedLineItemsByRow((prev) => {
      const next = { ...prev };
      for (const row of newRows) {
        const key = String(row.clientRowKey ?? "");
        if (key) next[key] = false;
      }
      return next;
    });
    setBulkAddPartCodes([]);
    setBulkPartSearch("");
    for (const row of newRows) {
      if (!row.clientRowKey || !row.part) continue;
      void requestLineItemAi(
        row.clientRowKey,
        {
          partName: row.part,
          partNumber: row.catalogPartCode ?? "",
          groupName: groupLabel,
          description: row.description ?? "",
          status: row.reason ?? "",
        },
        undefined,
        undefined
      );
    }
    toast.success(`${newRows.length} line item(s) added.`);
  }, [
    bulkAddGroupKey,
    bulkAddPartCodes,
    buildLineItemDraftFromCatalog,
    ensureVinCatalogForLineItems,
    requestLineItemAi,
    vinCatalogGroups,
    vinCatalogParts,
  ]);

  const nextStepValidationMessage = () => {
    if (inspectionStep === 1 && !step1Complete) return "Complete Collect Car stage first.";
    if (inspectionStep === 2 && !step2Complete) return "Start inspection before moving to next step.";
    if (inspectionStep === 3 && !step3Complete) {
      if (rejectedMediaMissingReplacement) return "Upload replacement media for every rejected car image/video.";
      return "Complete car media review before moving to next step.";
    }
    if (inspectionStep === 4 && !step4Complete) return "Complete tyre sizes, mileage and VIN.";
    if (inspectionStep === 5 && !step5Complete) {
      if (hasAnyProcessIssue && !processIssueNotesComplete) {
        return "Add description for each check marked as ISSUE.";
      }
      return "Complete inspection checks and save all line items with required media before review.";
    }
    return "Please complete the current step.";
  };

  const persistDraftBeforeStepChange = async () => {
    if (!companyId || !inspectionId || isReadOnly) return true;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftPayload: buildDraftPayload(inspectionLogs, parts),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String(body?.error ?? "Failed to save inspection draft"));
      }
      return true;
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save inspection draft");
      return false;
    }
  };

  const goNextStep = async () => {
    const next = Math.min(6, inspectionStep + 1);
    if (next === inspectionStep) return;
    if (!canOpenStep(next)) {
      toast.error(nextStepValidationMessage());
      return;
    }
    setNextStepSaving(true);
    const saved = await persistDraftBeforeStepChange();
    setNextStepSaving(false);
    if (!saved) return;
    setInspectionStep(next);
  };

  const goPrevStep = () => setInspectionStep((prev) => Math.max(1, prev - 1));
  const addIssueNoteEntry = () => setIsAddingIssueNote(true);
  const resetIssueNoteComposer = () => {
    setIsAddingIssueNote(false);
    setNewIssueNoteDescription("");
    setNewIssueNoteImageFileId("");
  };
  const saveIssueNoteEntry = () => {
    const description = newIssueNoteDescription.trim();
    if (!description || !newIssueNoteImageFileId) {
      toast.error("Add description and image before adding note.");
      return;
    }
    const nextEntries = [
      ...inspectionIssueEntries,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description,
        imageFileId: newIssueNoteImageFileId,
      },
    ];
    setInspectionIssueEntries(nextEntries);
    void persistStep3MediaReview({ inspectionIssueEntries: nextEntries });
    resetIssueNoteComposer();
  };

  return (
    <AppLayout hideSidebar={isWorkshopView}>
      <div className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Inspection -</h1>
            <div className={`rounded-md border px-3 py-2 text-sm font-semibold ${theme.cardBorder}`}>
              {plateLabel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-md border border-white/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 sm:block">
              Status: {String(inspection?.status ?? "pending")}
            </div>
            {(startedAt || completedAt || cancelledAt) && (
              <div className="hidden flex-col items-end text-[11px] text-muted-foreground sm:flex">
                {startedAt && <div>Started: {new Date(startedAt).toLocaleString()}</div>}
                {completedAt && <div>Completed: {new Date(completedAt).toLocaleString()}</div>}
                {cancelledAt && <div className="text-rose-300">Cancelled: {new Date(cancelledAt).toLocaleString()}</div>}
              </div>
            )}
            <Link
              href={backHref}
              className="inline-flex items-center rounded-md border border-white/25 bg-transparent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/10"
            >
              Back
            </Link>
          </div>
        </div>
        {(startedAt || completedAt || cancelledAt) && (
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground sm:hidden">
            {startedAt && <div>Started: {new Date(startedAt).toLocaleString()}</div>}
            {completedAt && <div>Completed: {new Date(completedAt).toLocaleString()}</div>}
            {cancelledAt && <div className="text-rose-300">Cancelled: {new Date(cancelledAt).toLocaleString()}</div>}
          </div>
        )}
        <div className={`sticky top-2 z-20 rounded-md border px-3 py-2 ${theme.cardBorder} ${theme.cardBg}`}>
          <div className="flex flex-wrap items-center gap-2">
            {primaryStages.map((stage) => (
              <span
                key={stage.key}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  stage.done ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/15 text-white/70"
                }`}
              >
                {stage.label}
              </span>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {approvalStages.map((stage) => (
                <span
                  key={stage.key}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                    stage.done ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/15 text-white/70"
                  }`}
                >
                  {stage.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {inspectionSteps.map((step) => (
              <button
                key={step.id}
                type="button"
                disabled={!canOpenStep(step.id)}
                onClick={() => setInspectionStep(step.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                  inspectionStep === step.id
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                    : step.done
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                    : "border-white/15 text-white/70"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Step {step.id}: {step.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
            <span className={hasUnsavedChanges ? "text-amber-300" : "text-emerald-300"}>
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </span>
            {!isReadOnly && (
              <>
              {isCollectCarPending && <span className="text-amber-300">Collect Car stage is required before inspection workflow.</span>}
              {hasUnsavedLineItems && <span className="text-amber-300">Save all line items before completion.</span>}
              {requiredMediaMissing && <span className="text-amber-300">Required part media is missing.</span>}
              {!form.inspectorRemarks?.trim() && <span className="text-amber-300">Inspector remarks are required.</span>}
              {currentStatus === "completed" && !advisorApproved && !isWorkshopView && (
                <span className="text-cyan-300">Advisor approval pending.</span>
              )}
              </>
            )}
          </div>
          <div className="mt-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">AI Inspection Guide</div>
            <div className="mt-1 space-y-1 text-xs text-cyan-100/90">
              {aiQuestions.map((q, idx) => (
                <div key={`${inspectionStep}-q-${idx}`}>- {q}</div>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}
        {isCancelled && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            Inspection is cancelled{cancelledBy ? ` by ${cancelledBy}` : ""}{cancelledAt ? ` at ${new Date(cancelledAt).toLocaleString()}` : ""}.
            {cancelRemarks ? ` Remarks: ${cancelRemarks}` : ""}
          </div>
        )}
        {isVerified && !isCancelled && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Inspection is verified and locked from further edits.
          </div>
        )}
        {isLegacyCompletedReadonly && !isCancelled && !isVerified && (
          <div className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">
            Legacy completed inspection is read-only. Report values are preserved from source data.
          </div>
        )}

        <div className={`grid gap-4 ${isWorkshopView ? "" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"}`}>
          <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-sm font-semibold">Inspection Details</div>
              {loading && <div className="text-xs text-white/60">Loading...</div>}
            </div>
            <div className="pt-4">
              {inspectionStep === 1 && (
              <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Collect Car</div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      collectCarCompleted ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {collectCarCompleted ? "Completed" : "Pending"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-white/60">
                  Source:{" "}
                  <span className="font-semibold text-white/80">
                    {collectCarSourceType === "recovery"
                      ? "Recovery Pickup"
                      : collectCarSourceType === "walkin"
                      ? "Walk-in Check-in"
                      : "Unknown"}
                  </span>
                </div>
                {collectCarLatestReview?.reviewedAt && (
                  <div className="mt-1 text-[11px] text-white/60">
                    Reviewed at: {new Date(String(collectCarLatestReview.reviewedAt)).toLocaleString()}
                    {collectCarLatestReview?.reviewedBy ? ` by ${collectCarLatestReview.reviewedBy}` : ""}
                  </div>
                )}
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {Object.entries(collectCarSourceMedia).filter(([, fileId]) => Boolean(fileId)).length === 0 ? (
                    <div className="rounded border border-dashed border-white/20 p-2 text-xs text-white/60 lg:col-span-2">
                      No source media found.
                    </div>
                  ) : (
                    Object.entries(collectCarSourceMedia)
                      .filter(([, fileId]) => Boolean(fileId))
                      .map(([key, fileId]) => (
                        <div key={key} className="rounded border border-white/10 bg-black/20 p-2">
                          <div className="text-[11px] text-white/70">{collectMediaLabel(key)}</div>
                          <div className="mt-2">
                            {isVideoMediaKey(key) ? (
                              <video
                                className="h-28 w-full rounded border border-white/10 object-cover"
                                controls
                                preload="metadata"
                                src={`/api/files/${fileId}`}
                              />
                            ) : (
                              <img
                                className="h-28 w-full rounded border border-white/10 object-cover"
                                src={`/api/files/${fileId}`}
                                alt={collectMediaLabel(key)}
                              />
                            )}
                          </div>
                          <a
                            href={`/api/files/${fileId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-primary hover:underline"
                          >
                            Open file
                          </a>
                          {collectCarNeedsReupload && !isReadOnly && (
                            <div className="mt-2">
                              <FileUploader
                                label=""
                                kind={isVideoMediaKey(key) ? "video" : "image"}
                                value={collectCarReuploadMedia[key] ?? ""}
                                onChange={(id) =>
                                  setCollectCarReuploadMedia((prev) => ({ ...prev, [key]: String(id ?? "") }))
                                }
                                buttonOnly
                                showPreview
                                buttonClassName="h-9"
                              />
                              {collectCarReuploadMedia[key] && (
                                <div className="mt-2">
                                  {isVideoMediaKey(key) ? (
                                    <video
                                      className="h-28 w-full rounded border border-emerald-500/30 object-cover"
                                      controls
                                      preload="metadata"
                                      src={`/api/files/${collectCarReuploadMedia[key]}`}
                                    />
                                  ) : (
                                    <img
                                      className="h-28 w-full rounded border border-emerald-500/30 object-cover"
                                      src={`/api/files/${collectCarReuploadMedia[key]}`}
                                      alt={`Reupload ${collectMediaLabel(key)}`}
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
                {!isReadOnly && (
                  <>
                    <div className="mt-3">
                      <div className="text-[11px] text-white/70">Any difference between source media and received car?</div>
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1 text-white/80">
                          <input
                            type="radio"
                            name="collect-car-difference"
                            checked={collectCarDifference === "no"}
                            onChange={() => setCollectCarDifference("no")}
                            className="h-3.5 w-3.5"
                          />
                          No difference
                        </label>
                        <label className="flex items-center gap-1 text-white/80">
                          <input
                            type="radio"
                            name="collect-car-difference"
                            checked={collectCarDifference === "yes"}
                            onChange={() => setCollectCarDifference("yes")}
                            className="h-3.5 w-3.5"
                          />
                          Yes, there is a difference
                        </label>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[11px] font-semibold text-white/70">Notes</label>
                      <textarea
                        className={theme.input}
                        rows={2}
                        value={collectCarNote}
                        onChange={(e) => setCollectCarNote(e.target.value)}
                        placeholder="Optional notes about mismatch/review."
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                        disabled={collectCarSaving || collectCarCompleted}
                        onClick={saveCollectCarReview}
                      >
                        {collectCarSaving ? "Saving..." : collectCarCompleted ? "Collect Car Completed" : "Save Collect Car Stage"}
                      </button>
                    </div>
                  </>
                )}
                {collectCarLogs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {collectCarLogs.slice(0, 3).map((log, idx) => (
                      <div key={String(log?.id ?? idx)} className="rounded bg-white/5 px-2 py-1 text-[10px] text-white/75">
                        Review: {log?.hasDifference ? "Difference found" : "No difference"} at{" "}
                        {log?.reviewedAt ? new Date(String(log.reviewedAt)).toLocaleString() : "-"}
                        {log?.reviewedBy ? ` by ${log.reviewedBy}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
              {inspectionStep >= 3 && (
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Pre-Inspection Form</div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      !preInspection
                        ? "bg-slate-500/15 text-slate-300"
                        : preInspection?.status === "submitted"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {!preInspection ? "Not requested" : preInspection?.status === "submitted" ? "Submitted" : "Pending"}
                  </span>
                </div>
                {preInspection?.submittedAt && (
                  <div className="mt-1 text-[11px] text-white/60">
                    Submitted at: {new Date(preInspection.submittedAt).toLocaleString()}
                  </div>
                )}
                {preInspection?.status === "submitted" && preInspection?.answers && (
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {Object.entries(preInspection.answers as Record<string, unknown>)
                      .filter(([key]) => !isSystemPreInspectionKey(key))
                      .map(([key, answer]) => {
                      if (answer === null || answer === undefined) return null;
                      const rawChoice =
                        answer && typeof answer === "object" && !Array.isArray(answer)
                          ? (answer as Record<string, unknown>)?.choice
                          : null;
                      const choice = String(rawChoice ?? "").toLowerCase();
                      const summary = choice
                        ? choice === "yes"
                          ? "Yes"
                          : choice === "no"
                          ? "No"
                          : String(rawChoice)
                        : toDisplayText(answer) || "-";
                      const details = collectPreInspectionDetails(answer);
                      return (
                        <div key={key} className="rounded border border-white/10 bg-black/20 p-2">
                          <div className="text-[11px] text-white/70">
                            {preInspectionQuestionLabels[key] ?? formatQuestionKeyLabel(key)}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-white">
                            {summary}
                          </div>
                          {details.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {details.map((item, idx) => (
                                <div key={`${key}-${item.key}-${idx}`} className="text-[11px] text-white/70">
                                  <span className="text-white/50">{formatDetailKey(item.key)}:</span> {item.value}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
            </div>
            {inspectionStep >= 2 && (
            <>
            {inspectionStep === 2 && (
              <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                <div className="font-semibold uppercase tracking-wide">Step 2: Start Inspection</div>
                <div className="mt-1">
                  Confirm collect car review is done, then use the Start button below to begin inspection.
                </div>
              </div>
            )}
            <div className="hidden">
              <div className="lg:col-span-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Checklist</div>
                {!isReadOnly && (
                  <button
                    type="button"
                    className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                    onClick={() => {
                      const next: Record<string, CheckValue> = {};
                      checkItems.forEach((item) => {
                        next[item.key] = "avg";
                      });
                      setChecks((prev) => ({ ...prev, ...next }));
                    }}
                  >
                    Set all Avg
                  </button>
                )}
              </div>
              {checkItems.map((item) => (
                <div key={item.key} className="grid items-center gap-3 text-sm md:grid-cols-[140px_auto]">
                  <div className="font-semibold text-blue-400">{item.label}</div>
                  <div className="flex items-center gap-2 text-xs">
                    {(["good", "avg", "bad"] as CheckValue[]).map((val) => {
                      const isChecked = checks[item.key] === val;
                      const colorClass =
                        val === "good"
                          ? "text-emerald-400"
                          : val === "avg"
                          ? "text-amber-400"
                          : "text-rose-400";
                      return (
                        <label key={val} className={`flex items-center gap-1 ${colorClass}`}>
                          <input
                            type="radio"
                            name={`check-${item.key}`}
                            checked={isChecked}
                            aria-disabled={isReadOnly || isCollectCarPending}
                            onChange={() => {
                              if (isReadOnly || isCollectCarPending) return;
                              updateCheck(item.key, val);
                            }}
                            className={`h-3.5 w-3.5 ${isReadOnly || isCollectCarPending ? "cursor-default" : "cursor-pointer"}`}
                            style={{
                              accentColor:
                                val === "good" ? "#34d399" : val === "avg" ? "#fbbf24" : "#fb7185",
                            }}
                          />
                          <span className="capitalize">{val}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden">
              <div>
                <label className="text-xs font-semibold text-white/70">Lead Branch</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.advisorName}
                  readOnly
                  placeholder="SC_Department"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Inspector Name</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.inspectorName}
                  readOnly
                  placeholder="master_admin"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Car-In Mileage</label>
                <input
                  type="text"
                  className={theme.input}
                  value={form.carInMileage}
                  readOnly={isReadOnly || isCollectCarPending}
                  onChange={(e) => setForm((prev) => ({ ...prev, carInMileage: e.target.value }))}
                  placeholder="543367685"
                />
              </div>
            </div>

            <div className="hidden">
              <div>
                <label className="text-xs font-semibold text-white/70">Customer Complain</label>
                <textarea
                  className={theme.input}
                  rows={4}
                  value={form.customerComplain}
                  readOnly
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/70">Inspector Remarks</label>
                <textarea
                  className={theme.input}
                  rows={4}
                  value={form.inspectorRemarks}
                  readOnly={isReadOnly || isCollectCarPending}
                  onChange={(e) => setForm((prev) => ({ ...prev, inspectorRemarks: e.target.value }))}
                />
              </div>
            </div>

            <div className="hidden">
              <div className="text-sm font-semibold">Inspection Videos</div>
              <div className={`mt-2 rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-white/70">Car In Video</div>
                    <div
                      {...carInDropzone.getRootProps()}
                      className={`cursor-pointer rounded-md border border-dashed px-4 py-5 text-center text-xs transition ${
                        carInDropzone.isDragActive ? "border-cyan-400 bg-cyan-500/10 text-cyan-200" : "border-white/20 text-white/70 hover:bg-white/5"
                      }`}
                    >
                      <input {...carInDropzone.getInputProps()} />
                      {videoUploading === "in"
                        ? `Uploading... ${videoUploadProgress.in}%`
                        : "Drop video here or click to upload"}
                    </div>
                    {videoUploading === "in" && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all duration-150"
                            style={{ width: `${videoUploadProgress.in}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-white/60">{videoUploadProgress.in}% uploaded</div>
                      </div>
                    )}
                    {carInVideoId && (
                      <div className="space-y-2">
                        <video
                          className="h-[200px] w-[200px] rounded-md border border-white/10 object-cover"
                          controls
                          preload="metadata"
                          src={`/api/files/${carInVideoId}`}
                        />
                        <a
                          href={`/api/files/${carInVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Open video
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-white/70">Car Out Video</div>
                    <div
                      {...carOutDropzone.getRootProps()}
                      className={`cursor-pointer rounded-md border border-dashed px-4 py-5 text-center text-xs transition ${
                        carOutDropzone.isDragActive ? "border-cyan-400 bg-cyan-500/10 text-cyan-200" : "border-white/20 text-white/70 hover:bg-white/5"
                      }`}
                    >
                      <input {...carOutDropzone.getInputProps()} />
                      {videoUploading === "out"
                        ? `Uploading... ${videoUploadProgress.out}%`
                        : "Drop video here or click to upload"}
                    </div>
                    {videoUploading === "out" && (
                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-400 transition-all duration-150"
                            style={{ width: `${videoUploadProgress.out}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-white/60">{videoUploadProgress.out}% uploaded</div>
                      </div>
                    )}
                    {carOutVideoId && (
                      <div className="space-y-2">
                        <video
                          className="h-[200px] w-[200px] rounded-md border border-white/10 object-cover"
                          controls
                          preload="metadata"
                          src={`/api/files/${carOutVideoId}`}
                        />
                        <a
                          href={`/api/files/${carOutVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Open video
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 3 ? "" : "hidden"}`}>
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-semibold">Issues and Mandatory Checks</div>
                <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white/80">Car Media Verification (Front/Rear/Right/Left + 360 Video)</div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/70">
                        {carMediaCounts.verified}/{carMediaCounts.total} verified
                      </span>
                      <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
                        Pending: {carMediaCounts.pending}
                      </span>
                      <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">
                        Rejected: {carMediaCounts.rejected}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-3 lg:grid-cols-2">
                    {sortedCarMediaKeys.map((key) => {
                      const fileId = collectCarSourceMedia[key];
                      const label = key === "video" ? "360 Video" : `${key[0]?.toUpperCase()}${key.slice(1)} Image`;
                      const reviewStatus = carMediaReview[key];
                      const replacementId = carMediaReplacement[key];
                      const rejectNote = carMediaRejectNote[key];
                      return (
                        <div
                          key={key}
                          className={`rounded border p-2 ${
                            reviewStatus === "verified"
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : reviewStatus === "rejected"
                              ? "border-rose-500/30 bg-rose-500/5"
                              : "border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] text-white/70">{label}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                reviewStatus === "verified"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : reviewStatus === "rejected"
                                  ? "bg-rose-500/15 text-rose-300"
                                  : "bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {reviewStatus}
                            </span>
                          </div>
                          {fileId ? (
                            <>
                              {key === "video" ? (
                                <video
                                  className="mt-2 h-32 w-full rounded border border-white/10 object-cover"
                                  controls
                                  preload="metadata"
                                  src={`/api/files/${fileId}`}
                                />
                              ) : (
                                <img
                                  className="mt-2 h-32 w-full rounded border border-white/10 object-cover"
                                  src={`/api/files/${fileId}`}
                                  alt={label}
                                />
                              )}
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <a
                                  href={`/api/files/${fileId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-primary hover:underline"
                                >
                                  Open {key === "video" ? "video" : "image"}
                                </a>
                                <div className="flex items-center gap-2">
                                  {reviewStatus === "pending" ? (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                                        disabled={isReadOnly || isCollectCarPending}
                                        onClick={async () => {
                                          const nextReview = {
                                            ...carMediaReview,
                                            [key]: "verified" as CarMediaReviewStatus,
                                          };
                                          const nextReason = { ...carMediaRejectReason, [key]: "" };
                                          const nextNote = { ...carMediaRejectNote, [key]: "" };
                                          setCarMediaReview(nextReview);
                                          setCarMediaRejectReason(nextReason);
                                          setCarMediaRejectNote(nextNote);
                                          await persistStep3MediaReview({
                                            review: nextReview,
                                            rejectReason: nextReason,
                                            rejectNote: nextNote,
                                          });
                                        }}
                                      >
                                        Verify
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                                        disabled={isReadOnly || isCollectCarPending}
                                        onClick={async () => {
                                          const nextReview = {
                                            ...carMediaReview,
                                            [key]: "rejected" as CarMediaReviewStatus,
                                          };
                                          const nextReason = {
                                            ...carMediaRejectReason,
                                            [key]: carMediaRejectReason[key] || carMediaRejectReasons[0]!,
                                          };
                                        setCarMediaReview(nextReview);
                                        setCarMediaRejectReason(nextReason);
                                        toast.info("Rejected media requires replacement upload.");
                                        await persistStep3MediaReview({
                                          review: nextReview,
                                          rejectReason: nextReason,
                                          });
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                                      disabled={isReadOnly || isCollectCarPending}
                                      onClick={async () => {
                                        const nextReview = { ...carMediaReview, [key]: "pending" as CarMediaReviewStatus };
                                        setCarMediaReview(nextReview);
                                        await persistStep3MediaReview({ review: nextReview });
                                      }}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              </div>
                              {reviewStatus === "rejected" && (
                                <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 p-2">
                                  <div className="text-[11px] text-rose-200">Upload new media (old media is kept)</div>
                                  {!replacementId && (
                                    <div className="mt-1 text-[10px] text-rose-300">Replacement file is required.</div>
                                  )}
                                  <textarea
                                    className={`${theme.input} mt-2`}
                                    rows={2}
                                    placeholder="Add short reject note..."
                                    value={rejectNote}
                                    readOnly={isReadOnly || isCollectCarPending}
                                    onChange={(e) =>
                                      setCarMediaRejectNote((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    onBlur={() => {
                                      const nextNote = { ...carMediaRejectNote, [key]: rejectNote };
                                      void persistStep3MediaReview({ rejectNote: nextNote });
                                    }}
                                  />
                                  <div className="mt-2">
                                    <FileUploader
                                      label=""
                                      kind={key === "video" ? "video" : "image"}
                                      value={replacementId}
                                      onChange={(id) => {
                                        const nextReplacement = {
                                          ...carMediaReplacement,
                                          [key]: String(id ?? ""),
                                        };
                                        setCarMediaReplacement(nextReplacement);
                                        void persistStep3MediaReview({ replacement: nextReplacement });
                                      }}
                                      disabled={isReadOnly || isCollectCarPending}
                                      buttonOnly
                                      showPreview
                                      buttonClassName="h-9"
                                    />
                                  </div>
                                  {replacementId && (
                                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                      <div className="rounded border border-white/10 bg-black/20 p-2">
                                        <div className="text-[10px] text-white/60">Original</div>
                                        {key === "video" ? (
                                          <video
                                            className="mt-1 h-24 w-full rounded border border-white/10 object-cover"
                                            controls
                                            preload="metadata"
                                            src={`/api/files/${fileId}`}
                                          />
                                        ) : (
                                          <img
                                            className="mt-1 h-24 w-full rounded border border-white/10 object-cover"
                                            src={`/api/files/${fileId}`}
                                            alt={`Original ${label}`}
                                          />
                                        )}
                                      </div>
                                      <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2">
                                        <div className="text-[10px] text-emerald-300">Replacement</div>
                                        {key === "video" ? (
                                          <video
                                            className="mt-1 h-24 w-full rounded border border-emerald-500/30 object-cover"
                                            controls
                                            preload="metadata"
                                            src={`/api/files/${replacementId}`}
                                          />
                                        ) : (
                                          <img
                                            className="mt-1 h-24 w-full rounded border border-emerald-500/30 object-cover"
                                            src={`/api/files/${replacementId}`}
                                            alt={`Replacement ${label}`}
                                          />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="mt-2 text-[11px] text-white/50">No media uploaded.</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {rejectedMediaMissingReplacement && (
                    <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
                      Replacement upload is required for rejected media before moving to next step.
                    </div>
                  )}
                </div>
                <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-white/70">Issues / Damages Notes</label>
                    {!isReadOnly && !isCollectCarPending && (
                      <button
                        type="button"
                        className="rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                        onClick={addIssueNoteEntry}
                        disabled={isAddingIssueNote}
                      >
                        + Add Note
                      </button>
                    )}
                  </div>
                  {isAddingIssueNote && (
                    <div className="mt-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-2">
                      <div>
                        <label className="text-[11px] text-white/70">Description</label>
                        <textarea
                          className={theme.input}
                          rows={2}
                          value={newIssueNoteDescription}
                          onChange={(e) => setNewIssueNoteDescription(e.target.value)}
                          placeholder="Describe the issue/damage..."
                        />
                      </div>
                      <div className="mt-2">
                        <FileUploader
                          label="Issue Image"
                          kind="image"
                          value={newIssueNoteImageFileId}
                          onChange={(id) => setNewIssueNoteImageFileId(String(id ?? ""))}
                          buttonOnly
                          showPreview
                          buttonClassName="h-9"
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-cyan-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                          onClick={saveIssueNoteEntry}
                        >
                          Add Note
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80"
                          onClick={resetIssueNoteComposer}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {inspectionIssueEntries.length === 0 ? (
                    <div className="mt-2 text-[11px] text-white/60">
                      No issue notes added. Click <span className="font-semibold text-white/80">Add Note</span> to attach image and description.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {inspectionIssueEntries.map((entry, index) => (
                        <div key={entry.id} className="rounded-md border border-white/10 bg-black/30 p-2">
                          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-white/70">
                            <span>Note #{index + 1}</span>
                            {!isReadOnly && !isCollectCarPending && (
                              <button
                                type="button"
                                className="rounded bg-rose-600 px-2 py-1 text-[10px] font-semibold text-white"
                                onClick={() => {
                                  const nextEntries = inspectionIssueEntries.filter((item) => item.id !== entry.id);
                                  setInspectionIssueEntries(nextEntries);
                                  void persistStep3MediaReview({ inspectionIssueEntries: nextEntries });
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div>
                            <label className="text-[11px] text-white/70">Description</label>
                            <textarea
                              className={theme.input}
                              rows={2}
                              value={entry.description}
                              readOnly={isReadOnly || isCollectCarPending}
                              onChange={(e) =>
                                setInspectionIssueEntries((prev) =>
                                  prev.map((item) =>
                                    item.id === entry.id ? { ...item, description: e.target.value } : item
                                  )
                                )
                              }
                              onBlur={() => {
                                void persistStep3MediaReview({ inspectionIssueEntries });
                              }}
                              placeholder="Describe the issue/damage..."
                            />
                          </div>
                          <div className="mt-2">
                            <FileUploader
                              label="Issue Image"
                              kind="image"
                              value={entry.imageFileId}
                              onChange={(id) =>
                                {
                                  const nextEntries = inspectionIssueEntries.map((item) =>
                                    item.id === entry.id ? { ...item, imageFileId: String(id ?? "") } : item
                                  );
                                  setInspectionIssueEntries(nextEntries);
                                  void persistStep3MediaReview({ inspectionIssueEntries: nextEntries });
                                }
                              }
                              disabled={isReadOnly || isCollectCarPending}
                              buttonOnly
                              showPreview
                              buttonClassName="h-9"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 4 ? "" : "hidden"}`}>
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-semibold">Vehicle Data and VIN</div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-white/70">VIN</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={inspectionVin}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setInspectionVin(e.target.value.toUpperCase())}
                      placeholder="Enter VIN"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                      disabled={isReadOnly || isCollectCarPending || vinLookupLoading}
                      onClick={autoFillVehicleFromVin}
                    >
                      {vinLookupLoading ? "Checking VIN..." : "Check VIN and Fetch Data"}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Car Make</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={inspectionMake}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setInspectionMake(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Car Model</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={inspectionModel}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setInspectionModel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Car Year</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={inspectionYear}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setInspectionYear(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Tyre Size (Front)</label>
                    <select
                      className={theme.input}
                      value={tyreSizeFront}
                      disabled={isReadOnly || isCollectCarPending}
                      onChange={(e) => setTyreSizeFront(e.target.value)}
                    >
                      <option value="">Select front tyre size</option>
                      {tyreSizeFront && !TYRE_SIZE_OPTIONS.includes(tyreSizeFront) ? (
                        <option value={tyreSizeFront}>{tyreSizeFront} (saved)</option>
                      ) : null}
                      {TYRE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Tyre Size (Rear)</label>
                    <select
                      className={theme.input}
                      value={tyreSizeRear}
                      disabled={isReadOnly || isCollectCarPending}
                      onChange={(e) => setTyreSizeRear(e.target.value)}
                    >
                      <option value="">Select rear tyre size</option>
                      {tyreSizeRear && !TYRE_SIZE_OPTIONS.includes(tyreSizeRear) ? (
                        <option value={tyreSizeRear}>{tyreSizeRear} (saved)</option>
                      ) : null}
                      {TYRE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Car Mileage</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={form.carInMileage}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setForm((prev) => ({ ...prev, carInMileage: e.target.value }))}
                      placeholder="Current odometer reading"
                    />
                  </div>
                </div>
                {vinLookupNote && <div className="mt-2 text-xs text-cyan-200">{vinLookupNote}</div>}
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 5 ? "" : "hidden"}`}>
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-semibold">Inspection Checks</div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {processCheckItems.map((item) => (
                    <div key={item.key} className="rounded-md border border-white/10 bg-black/20 p-3">
                      <div className="text-xs font-semibold text-white/80">{item.label}</div>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        {(["ok", "issue", "na"] as ProcessCheckValue[]).map((value) => (
                          <label key={value} className="flex items-center gap-1 text-white/80">
                            <input
                              type="radio"
                              name={`process-${item.key}`}
                              checked={processChecks[item.key] === value}
                              disabled={isReadOnly || isCollectCarPending}
                              onChange={() => updateProcessCheck(item.key, value)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="uppercase">{value}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2">
                        <label className="text-xs font-semibold text-white/70">{item.label} images</label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={isReadOnly || isCollectCarPending || processCheckUploading[item.key]}
                          className={`${theme.input} mt-1`}
                          onChange={(e) => {
                            void uploadProcessCheckFiles(item.key, e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                        {processCheckUploading[item.key] && (
                          <div className="mt-1 text-[11px] text-cyan-300">Uploading images...</div>
                        )}
                      </div>
                      {processChecks[item.key] === "issue" && (
                        <div className="mt-2">
                          <label className="text-[11px] text-white/70">Issue Description</label>
                          <textarea
                            className={theme.input}
                            rows={2}
                            value={processCheckIssueNotes[item.key] ?? ""}
                            readOnly={isReadOnly || isCollectCarPending}
                            onChange={(e) =>
                              setProcessCheckIssueNotes((prev) => ({
                                ...prev,
                                [item.key]: e.target.value,
                              }))
                            }
                            placeholder={`Describe ${item.label.toLowerCase()} issue...`}
                          />
                        </div>
                      )}
                      {(processCheckMediaMulti[item.key]?.length ?? 0) > 0 && (
                        <div className="mt-2 rounded border border-white/10 bg-black/30 p-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(processCheckMediaMulti[item.key] ?? []).map((fileId, mediaIndex) => (
                              <div key={`${fileId}-${mediaIndex}`} className="rounded border border-white/10 bg-black/20 p-2">
                                <img
                                  className="h-24 w-full rounded border border-white/10 object-cover"
                                  src={`/api/files/${fileId}`}
                                  alt={`${item.label} upload ${mediaIndex + 1}`}
                                />
                                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                                  <a
                                    href={`/api/files/${fileId}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary hover:underline"
                                  >
                                    Open
                                  </a>
                                  {!isReadOnly && !isCollectCarPending && (
                                    <button
                                      type="button"
                                      className="rounded bg-rose-600 px-2 py-0.5 font-semibold text-white"
                                      onClick={() => {
                                        setProcessCheckMediaMulti((prev) => {
                                          const next = (prev[item.key] ?? []).filter((_, i) => i !== mediaIndex);
                                          setProcessCheckMedia((singlePrev) => ({
                                            ...singlePrev,
                                            [item.key]: next[0] ?? "",
                                          }));
                                          return { ...prev, [item.key]: next };
                                        });
                                        setProcessMediaVerified((prev) => ({ ...prev, [item.key]: false }));
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                                processMediaVerified[item.key]
                                  ? "bg-emerald-600 text-white"
                                  : "bg-amber-600 text-white"
                              }`}
                              disabled={isReadOnly || isCollectCarPending}
                              onClick={() =>
                                setProcessMediaVerified((prev) => ({
                                  ...prev,
                                  [item.key]: !prev[item.key],
                                }))
                              }
                            >
                              {processMediaVerified[item.key] ? "Verified" : "Verify"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Findings / Parts Needed</div>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-white/70">Total: {parts.length}</span>
                    <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
                      Received: {parts.filter((p) => (p.orderStatus ?? "").toLowerCase() === "received").length}
                    </span>
                    <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
                      Ordered: {parts.filter((p) => (p.orderStatus ?? "").toLowerCase() === "ordered").length}
                    </span>
                    <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-cyan-300">
                      Draft: {parts.filter((p) => !p.isSaved).length}
                    </span>
                  </div>
                  {!isReadOnly && !isCollectCarPending && (
                    <>
                      <button
                        type="button"
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                        onClick={() => void saveAllDraftLineItems()}
                        disabled={parts.filter((p) => !p.isSaved).length === 0}
                      >
                        Save All Draft
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                        onClick={addLineItemRow}
                        disabled={vinCatalogLoading || (parts.length > 0 && parts.some((p) => !p.isSaved))}
                      >
                        {vinCatalogLoading ? "Loading..." : "+ Add Line Item"}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">AI Line Item Assistant</div>
                <div className="mt-2 grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-semibold text-cyan-100/90">Questions</div>
                    <div className="mt-1 space-y-1 text-xs text-cyan-100/85">
                      {lineItemAiInsights.questions.map((q, idx) => (
                        <div key={`li-q-${idx}`}>- {q}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-cyan-100/90">Suggestions</div>
                    <div className="mt-1 space-y-1 text-xs text-cyan-100/85">
                      {lineItemAiInsights.suggestions.map((s, idx) => (
                        <div key={`li-s-${idx}`}>- {s}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {vinCatalogGroups.length > 0 && !isReadOnly && !isCollectCarPending && (
                <div className="mt-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
                    Add Multiple Line Items By Group
                  </div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-[1.2fr_auto] lg:items-end">
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-100/80">Car Group</div>
                      <select
                        className={`${theme.input} h-10 w-full`}
                        value={bulkAddGroupKey}
                        onChange={(e) => {
                          setBulkAddGroupKey(e.target.value);
                          setBulkAddPartCodes([]);
                          setBulkPartSearch("");
                        }}
                      >
                        <option value="">Select Car Group</option>
                        {vinCatalogGroups.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="h-10 rounded-md bg-teal-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      disabled={!bulkAddGroupKey || bulkAddPartCodes.length === 0}
                      onClick={() => void bulkAddPartsFromGroup()}
                    >
                      Add Selected Parts
                    </button>
                  </div>
                  {bulkAddGroupKey && (
                    <div className="mt-2">
                      <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto]">
                        <input
                          type="text"
                          className={`${theme.input} h-10 w-full`}
                          value={bulkPartSearch}
                          onChange={(e) => setBulkPartSearch(e.target.value)}
                          placeholder="Search parts in selected group"
                        />
                        <button
                          type="button"
                          className="h-10 rounded-md border border-cyan-500/40 px-3 text-xs font-semibold text-cyan-100"
                          onClick={() => {
                            const allVisibleCodes = vinCatalogParts
                              .filter((part) =>
                                (part.groups ?? []).some((group) => {
                                  const groupId = String(group?.id ?? "").trim();
                                  const groupName = String(group?.name ?? "").trim();
                                  const groupLevel = Number(group?.level ?? 0) || 0;
                                  const key = `${groupId || groupName}::${groupLevel}`;
                                  return key === bulkAddGroupKey;
                                })
                              )
                              .filter((part) => {
                                const needle = bulkPartSearch.trim().toLowerCase();
                                if (!needle) return true;
                                const label = `${part.name || ""} ${part.code || ""}`.toLowerCase();
                                return label.includes(needle);
                              })
                              .map((part) => part.code);
                            setBulkAddPartCodes(allVisibleCodes);
                          }}
                        >
                          Select All Visible
                        </button>
                        <button
                          type="button"
                          className="h-10 rounded-md border border-white/20 px-3 text-xs font-semibold text-white/80"
                          onClick={() => setBulkAddPartCodes([])}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="mt-2 max-h-56 space-y-1 overflow-auto rounded-md border border-white/10 p-2">
                        {vinCatalogParts
                          .filter((part) =>
                            (part.groups ?? []).some((group) => {
                              const groupId = String(group?.id ?? "").trim();
                              const groupName = String(group?.name ?? "").trim();
                              const groupLevel = Number(group?.level ?? 0) || 0;
                              const key = `${groupId || groupName}::${groupLevel}`;
                              return key === bulkAddGroupKey;
                            })
                          )
                          .filter((part) => {
                            const needle = bulkPartSearch.trim().toLowerCase();
                            if (!needle) return true;
                            const label = `${part.name || ""} ${part.code || ""}`.toLowerCase();
                            return label.includes(needle);
                          })
                          .map((part) => {
                            const selected = bulkAddPartCodes.includes(part.code);
                            return (
                              <label
                                key={`bulk-pick-${part.code}-${part.name}`}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs hover:bg-white/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(e) => {
                                    setBulkAddPartCodes((prev) => {
                                      if (e.target.checked) {
                                        if (prev.includes(part.code)) return prev;
                                        return [...prev, part.code];
                                      }
                                      return prev.filter((code) => code !== part.code);
                                    });
                                  }}
                                />
                                <span className="text-white/85">{part.name || "Unnamed part"}</span>
                                <span className="text-white/55">{part.code ? `(${part.code})` : ""}</span>
                              </label>
                            );
                          })}
                      </div>
                      <div className="mt-2 text-[11px] text-cyan-100/80">
                        {bulkAddPartCodes.length} part(s) selected.
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className={`mt-2 rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
                {parts.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/20 bg-black/20 p-4 text-center">
                    <div className="text-xs text-white/70">No line items added yet.</div>
                    {!isReadOnly && !isCollectCarPending && (
                      <button
                        type="button"
                        className="mt-3 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
                        onClick={addLineItemRow}
                        disabled={vinCatalogLoading}
                      >
                        {vinCatalogLoading ? "Loading..." : "Add Line Item"}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="hidden w-full gap-3 text-xs font-semibold text-white/70 lg:grid lg:grid-cols-[2fr_1.2fr_2fr_1fr_1.2fr_1fr_1.5fr]">
                      <div>Parts Needed</div>
                      <div>Part Number</div>
                      <div>Description</div>
                      <div>Quantity</div>
                      <div>Status</div>
                      <div>Picture / Video</div>
                      <div>Actions</div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {groupedLineItemOrder.map(({ row, index, groupKey, groupLabel }, orderIdx) => {
                    const isNewGroup = orderIdx === 0 || groupedLineItemOrder[orderIdx - 1]?.groupKey !== groupKey;
                    const summary =
                      groupKey === "__ungrouped__"
                        ? {
                            label: "Ungrouped",
                            parts: [] as string[],
                            healthPercent: 100,
                            severityCounts: { "Safety Risk": 0, Mandatory: 0, Recommended: 0, Optional: 0 },
                          }
                        : groupSummaryByKey.get(groupKey) ??
                          {
                            label: groupLabel,
                            parts: [] as string[],
                            healthPercent: 100,
                            severityCounts: { "Safety Risk": 0, Mandatory: 0, Recommended: 0, Optional: 0 },
                          };
                    const isLocked =
                      isReadOnly || isCollectCarPending || row.partOrdered === 1 || row.orderStatus === "Ordered" || row.orderStatus === "Received";
                    const rowKey = row.clientRowKey || row.id || `row-${index}`;
                    const selectedGroupKey = String(row.catalogGroupKey ?? "");
                    const selectedPartCode = String(row.catalogPartCode ?? "");
                    const selectedGroupLabel =
                      vinCatalogGroups.find((group) => group.key === selectedGroupKey)?.label ?? "";
                    const rowAiQuestions = lineItemAiQuestionsByRow[rowKey] ?? [];
                    const rowAiAnswers = lineItemAiAnswers[rowKey] ?? {};
                    const smartSuggestionsBase =
                      lineItemSmartSuggestionsByRow[rowKey] && lineItemSmartSuggestionsByRow[rowKey]!.length > 0
                        ? lineItemSmartSuggestionsByRow[rowKey]!
                        : generateSmartFaultSuggestions(
                            String(row.part ?? ""),
                            selectedGroupLabel,
                            String(row.description ?? "")
                          );
                    const dismissedSuggestionIds = dismissedSmartSuggestionsByRow[rowKey] ?? [];
                    const existingPartNames = new Set(
                      parts
                        .map((p) => String(p.part ?? "").trim().toLowerCase())
                        .filter(Boolean)
                    );
                    const existingPartCodes = new Set(
                      parts
                        .map((p) => String(p.catalogPartCode ?? "").trim().toLowerCase())
                        .filter(Boolean)
                    );
                    const smartSuggestions = smartSuggestionsBase.filter((s) => {
                      if (dismissedSuggestionIds.includes(s.id)) return false;
                      const label = String(s.label ?? "").trim();
                      const lower = label.toLowerCase();
                      const codeMatch = label.match(/\(([^)]+)\)\s*$/);
                      const code = String(codeMatch?.[1] ?? "").trim().toLowerCase();
                      if (existingPartNames.has(lower)) return false;
                      if (code && existingPartCodes.has(code)) return false;
                      return true;
                    });
                    const smartSuggestionsLoading = Boolean(lineItemSmartSuggestionsLoadingByRow[rowKey]);
                    const rowMediaRequirement = getMediaRequirement(row);
                    const answeredQuestionsCount = rowAiQuestions.filter((q) => Boolean(rowAiAnswers[q.id])).length;
                    const statusDone = Boolean(String(row.reason ?? "").trim());
                    const mediaDone = rowMediaRequirement.required ? Boolean(row.mediaFileId) : true;
                    const hasSelectedPart = Boolean(String(row.part ?? "").trim());
                    const isRowExpanded = hasSelectedPart ? (expandedLineItemsByRow[rowKey] ?? !row.isSaved) : true;
                    const filteredCatalogParts = vinCatalogParts.filter((part) =>
                      (part.groups ?? []).some((group) => {
                        const groupId = String(group?.id ?? "").trim();
                        const groupName = String(group?.name ?? "").trim();
                        const groupLevel = Number(group?.level ?? 0) || 0;
                        const key = `${groupId || groupName}::${groupLevel}`;
                        return key === selectedGroupKey;
                      })
                    );
                    return (
                      <React.Fragment key={`grouped-row-${rowKey}-${index}`}>
                      {isNewGroup && (
                        <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-cyan-100">{summary.label}</div>
                              <div className="mt-1 text-[11px] text-white/80">
                                Health Indicator:{" "}
                                <span className="font-semibold text-white">{summary.healthPercent}%</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">
                                Safety {summary.severityCounts["Safety Risk"]}
                              </span>
                              <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
                                Mandatory {summary.severityCounts.Mandatory}
                              </span>
                              <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-cyan-200">
                                Recommended {summary.severityCounts.Recommended}
                              </span>
                              <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/80">
                                Optional {summary.severityCounts.Optional}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                            <div
                              className={`h-1.5 rounded ${
                                summary.healthPercent < 50
                                  ? "bg-rose-400"
                                  : summary.healthPercent < 70
                                  ? "bg-amber-400"
                                  : summary.healthPercent < 90
                                  ? "bg-cyan-400"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${Math.max(0, Math.min(100, summary.healthPercent))}%` }}
                            />
                          </div>
                          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-white/60">
                            Selected Parts
                          </div>
                          <div className="mt-1 text-[11px] text-white/80">
                            {summary.parts.length ? summary.parts.join(", ") : "No selected parts"}
                          </div>
                        </div>
                      )}
                      <div
                        key={index}
                        className="rounded-md border border-white/10 bg-black/10 p-2"
                      >
                        {hasSelectedPart && (
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-2 py-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="text-xs font-semibold text-white/90">
                              {row.part || "New line item"} {row.catalogPartCode ? `(${row.catalogPartCode})` : ""}
                            </div>
                            {selectedGroupLabel && (
                              <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-[10px] text-cyan-200">
                                {selectedGroupLabel}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`rounded-full border px-2 py-0.5 ${row.isSaved ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>
                              {row.isSaved ? "Saved" : "Draft"}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 ${statusDone ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>
                              Status {statusDone ? "OK" : "Missing"}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 ${mediaDone ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300"}`}>
                              Media {mediaDone ? "OK" : "Missing"}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 ${answeredQuestionsCount === rowAiQuestions.length && rowAiQuestions.length > 0 ? "border-emerald-500/40 text-emerald-300" : "border-cyan-500/40 text-cyan-200"}`}>
                              Questions {answeredQuestionsCount}/{rowAiQuestions.length}
                            </span>
                            <button
                              type="button"
                              className="rounded-md border border-white/20 px-2 py-0.5 text-white/80"
                              onClick={() =>
                                setExpandedLineItemsByRow((prev) => ({
                                  ...prev,
                                  [rowKey]: !(prev[rowKey] ?? !row.isSaved),
                                }))
                              }
                            >
                              {isRowExpanded ? "Collapse" : "Expand"}
                            </button>
                          </div>
                        </div>
                        )}
                        {isRowExpanded && (
                        <div className={`grid w-full items-start gap-3 ${hasSelectedPart ? "lg:grid-cols-[2fr_1.2fr_2fr_1fr_1.2fr_1fr_1.5fr]" : "lg:grid-cols-[2fr_1.2fr]"}`}>
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Part</div>
                          {vinCatalogGroups.length > 0 ? (
                            <div className="space-y-2">
                              <select
                                className={`${theme.input} h-10 w-full`}
                                value={selectedGroupKey}
                                disabled={isLocked}
                                onChange={(e) => {
                                  const groupKey = e.target.value;
                                  setParts((prev) =>
                                    prev.map((p, i) =>
                                      i === index
                                        ? {
                                            ...p,
                                            catalogGroupKey: groupKey,
                                            catalogPartCode: "",
                                            part: "",
                                            productId: null,
                                            productType: null,
                                            isSaved: false,
                                          }
                                        : p
                                    )
                                  );
                                  setLineItemErrors((prev) => ({
                                    ...prev,
                                    [index]: { ...prev[index], part: undefined },
                                  }));
                                  setLineItemSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                  setLineItemSmartSuggestionsLoadingByRow((prev) => ({ ...prev, [rowKey]: false }));
                                  setLineItemSmartSuggestionsFetchedByRow((prev) => ({ ...prev, [rowKey]: false }));
                                  setDismissedSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                }}
                              >
                                <option value="">Select Car Group</option>
                                {vinCatalogGroups.map((group) => (
                                  <option key={group.key} value={group.key}>
                                    {group.label}
                                  </option>
                                ))}
                              </select>
                              {selectedGroupKey && (
                                <select
                                  className={`${theme.input} h-10 w-full`}
                                  value={selectedPartCode}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    const code = e.target.value;
                                    const selected = filteredCatalogParts.find((part) => part.code === code) ?? null;
                                    const nextPartName = selected?.name || selected?.code || "";
                                    const nextPartCode = selected?.code || code;
                                    setParts((prev) =>
                                      prev.map((p, i) =>
                                        i === index
                                          ? {
                                              ...p,
                                              catalogPartCode: code,
                                              part: nextPartName,
                                              description: p.description || (selected?.code ?? ""),
                                              productId: null,
                                              productType: null,
                                              isSaved: false,
                                            }
                                          : p
                                      )
                                    );
                                    setLineItemErrors((prev) => ({
                                      ...prev,
                                      [index]: { ...prev[index], part: undefined },
                                    }));
                                    setLineItemAiAnswers((prev) => ({ ...prev, [rowKey]: {} }));
                                    setLineItemAiRecommendationByRow((prev) => ({ ...prev, [rowKey]: "" }));
                                    setLineItemSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                    setLineItemSmartSuggestionsLoadingByRow((prev) => ({ ...prev, [rowKey]: false }));
                                    setLineItemSmartSuggestionsFetchedByRow((prev) => ({ ...prev, [rowKey]: false }));
                                    setDismissedSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                    if (nextPartName) {
                                      void requestLineItemAi(
                                        rowKey,
                                        {
                                          partName: nextPartName,
                                          partNumber: nextPartCode,
                                          groupName: selectedGroupLabel,
                                          description: row.description ?? "",
                                          status: row.reason ?? "",
                                        },
                                        undefined,
                                        undefined
                                      );
                                      void requestSmartFaultSuggestions(rowKey, {
                                        partName: nextPartName,
                                        partNumber: nextPartCode,
                                        vin: inspectionVin.trim().toUpperCase(),
                                        category: selectedGroupLabel,
                                        groupName: selectedGroupLabel,
                                        description: row.description ?? "",
                                        status: row.reason ?? "",
                                      });
                                    }
                                  }}
                                >
                                  <option value="">Select Part</option>
                                  {filteredCatalogParts.map((part) => (
                                    <option key={`${part.code}-${part.name}`} value={part.code}>
                                      {part.name || "Unnamed part"}{part.code ? ` (${part.code})` : ""}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                className={`${theme.input} h-10 w-full`}
                                value={row.part}
                                disabled={isLocked}
                                onChange={(e) => updatePart(index, "part", e.target.value)}
                                placeholder="Search products"
                                onFocus={() => setProductOpenIndex(index)}
                                onBlur={() => {
                                  setTimeout(
                                    () => setProductOpenIndex((current) => (current === index ? null : current)),
                                    150
                                  );
                                }}
                              />
                              {productOpenIndex === index && (
                                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-white/10 bg-slate-950 text-xs shadow-lg">
                                  {(productResults.length ? productResults : products).map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        updatePart(index, "part", product.name, {
                                          productId: product.id,
                                          productType: product.type ?? null,
                                        });
                                        setProductOpenIndex(null);
                                        setLineItemAiAnswers((prev) => ({ ...prev, [rowKey]: {} }));
                                        setLineItemAiRecommendationByRow((prev) => ({ ...prev, [rowKey]: "" }));
                                        setLineItemSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                        setLineItemSmartSuggestionsLoadingByRow((prev) => ({ ...prev, [rowKey]: false }));
                                        setLineItemSmartSuggestionsFetchedByRow((prev) => ({ ...prev, [rowKey]: false }));
                                        setDismissedSmartSuggestionsByRow((prev) => ({ ...prev, [rowKey]: [] }));
                                        void requestLineItemAi(
                                          rowKey,
                                          {
                                            partName: product.name,
                                            partNumber: String(row.catalogPartCode ?? ""),
                                            groupName: selectedGroupLabel,
                                            description: row.description ?? "",
                                            status: row.reason ?? "",
                                          },
                                          undefined,
                                          undefined
                                        );
                                        void requestSmartFaultSuggestions(rowKey, {
                                          partName: product.name,
                                          partNumber: String(row.catalogPartCode ?? ""),
                                          vin: inspectionVin.trim().toUpperCase(),
                                          category: selectedGroupLabel,
                                          groupName: selectedGroupLabel,
                                          description: row.description ?? "",
                                          status: row.reason ?? "",
                                        });
                                      }}
                                    >
                                      <span className="font-semibold">{product.name}</span>
                                      <span className="text-[10px] text-white/50">{product.type}</span>
                                    </button>
                                  ))}
                                  {productResults.length === 0 && products.length === 0 && (
                                    <div className="px-3 py-2 text-white/50">No products found.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        {lineItemErrors[index]?.part && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.part}</div>
                        )}
                      </div>
                      {hasSelectedPart && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Part Number</div>
                        <input
                          type="text"
                          className={`${theme.input} h-10 w-full`}
                          value={row.catalogPartCode ?? ""}
                          disabled={isLocked}
                          onChange={(e) =>
                            setParts((prev) =>
                              prev.map((p, i) =>
                                i === index ? { ...p, catalogPartCode: e.target.value, isSaved: false } : p
                              )
                            )
                          }
                          placeholder="Part number"
                        />
                      </div>
                      )}
                      {hasSelectedPart && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Description</div>
                        <input
                          type="text"
                          className={`${theme.input} h-10 w-full`}
                          value={row.description}
                          disabled={isLocked}
                          onChange={(e) => updatePart(index, "description", e.target.value)}
                          placeholder="do it"
                        />
                      </div>
                      )}
                      {hasSelectedPart && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Quantity</div>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className={`${theme.input} h-10 w-full`}
                          value={row.qty}
                          disabled={isLocked}
                          onChange={(e) => updatePart(index, "qty", e.target.value)}
                        />
                        {lineItemErrors[index]?.qty && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.qty}</div>
                        )}
                      </div>
                      )}
                      {hasSelectedPart && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Status</div>
                        <select
                          className={`${theme.input} h-10 w-full`}
                          value={row.reason || "Mandatory"}
                          disabled={isLocked}
                          onChange={(e) => updatePart(index, "reason", e.target.value)}
                        >
                          {lineItemStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                          {row.reason && !lineItemStatusOptions.includes(row.reason as (typeof lineItemStatusOptions)[number]) ? (
                            <option value={row.reason}>{row.reason}</option>
                          ) : null}
                        </select>
                      </div>
                      )}
                      {hasSelectedPart && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Picture / Video</div>
                        {(() => {
                          const mediaRequirement = getMediaRequirement(row);
                          return (
                            <FileUploader
                              label=""
                              kind={mediaRequirement.kind}
                              value={row.mediaFileId ?? ""}
                              onChange={(id) => updatePartMedia(index, id ?? "")}
                              disabled={isLocked}
                              buttonOnly
                              showPreview
                              buttonClassName="h-10 w-full justify-center "
                              containerClassName="w-full"
                            />
                          );
                        })()}
                        {lineItemErrors[index]?.media && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.media}</div>
                        )}
                      </div>
                      )}
                      {hasSelectedPart && (
                      <div className="lg:col-span-7 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
                            AI Part Inspection ({row.part || "Select part first"})
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-cyan-500/40 px-2 py-1 text-[10px] font-semibold text-cyan-100 disabled:opacity-50"
                            disabled={isLocked || (!String(row.catalogPartCode ?? "").trim() && !String(row.part ?? "").trim())}
                            onClick={() => {
                              const searchToken =
                                String(row.catalogPartCode ?? "").trim() || String(row.part ?? "").trim();
                              const query = [
                                searchToken,
                                inspectionMake,
                                inspectionModel,
                                inspectionYear,
                                inspectionVin,
                                "car part",
                                "diagram",
                              ]
                                .map((v) => String(v ?? "").trim())
                                .filter(Boolean)
                                .join(" ");
                              if (!query) return;
                              window.location.assign(
                                `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
                              );
                            }}
                          >
                            View Diagram
                          </button>
                        </div>
                        {hasSelectedPart && (
                          <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                              Smart Fault Suggestions
                            </div>
                            {smartSuggestionsLoading ? (
                              <div className="mt-1 text-[11px] text-amber-100/80">
                                Loading AI related suggestions...
                              </div>
                            ) : smartSuggestions.length === 0 ? (
                              <div className="mt-1 text-[11px] text-amber-100/80">
                                No related suggestions for this issue.
                              </div>
                            ) : (
                              <div className="mt-1 space-y-1">
                                {smartSuggestions.map((suggestion) => (
                                  (() => {
                                    const suggestionPartNumber =
                                      String(suggestion.label.match(/\(([^)]+)\)/)?.[1] ?? "").trim() ||
                                      String(row.catalogPartCode ?? "").trim();
                                    const suggestionSearchQuery = [
                                      suggestionPartNumber,
                                      inspectionMake,
                                      inspectionModel,
                                      inspectionYear,
                                      inspectionVin,
                                      "car part",
                                      "diagram",
                                    ]
                                      .map((v) => String(v ?? "").trim())
                                      .filter(Boolean)
                                      .join(" ");
                                    const suggestionSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
                                      suggestionSearchQuery
                                    )}`;
                                    return (
                                  <div
                                    key={`${rowKey}-smart-${suggestion.id}`}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[11px]"
                                  >
                                    <div className="text-amber-100">
                                      ⚠ {suggestion.label}
                                      <div className="text-[10px] text-amber-100/70">{suggestion.reason}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        className="rounded-md border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200"
                                        onClick={() =>
                                          void addSmartSuggestionAsLineItem(
                                            index,
                                            rowKey,
                                            {
                                              catalogGroupKey: row.catalogGroupKey,
                                              reason: row.reason,
                                              description: suggestion.reason,
                                            },
                                            suggestion
                                          )
                                        }
                                      >
                                        Add
                                      </button>
                                      <a
                                        href={suggestionSearchUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-md border border-cyan-500/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-200"
                                      >
                                        Open AI Search Result
                                      </a>
                                      <button
                                        type="button"
                                        className="rounded-md border border-white/20 px-2 py-0.5 text-[10px] font-semibold text-white/80"
                                        onClick={() =>
                                          setDismissedSmartSuggestionsByRow((prev) => ({
                                            ...prev,
                                            [rowKey]: Array.from(new Set([...(prev[rowKey] ?? []), suggestion.id])),
                                          }))
                                        }
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                    );
                                  })()
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-[11px] text-cyan-100/70">
                          AI Questions are hidden for now. Smart Fault Suggestions remain active.
                        </div>
                      </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <div className="w-full text-[10px] uppercase tracking-wide text-white/60 lg:hidden">Actions</div>
                        {row.isSaved ? (
                          <button
                            type="button"
                            className="rounded-md bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white"
                            disabled={isLocked}
                            onClick={() => {
                              setParts((prev) =>
                                prev.map((p, i) => (i === index ? { ...p, isSaved: false } : p))
                              );
                              toast.success("Line item is now in edit mode.");
                            }}
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-semibold text-white"
                            onClick={() => saveLineItem(index)}
                            disabled={row.isSaving || isLocked}
                          >
                            {row.isSaving ? "Saving..." : "Save"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-md bg-rose-600 px-3 py-2 text-[11px] font-semibold text-white"
                          onClick={() => deleteLineItem(index)}
                          disabled={isLocked}
                        >
                          Delete
                        </button>
                        {!isReadOnly && !isCollectCarPending && !row.isSaved && (
                          <span className="text-[11px] text-amber-400">Please save this item</span>
                        )}
                        {!hasSelectedPart && (
                          <span className="text-[11px] text-cyan-200">Select group and part first.</span>
                        )}
                        {isLocked && (
                          <span className="text-[11px] text-amber-400">Ordered/received item</span>
                        )}
                      </div>
                    </div>
                    )}
                    </div>
                    </React.Fragment>
                  );
                  })}
                    </div>
                    {!isReadOnly && !isCollectCarPending && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
                          onClick={addLineItemRow}
                          disabled={vinCatalogLoading || parts.some((p) => !p.isSaved)}
                        >
                          {vinCatalogLoading ? "Loading..." : "+ Add Another Line Item"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 6 ? "" : "hidden"}`}>
              <label className="text-xs font-semibold text-white/70">Inspector Remarks</label>
              <textarea
                className={theme.input}
                rows={4}
                value={form.inspectorRemarks}
                readOnly={isReadOnly || isCollectCarPending}
                onChange={(e) => setForm((prev) => ({ ...prev, inspectorRemarks: e.target.value }))}
                placeholder="Final inspection remarks before completion."
              />
            </div>
            <div className={`mt-4 ${inspectionStep === 6 ? "" : "hidden"}`}>
              <div className="report-print-hide mb-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 hover:bg-white/10"
                  onClick={printInspectionReport}
                >
                  Print Report
                </button>
                <button
                  type="button"
                  className="rounded-md bg-cyan-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                  onClick={() => void downloadInspectionReportPdf()}
                >
                  Download Inspection Report (PDF)
                </button>
              </div>
              <div id="inspection-report-print" className="report-print-root rounded-md border border-cyan-500/25 bg-cyan-500/5 p-4">
                <div className="report-section rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {reportWorkshopBranding.logoUrl ? (
                        <img
                          src={reportWorkshopBranding.logoUrl}
                          alt="Workshop logo"
                          className="h-12 w-12 rounded border border-white/20 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded border border-white/20 text-[10px] text-white/70">
                          LOGO
                        </div>
                      )}
                      <div>
                        <div className="text-base font-semibold text-white">{reportWorkshopBranding.workshopName}</div>
                        <div className="text-xs text-white/70">{reportWorkshopBranding.contact}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-cyan-100">Vehicle Inspection Report</div>
                      <div className="text-xs text-white/70">
                        Inspection Date: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs lg:grid-cols-2">
                    <div className="space-y-1 text-white/85">
                      <div>Customer Name: {customer?.name ?? customer?.fullName ?? "N/A"}</div>
                      <div>
                        Vehicle: {[inspectionMake, inspectionModel, inspectionYear].filter(Boolean).join(" ") || "N/A"}
                      </div>
                      <div>VIN: {inspectionVin || "N/A"}</div>
                      <div>License Plate: {plateLabel || "N/A"}</div>
                    </div>
                    <div className="space-y-1 text-white/85">
                      <div>Mileage: {form.carInMileage || "N/A"}</div>
                      <div>Inspector / Technician: {form.inspectorName || "N/A"}</div>
                      <div>Workshop Branch: {form.advisorName || "N/A"}</div>
                      <div>Inspection ID: {inspectionId || "N/A"}</div>
                    </div>
                  </div>
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Vehicle Overview Photos</div>
                  {reportMediaGallery.length === 0 ? (
                    <div className="mt-2 text-xs text-white/60">No check-in photos available.</div>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {reportMediaGallery.map((media) => (
                        <div key={`gallery-${media.key}`} className="rounded border border-white/10 bg-white/[0.02] p-2">
                          <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">{media.label}</div>
                          <img
                            src={`/api/files/${media.fileId}`}
                            alt={media.label}
                            className="h-32 w-full rounded border border-white/10 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
                    <div className="rounded border border-cyan-500/25 bg-cyan-500/5 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Overall Vehicle Condition</div>
                      <div className="mt-1 text-3xl font-bold text-cyan-100">{overallHealthPercent}%</div>
                      <div className="text-xs text-white/80">
                        {overallHealthPercent >= 85
                          ? "Excellent"
                          : overallHealthPercent >= 70
                          ? "Good"
                          : overallHealthPercent >= 50
                          ? "Needs Attention"
                          : "Critical"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-white/60">Category Health Scores</div>
                      <div className="mt-2 space-y-2">
                        {reportCategoryHealth.map((entry) => (
                          <div key={`cat-health-${entry.category}`}>
                            <div className="flex items-center justify-between text-xs text-white/85">
                              <span>{entry.category}</span>
                              <span>{entry.healthPercent}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded bg-white/10">
                              <div
                                className={`h-1.5 rounded ${
                                  entry.healthPercent < 50
                                    ? "bg-rose-400"
                                    : entry.healthPercent < 70
                                    ? "bg-amber-400"
                                    : entry.healthPercent < 90
                                    ? "bg-cyan-400"
                                    : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.max(0, Math.min(100, entry.healthPercent))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Priority Issues Summary</div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    {(["Safety Risk", "Mandatory", "Recommended", "Optional"] as const).map((severity) => (
                      <div key={`priority-${severity}`} className="rounded border border-white/10 bg-white/[0.02] p-2">
                        <div className="text-xs font-semibold text-white">{severity}</div>
                        <div className="mt-1 space-y-1 text-xs text-white/85">
                          {reportPriorityFindings[severity].length === 0 ? (
                            <div className="text-white/50">No items.</div>
                          ) : (
                            reportPriorityFindings[severity].map((item, idx) => (
                              <div key={`priority-item-${severity}-${idx}`} className="rounded border border-white/10 px-2 py-1">
                                <div className="font-semibold">
                                  {item.partName}
                                  {item.partNumber ? ` (${item.partNumber})` : ""}
                                </div>
                                <div className="text-white/70">{item.observedCondition}</div>
                                <div className="text-white/60">Part Group: {item.partGroup}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Group Summary</div>
                  {selectedPartsByGroup.length === 0 ? (
                    <div className="mt-2 text-xs text-white/60">No grouped inspection findings yet.</div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedPartsByGroup.map((group) => (
                        <div key={`group-summary-${group.key}`} className="rounded border border-white/10 bg-white/[0.02] p-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-white">{group.label}</div>
                            <div className="text-cyan-100">Health: {group.healthPercent}%</div>
                          </div>
                          <div className="mt-1 text-white/75">{group.parts.length} selected part(s): {group.parts.join(", ")}</div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            <span className="rounded-full border border-rose-500/40 px-2 py-0.5 text-rose-300">Safety {group.severityCounts["Safety Risk"]}</span>
                            <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">Mandatory {group.severityCounts.Mandatory}</span>
                            <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-cyan-200">Recommended {group.severityCounts.Recommended}</span>
                            <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/80">Optional {group.severityCounts.Optional}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Detailed Inspection Findings</div>
                  <div className="mt-2 space-y-2">
                    {reportFindings.length === 0 ? (
                      <div className="text-xs text-white/60">No findings selected yet.</div>
                    ) : (
                      reportFindings.map((finding, idx) => (
                        <div key={`finding-${idx}`} className="rounded border border-white/10 bg-white/[0.02] p-2 text-xs text-white/85">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold">
                              {finding.partName}
                              {finding.partNumber ? ` (${finding.partNumber})` : ""}
                            </div>
                            <span className="rounded-full border border-cyan-500/40 px-2 py-0.5 text-[10px] text-cyan-100">{finding.severity}</span>
                          </div>
                          <div className="mt-1 text-white/70">Part Group: {finding.partGroup}</div>
                          <div className="mt-1"><span className="font-semibold">Observed Condition:</span> {finding.observedCondition}</div>
                          <div className="mt-1"><span className="font-semibold">Why This Matters:</span> {finding.whyItMatters}</div>
                          <div className="mt-1"><span className="font-semibold">Recommended Action:</span> {finding.recommendedAction}</div>
                          <div className="mt-2">
                            <div className="text-[10px] uppercase tracking-wide text-white/60">Evidence Photos</div>
                            {finding.mediaFileId ? (
                              <img
                                src={`/api/files/${finding.mediaFileId}`}
                                alt={`${finding.partName} evidence`}
                                className="mt-1 h-32 w-full max-w-sm rounded border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="mt-1 text-white/50">No evidence attached.</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Inspection Summary</div>
                  <div className="mt-2 text-xs leading-relaxed text-white/85">{reportFinalSummaryText}</div>
                </div>

                <div className="report-section mt-3 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-sm font-semibold text-cyan-100">Repair Approval Summary</div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-2">
                    {(["Safety Risk", "Mandatory", "Recommended", "Optional"] as const).map((severity) => (
                      <div key={`approval-${severity}`} className="rounded border border-white/10 bg-white/[0.02] p-2 text-xs">
                        <div className="font-semibold text-white">{severity}</div>
                        {reportPriorityFindings[severity].length === 0 ? (
                          <div className="mt-1 text-white/50">No items.</div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {reportPriorityFindings[severity].map((item, idx) => (
                              <div key={`approval-item-${severity}-${idx}`} className="rounded border border-white/10 px-2 py-1">
                                <div className="font-semibold">{item.partName}</div>
                                <div className="text-white/70">{item.recommendedAction}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="report-page-footer">Vehicle Inspection Report</div>
              </div>
            </div>

            <div className="report-print-hide mt-6 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 hover:bg-white/10"
                  onClick={goPrevStep}
                  disabled={inspectionStep <= 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded-md bg-cyan-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
                  onClick={goNextStep}
                  disabled={inspectionStep >= 6 || nextStepSaving}
                >
                  {nextStepSaving ? "Saving..." : "Next Step"}
                </button>
              </div>
            </div>

            <div
              className={`report-print-hide mt-6 flex items-center justify-end gap-2 ${
                inspectionStep === 6 || (inspectionStep === 2 && !startedAt) || isReadOnly ? "" : "hidden"
              }`}
            >
              {isReadOnly ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText}`}
                  disabled
                >
                  {isCancelled ? "Inspection Cancelled" : isVerified ? "Inspection Verified" : "Inspection Completed"}
                </button>
              ) : !startedAt ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  disabled={saving || isCollectCarPending || !companyId || !inspectionId}
                  onClick={async () => {
                    if (!companyId || !inspectionId) return;
                    setSaving(true);
                    const actionAt = new Date().toISOString();
                    const nextLogs = appendInspectionLog("started", actionAt, "Status changed to pending (inspection started)");
                    try {
                      const res = await fetch(
                        `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "pending",
                            startAt: actionAt,
                            draftPayload: buildDraftPayload(nextLogs),
                          }),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to start inspection");
                      if (leadId) {
                        const leadRes = await fetch(
                          `/api/company/${companyId}/crm/leads/${leadId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              carInVideo: carInVideoId || null,
                              carOutVideo: carOutVideoId || null,
                            }),
                          }
                        );
                        if (!leadRes.ok) throw new Error("Failed to save lead videos");
                      }
                      setInspection((prev: any) => ({
                        ...prev,
                        startAt: actionAt,
                      }));
                      initialStatusRef.current = "pending";
                      initialRemarksRef.current = form.inspectorRemarks ?? "";
                      initialPartsSignatureRef.current = serializePartsForCompare(parts);
                      initialChecksSignatureRef.current = serializeChecksForCompare(checks);
                    } catch (err) {
                      setInspectionLogs((prev) => prev.filter((log) => log.at !== actionAt || log.action !== "started"));
                      setError("Failed to start inspection");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Start Inspection"}
                </button>
              ) : completedAt ? (
                <>
                  <button
                    type="button"
                    className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                    disabled={saving || isCollectCarPending || !companyId || !inspectionId}
                    onClick={async () => {
                      if (!companyId || !inspectionId) return;
                      setSaving(true);
                      const actionAt = new Date().toISOString();
                      let nextLogs = inspectionLogs;
                      const previousRemarks = (initialRemarksRef.current ?? "").trim();
                      const currentRemarks = (form.inspectorRemarks ?? "").trim();
                      if (previousRemarks !== currentRemarks) {
                        nextLogs = appendInspectionLog("updated", actionAt, "Inspector remarks updated", nextLogs);
                      }
                      const partsChanged = initialPartsSignatureRef.current !== serializePartsForCompare(parts);
                      if (partsChanged) {
                        nextLogs = appendInspectionLog("updated", actionAt, "Line items updated", nextLogs);
                      }
                      if (nextLogs === inspectionLogs) {
                        nextLogs = appendInspectionLog("updated", actionAt, "Inspection data updated", nextLogs);
                      }
                      try {
                        const res = await fetch(
                          `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              draftPayload: buildDraftPayload(nextLogs),
                            }),
                          }
                        );
                        if (!res.ok) throw new Error("Failed to update inspection");
                        if (leadId) {
                          const leadRes = await fetch(
                            `/api/company/${companyId}/crm/leads/${leadId}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                carInVideo: carInVideoId || null,
                                carOutVideo: carOutVideoId || null,
                              }),
                            }
                          );
                          if (!leadRes.ok) throw new Error("Failed to save lead videos");
                        }
                        initialRemarksRef.current = form.inspectorRemarks ?? "";
                        initialPartsSignatureRef.current = serializePartsForCompare(parts);
                        initialChecksSignatureRef.current = serializeChecksForCompare(checks);
                      } catch (err) {
                        setInspectionLogs((prev) => prev.filter((log) => log.at !== actionAt || log.action !== "updated"));
                        setError("Failed to update inspection");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Saving..." : "Update Inspection"}
                  </button>
                  {!isWorkshopView && (
                    <>
                      <button
                        type="button"
                        className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                          advisorApproved ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                        }`}
                        disabled={saving || isCollectCarPending || advisorApproved || !companyId || !inspectionId}
                        onClick={async () => {
                          if (!companyId || !inspectionId || advisorApproved) return;
                          setSaving(true);
                          const actionAt = new Date().toISOString();
                          const nextLogs = appendInspectionLog("updated", actionAt, "Advisor approved inspection");
                          try {
                            const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                draftPayload: buildDraftPayload(nextLogs, parts, {
                                  advisorApproved: true,
                                  advisorApprovedAt: actionAt,
                                  advisorApprovedBy: actorName || "System",
                                }),
                              }),
                            });
                            if (!res.ok) throw new Error("Failed to approve as advisor");
                            setAdvisorApproved(true);
                            setAdvisorApprovedAt(actionAt);
                            setAdvisorApprovedBy(actorName || "System");
                          } catch (err) {
                            setInspectionLogs((prev) =>
                              prev.filter((log) => !(log.at === actionAt && log.message === "Advisor approved inspection"))
                            );
                            setError("Failed to approve as advisor");
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        {advisorApproved ? "Advisor Approved" : "Advisor Approve"}
                      </button>
                      <button
                        type="button"
                        className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
                          customerApproved ? "bg-emerald-600 text-white" : "bg-cyan-600 text-white"
                        }`}
                        disabled={saving || isCollectCarPending || customerApproved || !companyId || !inspectionId}
                        onClick={async () => {
                          if (!companyId || !inspectionId || customerApproved) return;
                          setSaving(true);
                          const actionAt = new Date().toISOString();
                          const nextLogs = appendInspectionLog("updated", actionAt, "Customer approved inspection");
                          try {
                            const res = await fetch(`/api/company/${companyId}/workshop/inspections/${inspectionId}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                draftPayload: buildDraftPayload(nextLogs, parts, {
                                  customerApproved: true,
                                  customerApprovedAt: actionAt,
                                  customerApprovedBy: actorName || "System",
                                }),
                              }),
                            });
                            if (!res.ok) throw new Error("Failed to approve as customer");
                            setCustomerApproved(true);
                            setCustomerApprovedAt(actionAt);
                            setCustomerApprovedBy(actorName || "System");
                          } catch (err) {
                            setInspectionLogs((prev) =>
                              prev.filter((log) => !(log.at === actionAt && log.message === "Customer approved inspection"))
                            );
                            setError("Failed to approve as customer");
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        {customerApproved ? "Customer Approved" : "Customer Approve"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-md bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                  disabled={!canCompleteInspection}
                  onClick={async () => {
                    if (!companyId || !inspectionId) return;
                    if (!canCompleteInspection) {
                      toast.error("Complete required fields and save all line items before completion.");
                      return;
                    }
                    setSaving(true);
                    const actionAt = new Date().toISOString();
                    let nextLogs = appendInspectionLog("completed", actionAt, "Status changed to completed");
                    const previousRemarks = (initialRemarksRef.current ?? "").trim();
                    const currentRemarks = (form.inspectorRemarks ?? "").trim();
                    if (previousRemarks !== currentRemarks) {
                      nextLogs = appendInspectionLog("updated", actionAt, "Inspector remarks updated", nextLogs);
                    }
                    const partsChanged = initialPartsSignatureRef.current !== serializePartsForCompare(parts);
                    if (partsChanged) {
                      nextLogs = appendInspectionLog("updated", actionAt, "Line items updated", nextLogs);
                    }
                    try {
                      const res = await fetch(
                        `/api/company/${companyId}/workshop/inspections/${inspectionId}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            status: "completed",
                            completeAt: actionAt,
                            draftPayload: buildDraftPayload(nextLogs),
                          }),
                        }
                      );
                      if (!res.ok) throw new Error("Failed to complete inspection");
                      if (leadId) {
                        const leadRes = await fetch(
                          `/api/company/${companyId}/crm/leads/${leadId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              carInVideo: carInVideoId || null,
                              carOutVideo: carOutVideoId || null,
                            }),
                          }
                        );
                        if (!leadRes.ok) throw new Error("Failed to save lead videos");
                      }
                      setInspection((prev: any) => ({
                        ...prev,
                        completeAt: actionAt,
                      }));
                      initialStatusRef.current = "completed";
                      initialRemarksRef.current = form.inspectorRemarks ?? "";
                      initialPartsSignatureRef.current = serializePartsForCompare(parts);
                      initialChecksSignatureRef.current = serializeChecksForCompare(checks);
                    } catch (err) {
                      setInspectionLogs((prev) => prev.filter((log) => log.at !== actionAt));
                      setError("Failed to complete inspection");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Saving..." : "Complete Inspection"}
                </button>
              )}
            </div>

            <div className={`mt-6 rounded-md bg-white/5 p-3 ${inspectionStep === 6 || isReadOnly ? "" : "hidden"}`}>
              <div className="text-sm font-semibold">Inspection Log</div>
              <div className="mt-2 space-y-1 text-xs text-white/80">
                {startedAt && (
                  <div>
                    Start Time: <span className="font-semibold">{new Date(startedAt).toLocaleString()}</span>
                  </div>
                )}
                {completedAt && (
                  <div>
                    End Time: <span className="font-semibold">{new Date(completedAt).toLocaleString()}</span>
                  </div>
                )}
                {advisorApprovedAt && (
                  <div>
                    Advisor Approved: <span className="font-semibold">{new Date(advisorApprovedAt).toLocaleString()}</span>
                    {advisorApprovedBy ? ` by ${advisorApprovedBy}` : ""}
                  </div>
                )}
                {customerApprovedAt && (
                  <div>
                    Customer Approved:{" "}
                    <span className="font-semibold">{new Date(customerApprovedAt).toLocaleString()}</span>
                    {customerApprovedBy ? ` by ${customerApprovedBy}` : ""}
                  </div>
                )}
                {verifiedAt && (
                  <div>
                    Verified At: <span className="font-semibold">{new Date(verifiedAt).toLocaleString()}</span>
                  </div>
                )}
                {cancelledAt && (
                  <div>
                    Cancelled At: <span className="font-semibold">{new Date(cancelledAt).toLocaleString()}</span>
                    {cancelledBy ? ` by ${cancelledBy}` : ""}
                  </div>
                )}
                {!startedAt && !completedAt && <div className="text-white/60">No start/end time recorded.</div>}
              </div>
              <div className="mt-4">
                {inspectionLogs.length === 0 ? (
                  <div className="text-xs text-white/60">No activity yet.</div>
                ) : (
                  <div className="space-y-1.5">
                    {inspectionLogs.map((log) => (
                      <div key={log.id} className="rounded-md bg-white/5 px-2 py-1.5 text-[10px] text-white/85">
                        <div>
                          <span className="font-semibold capitalize">{log.action}</span>
                          {log.message ? ` - ${log.message}` : ""}
                        </div>
                        <div className="mt-0.5 text-[9px] text-white/70">
                          by <span className="font-semibold text-white">{log.by || "System"}</span> at{" "}
                          {new Date(log.at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </Card>

          <div className="space-y-4">
            {!isWorkshopView && <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Customer Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Customer ID</div>
                  <div className="font-semibold">{customer?.code ?? customer?.id ?? "N/A"}</div>
                  <div className="text-white/70">Customer Name</div>
                  <div className="font-semibold">{customer?.name ?? "N/A"}</div>
                  <div className="text-white/70">Customer Phone</div>
                  <div className="font-semibold">{customer?.phone ?? "N/A"}</div>
                  <div className="text-white/70">Customer Type</div>
                  <div className="font-semibold">{customer?.customer_type ?? "Regular"}</div>
                </div>
              </div>
            </Card>}

            {!isWorkshopView && <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Car Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Plate #</div>
                  <div className="font-semibold">{plateLabel}</div>
                  <div className="text-white/70">Car</div>
                  <div className="font-semibold">
                    {[car?.make, car?.model].filter(Boolean).join(" ") || "N/A"}
                  </div>
                  <div className="text-white/70">Type</div>
                  <div className="font-semibold">{car?.body_type ?? car?.bodyType ?? "Regular"}</div>
                  <div className="text-white/70">Free Battery</div>
                  <div className="font-semibold">Not Eligible</div>
                </div>
              </div>
            </Card>}

            {!isWorkshopView && <Card className={`overflow-hidden ${theme.cardBg} ${theme.cardBorder}`}>
              <div className={`px-4 py-2 text-sm font-semibold ${theme.surfaceSubtle} ${theme.cardBorder}`}>
                Service History
              </div>
              <div className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="text-white/70">Show entries</div>
                  <input type="text" className={theme.input} placeholder="Search" />
                </div>
              </div>
            </Card>}

          </div>
        </div>
      </div>
      <style>{`
        .report-page-footer {
          display: none;
        }
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          .report-print-hide {
            display: none !important;
          }
          .report-print-root {
            background: #ffffff !important;
            border: 0 !important;
            color: #0f172a !important;
            box-shadow: none !important;
          }
          .report-print-root .report-section {
            background: #ffffff !important;
            border: 1px solid #dbe2ea !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .report-print-root * {
            color: #0f172a !important;
          }
          .report-print-root img {
            max-width: 100% !important;
            object-fit: cover !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .report-page-footer {
            display: block;
            position: fixed;
            bottom: 4mm;
            right: 0;
            font-size: 10px;
            color: #475569 !important;
          }
          .report-page-footer::after {
            content: " - Page " counter(page) " of " counter(pages);
          }
        }
      `}</style>
    </AppLayout>
  );
}

export default function InspectionDetailPage({ params }: Params) {
  return <InspectionDetailPageClient params={params} />;
}
