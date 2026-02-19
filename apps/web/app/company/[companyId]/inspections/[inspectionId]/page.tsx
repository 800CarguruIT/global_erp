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
};
type InspectionLogEntry = {
  id: string;
  action: string;
  by: string;
  at: string;
  message?: string;
};

type CheckValue = "good" | "avg" | "bad" | "";

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
          `/api/company/${companyId}/workshop/inspections/${inspectionId}`
        );
        if (!res.ok) throw new Error("Failed to load inspection");
        const data: { data: InspectionData } = await res.json();
        const payload = data?.data?.inspection ?? null;
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
            `/api/company/${companyId}/workshop/inspections/${payload.id}/line-items?source=inspection`
          );
          if (itemsRes.ok) {
            const itemsJson = await itemsRes.json();
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
              setParts(
                mappedParts
              );
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
  const isReadOnly = isCancelled || isVerified;
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
    checks,
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
  const hasUnsavedLineItems = parts.some((p) => !p.isSaved);
  const hasUnsavedChanges =
    !isReadOnly &&
    ((form.inspectorRemarks ?? "").trim() !== (initialRemarksRef.current ?? "").trim() ||
      serializePartsForCompare(parts) !== initialPartsSignatureRef.current ||
      serializeChecksForCompare(checks) !== initialChecksSignatureRef.current);
  const requiredMediaMissing = parts.some((row) => getMediaRequirement(row).required && !row.mediaFileId);
  const canCompleteInspection =
    !saving &&
    !isReadOnly &&
    Boolean(companyId && inspectionId) &&
    !hasUnsavedLineItems &&
    !requiredMediaMissing &&
    Boolean((form.inspectorRemarks ?? "").trim());
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
    disabled: isReadOnly || videoUploading !== null,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;
      void uploadInspectionVideo(file, "in");
    },
  });

  const carOutDropzone = useDropzone({
    accept: { "video/*": [] },
    multiple: false,
    disabled: isReadOnly || videoUploading !== null,
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
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
            <span className={hasUnsavedChanges ? "text-amber-300" : "text-emerald-300"}>
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </span>
            {!isReadOnly && (
              <>
              {hasUnsavedLineItems && <span className="text-amber-300">Save all line items before completion.</span>}
              {requiredMediaMissing && <span className="text-amber-300">Required part media is missing.</span>}
              {!form.inspectorRemarks?.trim() && <span className="text-amber-300">Inspector remarks are required.</span>}
              {currentStatus === "completed" && !advisorApproved && !isWorkshopView && (
                <span className="text-cyan-300">Advisor approval pending.</span>
              )}
              </>
            )}
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

        <div className={`grid gap-4 ${isWorkshopView ? "" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"}`}>
          <Card className={`p-4 ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-sm font-semibold">Inspection Details</div>
              {loading && <div className="text-xs text-white/60">Loading...</div>}
            </div>
            <div className="grid gap-4 pt-4 lg:grid-cols-2">
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
                            checked={checks[item.key] === val}
                            disabled={isReadOnly}
                            onChange={() => updateCheck(item.key, val)}
                          />
                          <span className="capitalize">{val}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
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
                  readOnly={isReadOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, carInMileage: e.target.value }))}
                  placeholder="543367685"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
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
                  readOnly={isReadOnly}
                  onChange={(e) => setForm((prev) => ({ ...prev, inspectorRemarks: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-6">
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
                      {/* <input {...carInDropzone.getInputProps()} /> */}
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

            <div className="mt-6">
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
                      isReadOnly || row.partOrdered === 1 || row.orderStatus === "Ordered" || row.orderStatus === "Received";
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
                        {!row.isSaved && (
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
                    disabled={isReadOnly || parts.some((p) => !p.isSaved)}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              {isReadOnly ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText}`}
                  disabled
                >
                  {isCancelled ? "Inspection Cancelled" : "Inspection Verified"}
                </button>
              ) : !startedAt ? (
                <button
                  type="button"
                  className={`rounded-md px-6 py-2 text-xs font-semibold uppercase tracking-wide ${theme.cardBorder} ${theme.surfaceSubtle} ${theme.mutedText} hover:bg-white/10`}
                  disabled={saving || !companyId || !inspectionId}
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
                    disabled={saving || !companyId || !inspectionId}
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
                        disabled={saving || advisorApproved || !companyId || !inspectionId}
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
                        disabled={saving || customerApproved || !companyId || !inspectionId}
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

            <div className="mt-6 rounded-md bg-white/5 p-3">
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
