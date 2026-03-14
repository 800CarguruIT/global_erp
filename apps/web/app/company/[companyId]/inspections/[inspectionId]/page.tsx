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

type CheckValue = "good" | "avg" | "bad" | "";
type ProcessCheckValue = "ok" | "issue" | "na" | "";
type ProcessCheckKey = "oil" | "battery" | "tyre" | "obd";

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
  const [inspectionIssueNotes, setInspectionIssueNotes] = useState("");
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
      partOrdered?: number | null;
      orderStatus?: string | null;

      mediaFileId?: string | null;
      isSaving?: boolean;
      isSaved?: boolean;
    }>
  >([{ part: "", description: "", qty: "1", reason: "Mandatory" }]);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      setCompanyId(p?.companyId ?? null);
      setInspectionId(p?.inspectionId ?? null);
    });
  }, [params]);

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
        setForm((prev) => ({
          advisorName: draft.advisorName ?? prev.advisorName,
          inspectorName: draft.inspectorName ?? prev.inspectorName,
          carInMileage: draft.carInMileage ?? prev.carInMileage,
          customerComplain: draft.customerComplain ?? prev.customerComplain,
          inspectorRemarks: draft.inspectorRemarks ?? prev.inspectorRemarks,
        }));
        setInspectionIssueNotes(String(draft.inspectionIssueNotes ?? ""));
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
            const mappedParts = items.map((item: any) => ({
              id: item.id,
              productId: item.productId ?? item.product_id ?? null,
              productType: item.productType ?? item.product_type ?? item.type ?? null,
              part: item.productName ?? item.product_name ?? "",
              description: item.description ?? "",
              qty: String(item.quantity ?? 1),
              reason: item.reason ?? "Mandatory",
              mediaFileId: item.mediaFileId ?? item.media_file_id ?? null,
              partOrdered: item.partOrdered ?? item.part_ordered ?? 0,
              orderStatus: item.orderStatus ?? item.order_status ?? null,
              isSaved: true,
            }));
            setParts(mappedParts);
            initialPartsSignatureRef.current = JSON.stringify(
              mappedParts.map((p) => ({
                id: p.id ?? null,
                part: p.part?.trim?.() ?? "",
                description: p.description?.trim?.() ?? "",
                qty: String(p.qty ?? ""),
                reason: p.reason ?? "",
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
  const collectCarSourceMedia = (collectCar?.sourceMedia ?? {}) as Record<string, string | null>;
  const collectCarLogs = Array.isArray(collectCar?.logs) ? collectCar.logs : [];
  const collectCarNeedsReupload = collectCarDifference === "yes";
  const collectCarMissingReupload = Object.entries(collectCarSourceMedia)
    .filter(([, fileId]) => Boolean(fileId))
    .some(([key]) => !collectCarReuploadMedia[key]);
  const isCollectCarPending = !isReadOnly && !collectCarCompleted;
  useEffect(() => {
    if (isCollectCarPending) setInspectionStep(1);
  }, [isCollectCarPending]);
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

  const buildDraftPayload = (
    activityLogs: InspectionLogEntry[],
    rows: typeof parts = parts,
    approvals?: {
      advisorApproved?: boolean;
      advisorApprovedAt?: string | null;
      advisorApprovedBy?: string | null;
      customerApproved?: boolean;
      customerApprovedAt?: string | null;
      customerApprovedBy?: string | null;
    }
  ) => ({
    advisorName: form.advisorName,
    inspectorName: form.inspectorName,
    carInMileage: form.carInMileage,
    customerComplain: form.customerComplain,
    inspectorRemarks: form.inspectorRemarks,
    inspectionIssueNotes,
    checks,
    processChecks,
    processCheckMedia,
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
      mediaFileId: p.mediaFileId ?? null,
    })),
    advisorApproved: approvals?.advisorApproved ?? advisorApproved,
    advisorApprovedAt: approvals?.advisorApprovedAt ?? advisorApprovedAt,
    advisorApprovedBy: approvals?.advisorApprovedBy ?? advisorApprovedBy,
    customerApproved: approvals?.customerApproved ?? customerApproved,
    customerApprovedAt: approvals?.customerApprovedAt ?? customerApprovedAt,
    customerApprovedBy: approvals?.customerApprovedBy ?? customerApprovedBy,
    activityLogs,
  });

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
    (item) => Boolean(processChecks[item.key]) && Boolean(processCheckMedia[item.key])
  );
  const hasAnyProcessIssue = processCheckItems.some((item) => processChecks[item.key] === "issue");
  const step1Complete = isReadOnly || collectCarCompleted;
  const step2Complete = isReadOnly || Boolean(startedAt);
  const step3Complete =
    isReadOnly || (processChecksCompleted && (!hasAnyProcessIssue || Boolean((inspectionIssueNotes ?? "").trim())));
  const step4Complete =
    isReadOnly ||
    (Boolean((tyreSizeFront ?? "").trim()) &&
      Boolean((tyreSizeRear ?? "").trim()) &&
      Boolean((form.carInMileage ?? "").trim()) &&
      Boolean(clusterImageId) &&
      Boolean((inspectionVin ?? "").trim()));
  const hasUnsavedLineItems = parts.some((p) => !p.isSaved);
  const hasUnsavedChanges =
    !isReadOnly &&
    ((form.inspectorRemarks ?? "").trim() !== (initialRemarksRef.current ?? "").trim() ||
      serializePartsForCompare(parts) !== initialPartsSignatureRef.current ||
      serializeChecksForCompare(checks) !== initialChecksSignatureRef.current);
  const requiredMediaMissing = parts.some((row) => getMediaRequirement(row).required && !row.mediaFileId);
  const step5Complete = isReadOnly || (!hasUnsavedLineItems && !requiredMediaMissing && parts.length > 0);
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
    { id: 5, label: "Line Items", done: step5Complete },
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
        "Did you record issues/damages in notes?",
        "Are Oil, Battery, Tyre and OBD checks completed with images?",
      ];
    }
    if (inspectionStep === 4) {
      return [
        "Did you enter tyre size front/rear and mileage with cluster image?",
        "Did VIN lookup return make/model/year or an existing car match?",
      ];
    }
    if (inspectionStep === 5) {
      return [
        "Did you add all required parts/line items?",
        "Are all line items saved with mandatory media attached?",
      ];
    }
    return [
      "Before completion: are all mandatory steps done and inspector remarks added?",
      "Do you want to update draft one last time before completing inspection?",
    ];
  }, [inspectionStep]);
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
    const row = parts[index];
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
        description: row.description,
        quantity: qtyNumber,
        reason: row.reason,

        mediaFileId: row.mediaFileId ?? null,
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
      const nextParts = parts.map((p, i) =>
        i === index
          ? {
              ...p,
              id: saved.id ?? p.id,
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
    setParts((prev) => prev.filter((_, i) => i !== index));
    toast.success("Line item deleted successfully.");
  };

  const nextStepValidationMessage = () => {
    if (inspectionStep === 1 && !step1Complete) return "Complete Collect Car stage first.";
    if (inspectionStep === 2 && !step2Complete) return "Start inspection before moving to next step.";
    if (inspectionStep === 3 && !step3Complete) return "Complete notes and Oil/Battery/Tyre/OBD checks with images.";
    if (inspectionStep === 4 && !step4Complete) return "Complete tyre sizes, mileage, cluster image and VIN.";
    if (inspectionStep === 5 && !step5Complete) return "Save all line items and required media before review.";
    return "Please complete the current step.";
  };

  const goNextStep = () => {
    const next = Math.min(6, inspectionStep + 1);
    if (next === inspectionStep) return;
    if (!canOpenStep(next)) {
      toast.error(nextStepValidationMessage());
      return;
    }
    setInspectionStep(next);
  };

  const goPrevStep = () => setInspectionStep((prev) => Math.max(1, prev - 1));

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
            <div className={`grid gap-4 pt-4 lg:grid-cols-2 ${inspectionStep === 3 ? "" : "hidden"}`}>
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

            <div className={`mt-6 grid gap-3 lg:grid-cols-3 ${inspectionStep === 3 ? "" : "hidden"}`}>
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

            <div className={`mt-4 grid gap-3 lg:grid-cols-2 ${inspectionStep === 3 ? "" : "hidden"}`}>
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

            <div className={`mt-6 ${inspectionStep === 3 ? "" : "hidden"}`}>
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
                <div className="mt-3">
                  <label className="text-xs font-semibold text-white/70">Issues / Damages Notes</label>
                  <textarea
                    className={theme.input}
                    rows={3}
                    value={inspectionIssueNotes}
                    readOnly={isReadOnly || isCollectCarPending}
                    onChange={(e) => setInspectionIssueNotes(e.target.value)}
                    placeholder="Add notes for any issue/damage found during inspection."
                  />
                </div>
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
                        <FileUploader
                          label={`${item.label} image`}
                          kind="image"
                          value={processCheckMedia[item.key] ?? ""}
                          onChange={(id) => setProcessCheckMedia((prev) => ({ ...prev, [item.key]: String(id ?? "") }))}
                          disabled={isReadOnly || isCollectCarPending}
                          buttonOnly
                          showPreview
                          buttonClassName="h-9"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 4 ? "" : "hidden"}`}>
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-semibold">Vehicle Data and VIN</div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-white/70">Tyre Size (Front)</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={tyreSizeFront}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setTyreSizeFront(e.target.value)}
                      placeholder="e.g. 235/55R18"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-white/70">Tyre Size (Rear)</label>
                    <input
                      type="text"
                      className={theme.input}
                      value={tyreSizeRear}
                      readOnly={isReadOnly || isCollectCarPending}
                      onChange={(e) => setTyreSizeRear(e.target.value)}
                      placeholder="e.g. 255/50R18"
                    />
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
                  <div>
                    <FileUploader
                      label="Cluster Image"
                      kind="image"
                      value={clusterImageId}
                      onChange={(id) => setClusterImageId(String(id ?? ""))}
                      disabled={isReadOnly || isCollectCarPending}
                      buttonOnly
                      showPreview
                      buttonClassName="h-10"
                    />
                  </div>
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
                </div>
                {vinLookupNote && <div className="mt-2 text-xs text-cyan-200">{vinLookupNote}</div>}
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
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
                </div>
              </div>
            </div>

            <div className={`mt-6 ${inspectionStep === 5 ? "" : "hidden"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Findings / Parts Needed</div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
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
              </div>
              <div className={`mt-2 rounded-md ${theme.cardBorder} ${theme.surfaceSubtle} p-3`}>
                <div className="hidden w-full gap-3 text-xs font-semibold text-white/70 lg:grid lg:grid-cols-[2fr_2fr_1fr_1fr_1.5fr]">
                  <div>Parts Needed</div>
                  <div>Description</div>
                  <div>Quantity</div>
                  <div>Picture / Video</div>
                  <div>Actions</div>
                </div>
                <div className="mt-2 space-y-2">
                  {parts.map((row, index) => {
                    const isLocked =
                      isReadOnly || isCollectCarPending || row.partOrdered === 1 || row.orderStatus === "Ordered" || row.orderStatus === "Received";
                    return (
                      <div
                        key={index}
                        className="grid w-full items-start gap-3 rounded-md border border-white/10 p-2 lg:rounded-none lg:border-0 lg:p-0 lg:grid-cols-[2fr_2fr_1fr_1fr_1.5fr]"
                      >
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60 lg:hidden">Part</div>
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
                        {lineItemErrors[index]?.part && (
                          <div className="text-xs text-destructive">{lineItemErrors[index]?.part}</div>
                        )}
                      </div>
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
                        {isLocked && (
                          <span className="text-[11px] text-amber-400">Ordered/received item</span>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
                {!isReadOnly && !isCollectCarPending && (
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white"
                      onClick={() =>
                        setParts((prev) => [
                          ...prev,
                          { part: "", description: "", qty: "1", reason: "Mandatory" },
                        ])
                      }
                      disabled={parts.some((p) => !p.isSaved)}
                    >
                      + Add
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
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
                  disabled={inspectionStep >= 6}
                >
                  Next Step
                </button>
              </div>
            </div>

            <div
              className={`mt-6 flex items-center justify-end gap-2 ${
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
    </AppLayout>
  );
}

export default function InspectionDetailPage({ params }: Params) {
  return <InspectionDetailPageClient params={params} />;
}
