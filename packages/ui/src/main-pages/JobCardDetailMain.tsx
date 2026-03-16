"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import { FileUploader } from "../components/FileUploader";

type JobCardDetailMainProps = {
  companyId: string;
  jobCardId: string;
  workshopBranchId?: string | null;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type JobCardPayload = {
  jobCard: any;
  items: any[];
  collectCarMedia?: {
    sourceType?: string;
    sourceMedia?: Record<string, string>;
    carMediaReview?: Record<string, "pending" | "verified" | "rejected">;
    carMediaReplacement?: Record<string, string>;
    carMediaRejectNote?: Record<string, string>;
  } | null;
};
type ProductOption = {
  id: number | string;
  name: string;
  type?: string | null;
};
type CarMediaKey = "front" | "rear" | "right" | "left" | "video";
type CarMediaReviewStatus = "pending" | "verified" | "rejected";
const carMediaKeys: CarMediaKey[] = ["front", "rear", "right", "left", "video"];

export function JobCardDetailMain({ companyId, jobCardId, workshopBranchId = null }: JobCardDetailMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<JobCardPayload>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [remarks, setRemarks] = useState("");
  const [collectCarMileage, setCollectCarMileage] = useState("");
  const [isSavingCollectCar, setIsSavingCollectCar] = useState(false);
  const [preCheckVin, setPreCheckVin] = useState("");
  const [preCheckPlate, setPreCheckPlate] = useState("");
  const [preCheckMake, setPreCheckMake] = useState("");
  const [preCheckModel, setPreCheckModel] = useState("");
  const [preCheckYear, setPreCheckYear] = useState("");
  const [collectCarSourceMedia, setCollectCarSourceMedia] = useState<Record<CarMediaKey, string>>({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
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
  const [carMediaRejectNote, setCarMediaRejectNote] = useState<Record<CarMediaKey, string>>({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
  });
  const [preWorkNote, setPreWorkNote] = useState("");
  const [isSavingPreWork, setIsSavingPreWork] = useState(false);
  const [completionEngineImageId, setCompletionEngineImageId] = useState("");
  const [completionBottomImageId, setCompletionBottomImageId] = useState("");
  const [isSavingCompletionEvidence, setIsSavingCompletionEvidence] = useState(false);
  const [finalInspectionChecks, setFinalInspectionChecks] = useState({
    testDrive: false,
    clusterWarning: false,
    tyreCheck: false,
    computerReset: false,
    protectiveShields: false,
  });
  const [finalInspectionCarPhotos, setFinalInspectionCarPhotos] = useState({
    front: "",
    rear: "",
    right: "",
    left: "",
  });
  const [finalInspectionRemarks, setFinalInspectionRemarks] = useState("");
  const [finalInspectionPartStatusByItemId, setFinalInspectionPartStatusByItemId] = useState<
    Record<string, "" | "verified" | "rework">
  >({});
  const [finalInspectionReworkNote, setFinalInspectionReworkNote] = useState("");
  const [isSavingFinalInspection, setIsSavingFinalInspection] = useState(false);
  const [carWashMedia, setCarWashMedia] = useState({
    front: "",
    rear: "",
    right: "",
    left: "",
    video: "",
  });
  const [carWashNotes, setCarWashNotes] = useState("");
  const [isSavingCarWash, setIsSavingCarWash] = useState(false);
  const [additionalItemName, setAdditionalItemName] = useState("");
  const [additionalItemMode, setAdditionalItemMode] = useState("recommended");
  const [additionalItemImageId, setAdditionalItemImageId] = useState("");
  const [isSavingAdditionalItem, setIsSavingAdditionalItem] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [activeWizardStep, setActiveWizardStep] = useState("quote");
  const [savingReceiveByItemId, setSavingReceiveByItemId] = useState<Record<string, boolean>>({});
  const [receiveQtyByItemId, setReceiveQtyByItemId] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setState({ status: "loaded", data: json.data, error: null });
          setRemarks("");
          const card = json?.data?.jobCard ?? null;
          const collectMedia = (json?.data?.collectCarMedia ?? {}) as any;
          const sourceMedia = (collectMedia?.sourceMedia ?? {}) as Record<string, string>;
          const replacement = (collectMedia?.carMediaReplacement ?? {}) as Record<string, string>;
          const rejectNote = (collectMedia?.carMediaRejectNote ?? {}) as Record<string, string>;
          setCollectCarMileage(
            card?.collect_car_mileage != null ? String(card.collect_car_mileage) : ""
          );
          const draft = (card?.inspection_draft_payload ?? {}) as Record<string, any>;
          setPreCheckVin(String(card?.vin ?? draft?.inspectionVin ?? "").trim());
          setPreCheckPlate(String(card?.plate_number ?? draft?.inspectionPlate ?? "").trim());
          setPreCheckMake(String(card?.make ?? draft?.inspectionMake ?? "").trim());
          setPreCheckModel(String(card?.model ?? draft?.inspectionModel ?? "").trim());
          setPreCheckYear(
            String(card?.model_year ?? draft?.inspectionYear ?? "").trim()
          );
          setCompletionEngineImageId(String(draft?.jobCardEngineImageId ?? ""));
          setCompletionBottomImageId(String(draft?.jobCardBottomImageId ?? ""));
          setCollectCarSourceMedia({
            front: String(sourceMedia.front ?? ""),
            rear: String(sourceMedia.rear ?? ""),
            right: String(sourceMedia.right ?? ""),
            left: String(sourceMedia.left ?? ""),
            video: String(sourceMedia.video ?? ""),
          });
          setCarMediaReview({
            front: "pending",
            rear: "pending",
            right: "pending",
            left: "pending",
            video: "pending",
          });
          setCarMediaReplacement({
            front: String(replacement.front ?? ""),
            rear: String(replacement.rear ?? ""),
            right: String(replacement.right ?? ""),
            left: String(replacement.left ?? ""),
            video: String(replacement.video ?? ""),
          });
          setCarMediaRejectNote({
            front: String(rejectNote.front ?? ""),
            rear: String(rejectNote.rear ?? ""),
            right: String(rejectNote.right ?? ""),
            left: String(rejectNote.left ?? ""),
            video: String(rejectNote.video ?? ""),
          });
          setPreWorkNote(String(card?.pre_work_note ?? ""));
          setFinalInspectionChecks({
            testDrive: Boolean(card?.final_inspection_test_drive),
            clusterWarning: Boolean(card?.final_inspection_cluster_warning),
            tyreCheck: Boolean(card?.final_inspection_tyre_check),
            computerReset: Boolean(card?.final_inspection_computer_reset),
            protectiveShields: Boolean(card?.final_inspection_protective_shields),
          });
          const finalPhotos = (draft?.jobCardFinalInspectionCarPhotos ?? {}) as Record<string, string>;
          setFinalInspectionCarPhotos({
            front: String(finalPhotos.front ?? ""),
            rear: String(finalPhotos.rear ?? ""),
            right: String(finalPhotos.right ?? ""),
            left: String(finalPhotos.left ?? ""),
          });
          setFinalInspectionRemarks(String(draft?.jobCardFinalInspectionRemarks ?? card?.final_inspection_remarks ?? ""));
          const rework = (draft?.jobCardFinalInspectionRework ?? null) as
            | { lineItemIds?: string[]; note?: string }
            | null;
          const draftPartStatuses =
            draft?.jobCardFinalInspectionPartStatuses &&
            typeof draft.jobCardFinalInspectionPartStatuses === "object"
              ? (draft.jobCardFinalInspectionPartStatuses as Record<string, unknown>)
              : null;
          if (draftPartStatuses) {
            const mapped: Record<string, "" | "verified" | "rework"> = {};
            Object.entries(draftPartStatuses).forEach(([itemId, status]) => {
              const normalized = String(status ?? "").toLowerCase();
              mapped[String(itemId)] = normalized === "rework" ? "rework" : normalized === "verified" ? "verified" : "";
            });
            setFinalInspectionPartStatusByItemId(mapped);
          } else {
            const reworkSet = new Set(
              Array.isArray(rework?.lineItemIds) ? rework!.lineItemIds.map((id) => String(id)) : []
            );
            const fallback: Record<string, "" | "verified" | "rework"> = {};
            const loadedItems = Array.isArray(json?.data?.items) ? json.data.items : [];
            loadedItems.forEach((row: any) => {
              const itemId = String(row?.id ?? "");
              if (!itemId) return;
              fallback[itemId] = reworkSet.has(itemId) ? "rework" : "";
            });
            setFinalInspectionPartStatusByItemId(fallback);
          }
          setFinalInspectionReworkNote(String(rework?.note ?? ""));
          const washMedia = (draft?.jobCardCarWashMedia ?? {}) as Record<string, string>;
          setCarWashMedia({
            front: String(washMedia.front ?? ""),
            rear: String(washMedia.rear ?? ""),
            right: String(washMedia.right ?? ""),
            left: String(washMedia.left ?? ""),
            video: String(washMedia.video ?? ""),
          });
          setCarWashNotes(String(draft?.jobCardCarWashNotes ?? ""));
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load job card." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, jobCardId]);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped = rows
          .map((row: any) => ({
            id: row?.id ?? row?.name ?? "",
            name: String(row?.name ?? "").trim(),
            type: row?.type ?? null,
          }))
          .filter((row: ProductOption) => row.name.length > 0);
        setProductOptions(mapped);
      } catch {
        if (!cancelled) setProductOptions([]);
      }
    }
    loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobCard = useMemo(() => (state.status === "loaded" ? state.data.jobCard : null), [state]);
  const items = useMemo(() => (state.status === "loaded" ? state.data.items ?? [] : []), [state]);
  const primaryItems = useMemo(
    () => items.filter((item) => Number(item.is_add ?? 0) !== 1),
    [items]
  );
  const requiredPrimaryItems = useMemo(
    () =>
      primaryItems.filter((item) => {
        const approval = String(item.customer_approval_status ?? "").toLowerCase();
        const status = String(item.status ?? "").toLowerCase();
        return approval === "approved" || status === "approved";
      }),
    [primaryItems]
  );

  const carLabel = useMemo(() => {
    if (!jobCard) return "";
    return [jobCard.make, jobCard.model].filter(Boolean).join(" ");
  }, [jobCard]);

  const startAtRaw = jobCard?.start_at ?? null;
  const startAt = startAtRaw ? new Date(startAtRaw).toLocaleString() : "";
  const completeAt = jobCard?.complete_at ? new Date(jobCard.complete_at).toLocaleString() : "";
  const quoteRemarks = String(jobCard?.quote_remarks ?? "");
  const workshopQuoteStatus = String(jobCard?.workshop_quote_status ?? "").toLowerCase();
  const assignedBranchId = (jobCard?.lead_branch_id as string | null) ?? null;
  const isAssignedWorkshop =
    !workshopBranchId || !assignedBranchId ? true : workshopBranchId === assignedBranchId;
  const canProgressByQuote = workshopQuoteStatus === "accepted" || workshopQuoteStatus === "verified";
  const canProgressJobCard = canProgressByQuote && isAssignedWorkshop;
  const isPreWorkDone = Boolean(jobCard?.pre_work_checked_at);
  const isJobStarted = Boolean(jobCard?.start_at);
  const isJobCompleted = Boolean(jobCard?.complete_at);
  const hasCompletionEngineImage = completionEngineImageId.trim().length > 0;
  const hasCompletionBottomImage = completionBottomImageId.trim().length > 0;
  const isFinalInspectionDone = Boolean(jobCard?.final_inspection_at);
  const isCarWashDone = Boolean(jobCard?.final_inspection_car_wash);
  const isCollectCarDone = Boolean(jobCard?.collect_car_at);
  const carMediaCounts = useMemo(() => {
    const entries = carMediaKeys
      .filter((key) => Boolean(collectCarSourceMedia[key]))
      .map((key) => carMediaReview[key]);
    return {
      total: entries.length,
      verified: entries.filter((v) => v === "verified").length,
      rejected: entries.filter((v) => v === "rejected").length,
      pending: entries.filter((v) => v === "pending").length,
    };
  }, [carMediaReview, collectCarSourceMedia]);
  const rejectedMediaMissingReplacement = useMemo(
    () =>
      carMediaKeys.some(
        (key) =>
          Boolean(collectCarSourceMedia[key]) &&
          carMediaReview[key] === "rejected" &&
          !String(carMediaReplacement[key] ?? "").trim()
      ),
    [carMediaReplacement, carMediaReview, collectCarSourceMedia]
  );
  const normalizeReceiveStatus = (item: any): "Ordered" | "Received" | "Returned" | "Partially Received" => {
    const raw = String(item?.po_status ?? item?.order_status ?? "Ordered").trim().toLowerCase();
    if (raw.includes("partial")) return "Partially Received";
    if (raw === "received" || raw === "completed") return "Received";
    if (raw === "returned" || raw === "return") return "Returned";
    return "Ordered";
  };
  const itemsForReceivedChecks = useMemo(
    () =>
      requiredPrimaryItems.filter((item) => {
        const isAdditional = Number(item.is_add ?? 0) === 1;
        const itemStatus = String(item.po_status ?? item.order_status ?? "").toLowerCase();
        return !(isAdditional && itemStatus === "pending");
      }),
    [requiredPrimaryItems]
  );
  const atLeastOnePartReceived = useMemo(() => {
    if (itemsForReceivedChecks.length === 0) return true;
    return itemsForReceivedChecks.some(
      (item) => String(item.po_status ?? item.order_status ?? "").toLowerCase() === "received"
    );
  }, [itemsForReceivedChecks]);
  const receivedItems = useMemo(
    () =>
      itemsForReceivedChecks.filter(
        (item) => String(item.po_status ?? item.order_status ?? "").toLowerCase() === "received"
      ),
    [itemsForReceivedChecks]
  );
  const notFullyReceivedItems = useMemo(
    () =>
      itemsForReceivedChecks.filter((item) => {
        const linked = Boolean(item.procurement_linked);
        const orderedQtyRaw = Number(item.procurement_po_qty ?? item.quantity ?? 0);
        const receivedQtyRaw = Number(item.procurement_po_received_qty ?? 0);
        const orderedQty = Number.isFinite(orderedQtyRaw) ? Math.max(0, orderedQtyRaw) : 0;
        const receivedQty = Number.isFinite(receivedQtyRaw) ? Math.max(0, receivedQtyRaw) : 0;
        if (!linked) return true;
        if (orderedQty <= 0) return true;
        return receivedQty + 1e-9 < orderedQty;
      }),
    [itemsForReceivedChecks]
  );
  const allRequiredPartsFullyReceived = useMemo(
    () => notFullyReceivedItems.length === 0,
    [notFullyReceivedItems]
  );
  const additionalItems = useMemo(
    () => items.filter((item) => Number(item.is_add ?? 0) === 1),
    [items]
  );
  const approvedPartsFinalizationPending = useMemo(
    () =>
      requiredPrimaryItems.filter((item) => {
        const status = normalizeReceiveStatus(item);
        return status !== "Received" || !String(item.part_pic ?? "").trim() || !String(item.scrap_pic ?? "").trim();
      }),
    [requiredPrimaryItems]
  );
  const quoteSummary = useMemo(() => {
    const lines = quoteRemarks
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const amountLine = lines.find((line) => line.toLowerCase().startsWith("quoted amount:")) ?? "";
    const etaLine = lines.find((line) => line.toLowerCase().startsWith("estimated time:")) ?? "";
    const amountValue = amountLine ? amountLine.replace(/quoted amount:/i, "").trim() : "N/A";
    const etaValue = etaLine ? etaLine.replace(/estimated time:/i, "").trim() : "N/A";
    const noteLines = lines.filter((line) => line !== amountLine && line !== etaLine);
    return {
      amount: amountValue,
      eta: etaValue,
      notes: noteLines.join(" "),
    };
  }, [quoteRemarks]);
  const partPicMissingCount = useMemo(
    () => requiredPrimaryItems.filter((item) => !(item.part_pic ?? "")).length,
    [requiredPrimaryItems]
  );
  const scrapPicMissingCount = useMemo(
    () => requiredPrimaryItems.filter((item) => !(item.scrap_pic ?? "")).length,
    [requiredPrimaryItems]
  );
  const requiredUploadsPending = partPicMissingCount;
  const isEvidenceDone =
    partPicMissingCount === 0 && requiredPrimaryItems.length > 0;
  const receivedPartPicMissingCount = useMemo(
    () => receivedItems.filter((item) => !(item.part_pic ?? "")).length,
    [receivedItems]
  );
  const receivedRequiredUploadsPending = receivedPartPicMissingCount;
  const hasAllReceivedPartPictures =
    receivedItems.length === 0 || receivedRequiredUploadsPending === 0;
  const isQuoteStep = activeWizardStep === "quote";
  const isCollectCarStep = activeWizardStep === "collect_car";
  const isPreWorkStep = activeWizardStep === "pre_work";
  const isPartsReceiveStep = activeWizardStep === "parts_receive";
  const isStartStep = activeWizardStep === "start";
  const isEvidenceStep = activeWizardStep === "evidence";
  const isCompleteStep = activeWizardStep === "complete";
  const isFinalInspectionStep = activeWizardStep === "final_inspection";
  const isCarWashStep = activeWizardStep === "car_wash";
  const finalInspectionRequiredItemIds = useMemo(
    () => requiredPrimaryItems.map((item) => String(item.id ?? "")).filter(Boolean),
    [requiredPrimaryItems]
  );
  const finalInspectionReworkLineItemIds = useMemo(
    () =>
      finalInspectionRequiredItemIds.filter(
        (itemId) => finalInspectionPartStatusByItemId[itemId] === "rework"
      ),
    [finalInspectionPartStatusByItemId, finalInspectionRequiredItemIds]
  );
  const isFinalInspectionPartDecisionDone = useMemo(
    () =>
      finalInspectionRequiredItemIds.every(
        (itemId) => finalInspectionPartStatusByItemId[itemId] === "verified" || finalInspectionPartStatusByItemId[itemId] === "rework"
      ),
    [finalInspectionPartStatusByItemId, finalInspectionRequiredItemIds]
  );
  const isFinalInspectionChecklistDone = Object.values(finalInspectionChecks).every(Boolean);
  const isFinalInspectionPhotosDone =
    finalInspectionCarPhotos.front.trim().length > 0 &&
    finalInspectionCarPhotos.rear.trim().length > 0 &&
    finalInspectionCarPhotos.right.trim().length > 0 &&
    finalInspectionCarPhotos.left.trim().length > 0;
  const isFinalInspectionReworkValid =
    finalInspectionReworkLineItemIds.length === 0 || finalInspectionReworkNote.trim().length > 0;
  const canSaveFinalInspectionNow =
    isJobCompleted &&
    approvedPartsFinalizationPending.length === 0 &&
    isFinalInspectionChecklistDone &&
    isFinalInspectionPhotosDone &&
    isFinalInspectionPartDecisionDone &&
    isFinalInspectionReworkValid &&
    !isFinalInspectionDone;
  const isCarWashMediaDone =
    carWashMedia.front.trim().length > 0 &&
    carWashMedia.rear.trim().length > 0 &&
    carWashMedia.right.trim().length > 0 &&
    carWashMedia.left.trim().length > 0 &&
    carWashMedia.video.trim().length > 0;
  const canSaveCarWashNow =
    isJobCompleted && isFinalInspectionDone && isCarWashMediaDone && !isCarWashDone;
  const showPartsTable =
    isPreWorkStep ||
    isPartsReceiveStep ||
    isStartStep ||
    isEvidenceStep ||
    isCompleteStep ||
    isFinalInspectionStep;
  const progressSteps = useMemo(
    () => [
      { key: "quote", label: "Quote Accepted", done: canProgressByQuote },
      { key: "collect_car", label: "Collect Car", done: isCollectCarDone },
      { key: "pre_work", label: "Pre-Work Check", done: isPreWorkDone },
      { key: "parts_receive", label: "Parts Receive", done: atLeastOnePartReceived },
      { key: "start", label: "Start Job", done: isJobStarted },
      { key: "evidence", label: "Evidence Upload", done: isEvidenceDone },
      { key: "complete", label: "Completed", done: isJobCompleted },
      { key: "final_inspection", label: "Final Inspection", done: isFinalInspectionDone },
      { key: "car_wash", label: "Car Wash", done: isCarWashDone },
    ],
    [
      canProgressByQuote,
      isCollectCarDone,
      isPreWorkDone,
      atLeastOnePartReceived,
      isJobStarted,
      isEvidenceDone,
      isJobCompleted,
      isFinalInspectionDone,
      isCarWashDone,
    ]
  );
  const currentProgressIndex = useMemo(() => {
    const firstPending = progressSteps.findIndex((step) => !step.done);
    return firstPending === -1 ? progressSteps.length - 1 : firstPending;
  }, [progressSteps]);
  const activeStageRequirements = useMemo(() => {
    if (activeWizardStep === "quote") return [{ label: "Quote accepted", done: canProgressByQuote }];
    if (activeWizardStep === "collect_car") return [{ label: "Quote accepted", done: canProgressByQuote }];
    if (activeWizardStep === "pre_work") {
      return [
        { label: "Collect car saved", done: isCollectCarDone },
      ];
    }
    if (activeWizardStep === "parts_receive") {
      return [
        { label: "Collect car saved", done: isCollectCarDone },
        { label: "Pre-work check done", done: isPreWorkDone },
        { label: "At least one part received", done: atLeastOnePartReceived },
      ];
    }
    if (activeWizardStep === "start") {
      return [
        { label: "Collect car saved", done: isCollectCarDone },
        { label: "Pre-work check done", done: isPreWorkDone },
        { label: "At least one part received", done: atLeastOnePartReceived },
        { label: "Received part photos uploaded", done: hasAllReceivedPartPictures },
      ];
    }
    if (activeWizardStep === "evidence") return [{ label: "Job started", done: isJobStarted }];
    if (activeWizardStep === "complete") {
      return [
        { label: "Job started", done: isJobStarted },
        { label: "All required parts fully received", done: allRequiredPartsFullyReceived },
        { label: "Engine image uploaded", done: hasCompletionEngineImage },
        { label: "Bottom image uploaded", done: hasCompletionBottomImage },
        { label: "All parts scrap images uploaded", done: scrapPicMissingCount === 0 },
      ];
    }
    if (activeWizardStep === "car_wash") {
      return [
        { label: "Job completed", done: isJobCompleted },
        { label: "Final inspection done", done: isFinalInspectionDone },
        { label: "Car wash images uploaded", done: carWashMedia.front.trim().length > 0 && carWashMedia.rear.trim().length > 0 && carWashMedia.right.trim().length > 0 && carWashMedia.left.trim().length > 0 },
        { label: "Car wash video uploaded", done: carWashMedia.video.trim().length > 0 },
      ];
    }
    return [
      { label: "Job completed", done: isJobCompleted },
      { label: "All approved parts finalized", done: approvedPartsFinalizationPending.length === 0 },
      { label: "Verify/Re-Work selected for each approved part", done: isFinalInspectionPartDecisionDone },
      { label: "Checklist all verified", done: Object.values(finalInspectionChecks).every(Boolean) },
      {
        label: "Final car photos uploaded",
        done:
          finalInspectionCarPhotos.front.trim().length > 0 &&
          finalInspectionCarPhotos.rear.trim().length > 0 &&
          finalInspectionCarPhotos.right.trim().length > 0 &&
          finalInspectionCarPhotos.left.trim().length > 0,
      },
    ];
  }, [
    activeWizardStep,
    atLeastOnePartReceived,
    canProgressByQuote,
    isCollectCarDone,
    isJobStarted,
    isPreWorkDone,
    allRequiredPartsFullyReceived,
    hasAllReceivedPartPictures,
    hasCompletionEngineImage,
    hasCompletionBottomImage,
    scrapPicMissingCount,
    isJobCompleted,
    isFinalInspectionDone,
    carWashMedia.front,
    carWashMedia.rear,
    carWashMedia.right,
    carWashMedia.left,
    carWashMedia.video,
    approvedPartsFinalizationPending.length,
    isFinalInspectionPartDecisionDone,
    finalInspectionChecks,
    finalInspectionCarPhotos.front,
    finalInspectionCarPhotos.rear,
    finalInspectionCarPhotos.right,
    finalInspectionCarPhotos.left,
  ]);
  const unmetRequirementCount = activeStageRequirements.filter((req) => !req.done).length;

  useEffect(() => {
    const firstPending = progressSteps.find((step) => !step.done);
    if (firstPending) setActiveWizardStep(firstPending.key);
    else if (progressSteps.length) setActiveWizardStep(progressSteps[progressSteps.length - 1]?.key ?? "quote");
  }, [progressSteps]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    setFinalInspectionPartStatusByItemId((prev) => {
      const next: Record<string, "" | "verified" | "rework"> = { ...prev };
      let changed = false;
      finalInspectionRequiredItemIds.forEach((itemId) => {
        if (!(itemId in next)) {
          next[itemId] = "";
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [finalInspectionRequiredItemIds]);

  async function startJobCard() {
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to start job card.");
      }
      const json = await res.json();
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: { ...prev.data.jobCard, start_at: json?.data?.start_at ?? new Date().toISOString() },
          },
        };
      });
      setToastMessage({ type: "success", text: "Job card started." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to start job card." });
    }
  }

  async function completeJobCard() {
    try {
      if (!remarks.trim()) {
        setToastMessage({ type: "error", text: "Remarks are required before completing." });
        return;
      }
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", remarks }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to complete job card.");
      }
      const json = await res.json();
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: {
              ...prev.data.jobCard,
              complete_at: json?.data?.complete_at ?? new Date().toISOString(),
              status: "Completed",
              remarks,
            },
          },
        };
      });
      setToastMessage({ type: "success", text: "Job card completed." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to complete job card." });
    }
  }

  async function updateItemPic(lineItemId: string, field: "partPic" | "scrapPic", fileId: string | null) {
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/job-cards/${jobCardId}/line-items/${lineItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: fileId }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to upload file.");
      }
      const json = await res.json();
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            items: prev.data.items.map((item) =>
              item.id === lineItemId ? { ...item, ...json.data } : item
            ),
          },
        };
      });
      setToastMessage({ type: "success", text: "File uploaded." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to upload file." });
    }
  }

  async function saveCompletionEvidence() {
    if (!completionEngineImageId.trim() || !completionBottomImageId.trim()) {
      setToastMessage({ type: "error", text: "Engine image and bottom image are required." });
      return;
    }
    setIsSavingCompletionEvidence(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "completion_evidence",
          engineImageId: completionEngineImageId.trim(),
          bottomImageId: completionBottomImageId.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save completion evidence.");
      }
      setCompletionEngineImageId(String(json?.data?.engineImageId ?? completionEngineImageId).trim());
      setCompletionBottomImageId(String(json?.data?.bottomImageId ?? completionBottomImageId).trim());
      setToastMessage({ type: "success", text: "Completion evidence saved." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to save completion evidence." });
    } finally {
      setIsSavingCompletionEvidence(false);
    }
  }

  async function updateItemReceiveStatus(
    lineItemId: string,
    nextStatus: "Received" | "Returned" | "Partially Received",
    quantityText?: string
  ) {
    setSavingReceiveByItemId((prev) => ({ ...prev, [lineItemId]: true }));
    try {
      const quantityNum = Number(String(quantityText ?? "").trim());
      if ((nextStatus === "Partially Received" || nextStatus === "Returned") && (!Number.isFinite(quantityNum) || quantityNum <= 0)) {
        throw new Error(nextStatus === "Returned" ? "Enter return quantity." : "Enter received quantity.");
      }
      const res = await fetch(
        `/api/company/${companyId}/workshop/job-cards/${jobCardId}/line-items/${lineItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiveStatus: nextStatus,
            quantity:
              nextStatus === "Partially Received" || nextStatus === "Returned"
                ? quantityNum
                : undefined,
          }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to update receive status.");
      }
      const json = await res.json().catch(() => ({}));
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            items: prev.data.items.map((item) =>
              String(item.id) === String(lineItemId)
                ? {
                    ...item,
                    po_status: json?.data?.receive_status ?? nextStatus,
                    order_status:
                      json?.data?.order_status ??
                      (nextStatus === "Partially Received" ? "Ordered" : nextStatus),
                    procurement_linked:
                      json?.data?.procurement?.linked ?? item.procurement_linked ?? false,
                    procurement_po_id:
                      json?.data?.procurement?.poId ?? item.procurement_po_id ?? null,
                    procurement_po_item_id:
                      json?.data?.procurement?.poItemId ?? item.procurement_po_item_id ?? null,
                    procurement_po_status:
                      json?.data?.procurement?.poStatus ?? item.procurement_po_status ?? null,
                    procurement_po_item_status:
                      json?.data?.procurement?.poItemStatus ?? item.procurement_po_item_status ?? null,
                    procurement_po_qty:
                      json?.data?.procurement?.poItemOrderedQty ?? item.procurement_po_qty ?? null,
                    procurement_po_received_qty:
                      json?.data?.procurement?.poItemReceivedQty ?? item.procurement_po_received_qty ?? null,
                    procurement_latest_grn_number:
                      json?.data?.procurement?.latestGrnNumber ?? item.procurement_latest_grn_number ?? null,
                    procurement_inventory_moved:
                      json?.data?.procurement?.inventoryMoved ?? item.procurement_inventory_moved ?? false,
                    procurement_accounting_posted:
                      json?.data?.procurement?.accountingPosted ?? item.procurement_accounting_posted ?? false,
                  }
                : item
            ),
          },
        };
      });
      setToastMessage({ type: "success", text: "Part receiving status updated." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to update receive status." });
    } finally {
      setSavingReceiveByItemId((prev) => ({ ...prev, [lineItemId]: false }));
    }
  }

  function handleReceiveStatusClick(
    lineItemId: string,
    nextStatus: "Received" | "Returned" | "Partially Received",
    quantityText: string,
    isProcurementLinked: boolean
  ) {
    if (!isProcurementLinked) {
      setToastMessage({ type: "error", text: "Link this part to procurement PO first." });
      return;
    }
    void updateItemReceiveStatus(lineItemId, nextStatus, quantityText);
  }

  async function saveCollectCarStage() {
    const mediaKeysWithSource = carMediaKeys.filter((key) => Boolean(collectCarSourceMedia[key]));
    const hasPendingMedia = mediaKeysWithSource.some((key) => carMediaReview[key] === "pending");
    if (hasPendingMedia) {
      setToastMessage({ type: "error", text: "Verify or reject all car images/videos first." });
      return;
    }
    if (rejectedMediaMissingReplacement) {
      setToastMessage({
        type: "error",
        text: "Upload replacement media for all rejected images/videos.",
      });
      return;
    }
    setIsSavingCollectCar(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect_car",
          collectCarSourceMedia,
          carMediaReview,
          carMediaReplacement,
          carMediaRejectNote,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to save Collect Car stage.");
      }
      const json = await res.json().catch(() => ({}));
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: {
              ...prev.data.jobCard,
              collect_car_at: json?.data?.collect_car_at ?? new Date().toISOString(),
            },
          },
        };
      });
      setToastMessage({ type: "success", text: "Collect Car stage saved." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to save Collect Car stage." });
    } finally {
      setIsSavingCollectCar(false);
    }
  }

  async function savePreWorkCheck() {
    const mileage = Number(collectCarMileage);
    if (!isCollectCarDone) {
      setToastMessage({ type: "error", text: "Complete Collect Car stage first." });
      return;
    }
    if (!Number.isFinite(mileage) || mileage <= 0) {
      setToastMessage({ type: "error", text: "Enter valid car mileage in Pre-Work Check." });
      return;
    }
    setIsSavingPreWork(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pre_work_check",
          collectCarMileage: mileage,
          carVin: preCheckVin.trim() || null,
          carPlate: preCheckPlate.trim() || null,
          carMake: preCheckMake.trim() || null,
          carModel: preCheckModel.trim() || null,
          carYear: preCheckYear.trim() || null,
          preWorkNote: preWorkNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || "Failed to save Pre-Work Check.");
      }
      const json = await res.json().catch(() => ({}));
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: {
              ...prev.data.jobCard,
              pre_work_checked_at: json?.data?.pre_work_checked_at ?? new Date().toISOString(),
              collect_car_mileage: json?.data?.collect_car_mileage ?? mileage,
              vin: preCheckVin.trim() || prev.data.jobCard?.vin || null,
              plate_number: preCheckPlate.trim() || prev.data.jobCard?.plate_number || null,
              make: preCheckMake.trim() || prev.data.jobCard?.make || null,
              model: preCheckModel.trim() || prev.data.jobCard?.model || null,
              model_year: (() => {
                const yearText = preCheckYear.trim() || String(prev.data.jobCard?.model_year ?? "").trim();
                return yearText ? Number(yearText) : null;
              })(),
              pre_work_note: json?.data?.pre_work_note ?? preWorkNote.trim(),
            },
          },
        };
      });
      setToastMessage({ type: "success", text: "Pre-Work Check completed." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to save Pre-Work Check." });
    } finally {
      setIsSavingPreWork(false);
    }
  }

  async function addAdditionalLineItem() {
    const itemName = additionalItemName.trim();
    if (!itemName) {
      setToastMessage({ type: "error", text: "Part name is required." });
      return;
    }
    if (!additionalItemImageId.trim()) {
      setToastMessage({ type: "error", text: "Item image is required." });
      return;
    }
    setIsSavingAdditionalItem(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_additional_item",
          itemName,
          addMode: additionalItemMode,
          imageId: additionalItemImageId.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to add additional item.");
      }
      setAdditionalItemName("");
      setAdditionalItemMode("recommended");
      setAdditionalItemImageId("");
      const targetJobCardId = String(json?.data?.target_job_card_id ?? "").trim();
      setToastMessage({
        type: "success",
        text: targetJobCardId
          ? `Additional item added to separate job card (${targetJobCardId.slice(0, 8)}...).`
          : "Additional item added to separate job card (pending customer approval).",
      });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to add additional item." });
    } finally {
      setIsSavingAdditionalItem(false);
    }
  }

  const statusActionMeta: ReadonlyArray<{
    label: string;
    value: "Received" | "Partially Received" | "Returned";
    activeClass: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "Received",
      value: "Received",
      activeClass: "border-emerald-400/60 bg-emerald-500/20 text-emerald-200",
      icon: (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8.5 6.2 11.5 13 4.5" />
        </svg>
      ),
    },
    {
      label: "Partial",
      value: "Partially Received",
      activeClass: "border-amber-400/60 bg-amber-500/20 text-amber-200",
      icon: (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 5.5h12M2 10.5h6" />
        </svg>
      ),
    },
    {
      label: "Return",
      value: "Returned",
      activeClass: "border-sky-400/60 bg-sky-500/20 text-sky-200",
      icon: (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 4 2.5 7.5 6 11" />
          <path d="M3 7.5h6.5a3.5 3.5 0 1 1 0 7" />
        </svg>
      ),
    },
  ];

  async function saveFinalInspection() {
    if (!isJobCompleted) {
      setToastMessage({ type: "error", text: "Complete the job before final inspection." });
      return;
    }
    if (approvedPartsFinalizationPending.length > 0) {
      setToastMessage({ type: "error", text: "Finalize all approved parts before final inspection." });
      return;
    }
    if (!Object.values(finalInspectionChecks).every(Boolean)) {
      setToastMessage({ type: "error", text: "Verify all final inspection checklist items." });
      return;
    }
    if (
      !finalInspectionCarPhotos.front.trim() ||
      !finalInspectionCarPhotos.rear.trim() ||
      !finalInspectionCarPhotos.right.trim() ||
      !finalInspectionCarPhotos.left.trim()
    ) {
      setToastMessage({ type: "error", text: "Upload front, rear, right and left car photos." });
      return;
    }
    if (!isFinalInspectionPartDecisionDone) {
      setToastMessage({ type: "error", text: "Select Verify/Re-Work status for all approved parts." });
      return;
    }
    if (finalInspectionReworkLineItemIds.length > 0 && !finalInspectionReworkNote.trim()) {
      setToastMessage({ type: "error", text: "Add rework note before reopening." });
      return;
    }
    setIsSavingFinalInspection(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "final_inspection",
          checks: finalInspectionChecks,
          finalInspectionCarPhotos,
          finalInspectionRemarks: finalInspectionRemarks.trim() || null,
          finalInspectionPartStatuses: finalInspectionPartStatusByItemId,
          reworkRequired: finalInspectionReworkLineItemIds.length > 0,
          reworkNote: finalInspectionReworkNote.trim() || null,
          reworkLineItemIds: finalInspectionReworkLineItemIds,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save final inspection.");
      }
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: {
              ...prev.data.jobCard,
              final_inspection_test_drive:
                json?.data?.final_inspection_test_drive ?? finalInspectionChecks.testDrive,
              final_inspection_cluster_warning:
                json?.data?.final_inspection_cluster_warning ?? finalInspectionChecks.clusterWarning,
              final_inspection_car_wash: false,
              final_inspection_tyre_check:
                json?.data?.final_inspection_tyre_check ?? finalInspectionChecks.tyreCheck,
              final_inspection_computer_reset:
                json?.data?.final_inspection_computer_reset ?? finalInspectionChecks.computerReset,
              final_inspection_protective_shields:
                json?.data?.final_inspection_protective_shields ?? finalInspectionChecks.protectiveShields,
              final_inspection_car_out_video_id: null,
              final_inspection_remarks:
                json?.data?.final_inspection_remarks ?? (finalInspectionRemarks.trim() || null),
              final_inspection_at:
                json?.data?.reopened_for_rework
                  ? null
                  : json?.data?.final_inspection_at ?? new Date().toISOString(),
              complete_at:
                json?.data?.reopened_for_rework
                  ? null
                  : prev.data.jobCard?.complete_at ?? null,
              status:
                json?.data?.reopened_for_rework
                  ? "Pending"
                  : prev.data.jobCard?.status ?? "Completed",
            },
          },
        };
      });
      setToastMessage({
        type: "success",
        text: json?.data?.reopened_for_rework
          ? "Rework flagged. Job card reopened."
          : "Final inspection saved.",
      });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to save final inspection." });
    } finally {
      setIsSavingFinalInspection(false);
    }
  }

  async function saveCarWashStage() {
    if (!isJobCompleted || !isFinalInspectionDone) {
      setToastMessage({ type: "error", text: "Complete job and final inspection before car wash." });
      return;
    }
    if (!isCarWashMediaDone) {
      setToastMessage({ type: "error", text: "Upload all car wash images and video." });
      return;
    }
    setIsSavingCarWash(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "car_wash",
          carWashMedia,
          carWashNotes: carWashNotes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save car wash stage.");
      }
      setState((prev) => {
        if (prev.status !== "loaded") return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            jobCard: {
              ...prev.data.jobCard,
              final_inspection_car_wash: true,
              updated_at: json?.data?.updated_at ?? new Date().toISOString(),
            },
          },
        };
      });
      setToastMessage({ type: "success", text: "Car wash stage completed." });
    } catch (err: any) {
      setToastMessage({ type: "error", text: err?.message ?? "Failed to save car wash stage." });
    } finally {
      setIsSavingCarWash(false);
    }
  }

  return (
    <MainPageShell
      title="Job Card"
      subtitle=""
      scopeLabel=""
      contentClassName="p-0"
    >
      {toastMessage && (
        <div className="fixed right-6 top-6 z-50">
          <div
            className={`rounded-md px-4 py-2 text-xs font-semibold text-white shadow-lg ${
              toastMessage.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}
      {state.status === "loading" && (
        <div className="p-4 text-sm text-muted-foreground">Loading job card...</div>
      )}
      {state.status === "error" && (
        <div className="p-4 text-sm text-destructive">{state.error}</div>
      )}
      {state.status === "loaded" && jobCard && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
            <div
              className={`flex items-center justify-between rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
            >
              <span>Job Details</span>
              <span className="text-base leading-none">-</span>
            </div>
            <div className="space-y-4 p-4 text-sm">
              <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Job Progress
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-7">
                  {progressSteps.map((step, idx) => (
                    <button
                      type="button"
                      key={step.key}
                      onClick={() => setActiveWizardStep(step.key)}
                      className={`rounded-md border px-2 py-2 text-[11px] ${
                        activeWizardStep === step.key
                          ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                          : step.done
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : idx === currentProgressIndex
                          ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                          : "border-white/10 bg-white/[0.02] text-white/70"
                      } text-left transition hover:border-cyan-400/50 hover:text-cyan-100`}
                    >
                      <div className="font-semibold">{step.label}</div>
                      <div className="mt-0.5 text-[10px] uppercase">{step.done ? "Done" : "Pending"}</div>
                    </button>
                  ))}
                </div>
              </div>
              {(isQuoteStep || isPreWorkStep || isCompleteStep || isFinalInspectionStep) && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">Customer Complain</div>
                    <textarea
                      className={`${theme.input} h-24 resize-none`}
                      value={jobCard?.customer_remark ?? ""}
                      readOnly
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">Inspector Remarks</div>
                    <textarea
                      className={`${theme.input} h-24 resize-none`}
                      value={jobCard?.inspector_remark ?? ""}
                      readOnly
                    />
                  </div>
                </div>
              )}
              {isQuoteStep && (
              <div className="space-y-1">
                <div className="text-xs font-semibold">Quote Remarks</div>
                <div className="grid gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 md:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-cyan-200/80">Quoted Amount</div>
                    <div className="mt-1 text-sm font-semibold text-cyan-100">{quoteSummary.amount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-cyan-200/80">ETA</div>
                    <div className="mt-1 text-sm font-semibold text-cyan-100">{quoteSummary.eta}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-cyan-200/80">Notes</div>
                    <div className="mt-1 text-sm font-semibold text-cyan-100">{quoteSummary.notes || "N/A"}</div>
                  </div>
                </div>
              </div>
              )}
              {isCollectCarStep && (
              <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">Collect Car</div>
                {carMediaCounts.total > 0 && (
                  <div className="rounded-md border border-white/10 bg-black/20 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold text-white/80">
                        Car Media Verification (Front/Rear/Right/Left + 360 Video)
                      </div>
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
                      {carMediaKeys
                        .filter((key) => Boolean(collectCarSourceMedia[key]))
                        .map((key) => {
                          const fileId = collectCarSourceMedia[key];
                          const label = key === "video" ? "360 Video" : `${key[0]?.toUpperCase()}${key.slice(1)} Image`;
                          const reviewStatus = carMediaReview[key];
                          const replacementId = carMediaReplacement[key];
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
                                  {reviewStatus === "verified" ? (
                                    <button
                                      type="button"
                                      className="rounded-md border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                                      onClick={() => setCarMediaReview((prev) => ({ ...prev, [key]: "pending" }))}
                                    >
                                      Reopen
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                                        onClick={() =>
                                          setCarMediaReview((prev) => ({ ...prev, [key]: "verified" }))
                                        }
                                      >
                                        Verify
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                                        onClick={() => {
                                          setCarMediaReview((prev) => ({ ...prev, [key]: "rejected" }));
                                          setToastMessage({
                                            type: "error",
                                            text: "Rejected media requires replacement upload.",
                                          });
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              {reviewStatus === "rejected" && (
                                <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 p-2">
                                  <div className="text-[11px] text-rose-200">Upload new media (old media is kept)</div>
                                  <textarea
                                    className={`${theme.input} mt-2`}
                                    rows={2}
                                    placeholder="Add short reject note..."
                                    value={carMediaRejectNote[key]}
                                    onChange={(e) =>
                                      setCarMediaRejectNote((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                  />
                                  <div className="mt-2">
                                    <FileUploader
                                      label=""
                                      kind={key === "video" ? "video" : "image"}
                                      value={replacementId}
                                      onChange={(id) =>
                                        setCarMediaReplacement((prev) => ({
                                          ...prev,
                                          [key]: String(id ?? ""),
                                        }))
                                      }
                                      buttonOnly
                                      showPreview
                                      buttonClassName="h-9"
                                    />
                                  </div>
                                  {replacementId && (
                                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                      <div className="rounded border border-white/10 bg-black/20 p-2">
                                        <div className="text-[10px] text-white/60">Current</div>
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
                                            alt={`Current ${label}`}
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
                                  {replacementId && (
                                    <div className="mt-2 flex items-center justify-end">
                                      <button
                                        type="button"
                                        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                                        onClick={() =>
                                          setCollectCarSourceMedia((prev) => ({
                                            ...prev,
                                            [key]: replacementId,
                                          }))
                                        }
                                      >
                                        Add To Current Media
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/70">
                    {isCollectCarDone
                      ? "Collect Car completed."
                      : "Verify/reject all car media and upload replacements for rejected items."}
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
                    onClick={saveCollectCarStage}
                    disabled={isSavingCollectCar}
                  >
                    {isSavingCollectCar ? "Saving..." : "Save Collect Car"}
                  </button>
                </div>
              </div>
              )}
              {isCollectCarStep && isCollectCarDone && (
                <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                    Required Parts Receiving
                  </div>
                  <div className="overflow-x-auto rounded-md border border-white/10">
                    <table className="min-w-full text-xs">
                      <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                        <tr>
                          <th className="px-2 py-1 text-left">#</th>
                          <th className="px-2 py-1 text-left">Part</th>
                          <th className="px-2 py-1 text-left">Qty</th>
                          <th className="px-2 py-1 text-left">Delivery Note</th>
                          <th className="px-2 py-1 text-left">Delivery Status</th>
                          <th className="px-2 py-1 text-left">Receive Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {primaryItems.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-3 text-xs text-muted-foreground">
                              No required parts found.
                            </td>
                          </tr>
                        ) : (
                          primaryItems.map((item, idx) => {
                            const itemId = String(item.id ?? "");
                            const currentStatus = normalizeReceiveStatus(item);
                            const selectedStatus = currentStatus === "Ordered" ? "" : currentStatus;
                            const isSavingStatus = Boolean(savingReceiveByItemId[itemId]);
                            return (
                              <tr key={item.id ?? idx} className="border-b border-border/60 last:border-0">
                                <td className="px-2 py-1">{idx + 1}</td>
                                <td className="px-2 py-1 font-semibold">
                                  {item.product_name ?? item.productName ?? "-"}
                                </td>
                                <td className="px-2 py-1">{item.quantity ?? 0}</td>
                                <td className="px-2 py-1">
                                  {String(item.delivery_note_no ?? "").trim() || "-"}
                                </td>
                                <td className="px-2 py-1">
                                  {String(item.delivery_note_status ?? "").trim() || "-"}
                                </td>
                                <td className="px-2 py-1">
                                  <select
                                    className={`${theme.input} h-8 min-w-[170px]`}
                                    value={selectedStatus}
                                    onChange={(e) =>
                                      updateItemReceiveStatus(
                                        itemId,
                                        e.target.value as
                                          | "Received"
                                          | "Returned"
                                          | "Partially Received"
                                      )
                                    }
                                    disabled={isSavingStatus}
                                  >
                                    <option value="" disabled>
                                      Select status
                                    </option>
                                    <option value="Received">Received</option>
                                    <option value="Returned">Return</option>
                                    <option value="Partially Received">Partially Received</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {isPreWorkStep && (
              <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Pre-Work Check</div>
                <div className="rounded-md border border-white/10 bg-black/20 p-2">
                  <div className="mb-2 text-[11px] font-semibold text-white/80">Car VIN Section (Fetched data)</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-[11px] text-white/70">VIN</div>
                      <input
                        className={`${theme.input} h-9`}
                        value={preCheckVin}
                        onChange={(e) => setPreCheckVin(e.target.value)}
                        placeholder="Enter VIN"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-white/70">Plate</div>
                      <input
                        className={`${theme.input} h-9`}
                        value={preCheckPlate}
                        onChange={(e) => setPreCheckPlate(e.target.value)}
                        placeholder="Enter plate"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-white/70">Year</div>
                      <input
                        type="number"
                        min="1900"
                        max="3000"
                        className={`${theme.input} h-9`}
                        value={preCheckYear}
                        onChange={(e) => setPreCheckYear(e.target.value)}
                        placeholder="Enter year"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-white/70">Make</div>
                      <input
                        className={`${theme.input} h-9`}
                        value={preCheckMake}
                        onChange={(e) => setPreCheckMake(e.target.value)}
                        placeholder="Enter make"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] text-white/70">Model</div>
                      <input
                        className={`${theme.input} h-9`}
                        value={preCheckModel}
                        onChange={(e) => setPreCheckModel(e.target.value)}
                        placeholder="Enter model"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-white/80">Car Mileage</div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${theme.input} h-9`}
                    value={collectCarMileage}
                    onChange={(e) => setCollectCarMileage(e.target.value)}
                    placeholder="Enter mileage"
                  />
                </div>
                <textarea
                  className={`${theme.input} h-20 resize-none`}
                  value={preWorkNote}
                  onChange={(e) => setPreWorkNote(e.target.value)}
                  placeholder="Optional pre-work note (parts checklist, risk notes, etc.)"
                />
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/70">
                    {isPreWorkDone
                      ? `Completed at ${new Date(jobCard?.pre_work_checked_at).toLocaleString()}`
                      : "Requires Collect Car completed and all parts received."}
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
                    onClick={savePreWorkCheck}
                    disabled={isSavingPreWork || isPreWorkDone}
                  >
                    {isSavingPreWork ? "Saving..." : isPreWorkDone ? "Checked" : "Complete Pre-Work"}
                  </button>
                </div>
              </div>
              )}
              {isPartsReceiveStep && (
                <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">Parts Receive</div>
                  <div className="text-[11px] text-white/70">
                    Confirm receiving status for required parts from delivery notes before starting the job.
                  </div>
                  <div className="text-[11px] text-white/70">
                    Minimum requirement to proceed: <span className="font-semibold text-white">at least one part received</span>.
                  </div>
                </div>
              )}
              {isCompleteStep && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">Job Remarks</div>
                    <textarea
                      className={`${theme.input} h-20 resize-none`}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add remarks before completing the job"
                    />
                  </div>
                  <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                      Completion Evidence (Mandatory)
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-[11px] text-white/70">Engine Image</div>
                        <FileUploader
                          label=""
                          kind="image"
                          value={completionEngineImageId}
                          onChange={(id) => setCompletionEngineImageId(id ?? "")}
                          buttonOnly
                          showPreview
                          buttonClassName="h-8 px-3 text-[10px]"
                          containerClassName="w-fit"
                          previewClassName="h-[120px] w-[120px]"
                          chooseLabel="Upload Engine Image"
                          replaceLabel="Replace Engine Image"
                        />
                      </div>
                      <div>
                        <div className="mb-1 text-[11px] text-white/70">Bottom Image</div>
                        <FileUploader
                          label=""
                          kind="image"
                          value={completionBottomImageId}
                          onChange={(id) => setCompletionBottomImageId(id ?? "")}
                          buttonOnly
                          showPreview
                          buttonClassName="h-8 px-3 text-[10px]"
                          containerClassName="w-fit"
                          previewClassName="h-[120px] w-[120px]"
                          chooseLabel="Upload Bottom Image"
                          replaceLabel="Replace Bottom Image"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-white/70">
                        Save engine and bottom images before completion.
                      </div>
                      <button
                        type="button"
                        className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
                        onClick={saveCompletionEvidence}
                        disabled={isSavingCompletionEvidence}
                      >
                        {isSavingCompletionEvidence ? "Saving..." : "Save Evidence"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isFinalInspectionStep && (
                <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">Final Inspection</div>
                  <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-white/75">
                    1) Verify all approved parts are finalized. 2) Upload final car photos and notes.
                    3) Complete checklist. 4) If rework is needed, reopen job card.
                  </div>
                  <div className="grid gap-2 text-[11px] md:grid-cols-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={finalInspectionChecks.testDrive}
                        onChange={(e) =>
                          setFinalInspectionChecks((prev) => ({ ...prev, testDrive: e.target.checked }))
                        }
                      />
                      <span>Test Drive</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={finalInspectionChecks.clusterWarning}
                        onChange={(e) =>
                          setFinalInspectionChecks((prev) => ({
                            ...prev,
                            clusterWarning: e.target.checked,
                          }))
                        }
                      />
                      <span>Cluster Warning</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={finalInspectionChecks.tyreCheck}
                        onChange={(e) =>
                          setFinalInspectionChecks((prev) => ({ ...prev, tyreCheck: e.target.checked }))
                        }
                      />
                      <span>Tyre Check</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={finalInspectionChecks.computerReset}
                        onChange={(e) =>
                          setFinalInspectionChecks((prev) => ({
                            ...prev,
                            computerReset: e.target.checked,
                          }))
                        }
                      />
                      <span>Computer Reset</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={finalInspectionChecks.protectiveShields}
                        onChange={(e) =>
                          setFinalInspectionChecks((prev) => ({
                            ...prev,
                            protectiveShields: e.target.checked,
                          }))
                        }
                      />
                      <span>Protective Shields</span>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Front Photo</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={finalInspectionCarPhotos.front}
                        onChange={(id) =>
                          setFinalInspectionCarPhotos((prev) => ({ ...prev, front: id ?? "" }))
                        }
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Front"
                        replaceLabel="Replace Front"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Rear Photo</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={finalInspectionCarPhotos.rear}
                        onChange={(id) =>
                          setFinalInspectionCarPhotos((prev) => ({ ...prev, rear: id ?? "" }))
                        }
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Rear"
                        replaceLabel="Replace Rear"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Right Photo</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={finalInspectionCarPhotos.right}
                        onChange={(id) =>
                          setFinalInspectionCarPhotos((prev) => ({ ...prev, right: id ?? "" }))
                        }
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Right"
                        replaceLabel="Replace Right"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Left Photo</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={finalInspectionCarPhotos.left}
                        onChange={(id) =>
                          setFinalInspectionCarPhotos((prev) => ({ ...prev, left: id ?? "" }))
                        }
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Left"
                        replaceLabel="Replace Left"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-white/80">Final Notes (optional)</div>
                    <textarea
                      className={`${theme.input} h-20 resize-none`}
                      value={finalInspectionRemarks}
                      onChange={(e) => setFinalInspectionRemarks(e.target.value)}
                      placeholder="Example: oil marks under vehicle, paint marks need wash/polish..."
                    />
                  </div>
                  <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="text-[11px] text-amber-200">
                      Rework is controlled from the parts table column <span className="font-semibold">Verify / Re-Work</span>.
                      If any part is marked Re-Work, job card will be reopened after save.
                    </div>
                    {finalInspectionReworkLineItemIds.length > 0 ? (
                      <textarea
                        className={`${theme.input} h-20 resize-none`}
                        value={finalInspectionReworkNote}
                        onChange={(e) => setFinalInspectionReworkNote(e.target.value)}
                        placeholder="Mandatory for rework: explain what needs rework and why."
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-white/70">
                      {isFinalInspectionDone
                        ? `Completed at ${new Date(jobCard?.final_inspection_at).toLocaleString()}`
                        : "All checklist items and final car photos are required."}
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
                      onClick={saveFinalInspection}
                      disabled={isSavingFinalInspection || isFinalInspectionDone || !canSaveFinalInspectionNow}
                    >
                      {isSavingFinalInspection
                        ? "Saving..."
                        : isFinalInspectionDone
                        ? "Final Inspection Done"
                        : "Save Final Inspection"}
                    </button>
                  </div>
                </div>
              )}
              {isCarWashStep && (
                <div className="space-y-3 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Car Wash</div>
                  <div className="rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-[11px] text-white/75">
                    Upload post-wash car images and video. This stage is mandatory to finish workshop flow.
                  </div>
                  <div className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
                    <div className="text-[11px] font-semibold text-white/80">Reference Car Media</div>
                    <div className="grid gap-2 md:grid-cols-5">
                      {(["front", "rear", "right", "left"] as const).map((key) => {
                        const fileId = finalInspectionCarPhotos[key] || collectCarSourceMedia[key];
                        return (
                          <div key={`reference-${key}`} className="rounded border border-white/10 p-1">
                            <div className="mb-1 text-[10px] uppercase text-white/60">{key}</div>
                            {fileId ? (
                              <img
                                className="h-20 w-full rounded object-cover"
                                src={`/api/files/${fileId}`}
                                alt={`Reference ${key}`}
                              />
                            ) : (
                              <div className="h-20 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                            )}
                          </div>
                        );
                      })}
                      <div className="rounded border border-white/10 p-1 md:col-span-1">
                        <div className="mb-1 text-[10px] uppercase text-white/60">video</div>
                        {collectCarSourceMedia.video ? (
                          <video
                            className="h-20 w-full rounded object-cover"
                            src={`/api/files/${collectCarSourceMedia.video}`}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="h-20 rounded border border-dashed border-white/10 bg-white/[0.02]" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Wash Front Image</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={carWashMedia.front}
                        onChange={(id) => setCarWashMedia((prev) => ({ ...prev, front: id ?? "" }))}
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Front"
                        replaceLabel="Replace Front"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Wash Rear Image</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={carWashMedia.rear}
                        onChange={(id) => setCarWashMedia((prev) => ({ ...prev, rear: id ?? "" }))}
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Rear"
                        replaceLabel="Replace Rear"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Wash Right Image</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={carWashMedia.right}
                        onChange={(id) => setCarWashMedia((prev) => ({ ...prev, right: id ?? "" }))}
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Right"
                        replaceLabel="Replace Right"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] text-white/70">Wash Left Image</div>
                      <FileUploader
                        label=""
                        kind="image"
                        value={carWashMedia.left}
                        onChange={(id) => setCarWashMedia((prev) => ({ ...prev, left: id ?? "" }))}
                        buttonOnly
                        showPreview
                        buttonClassName="h-8 px-3 text-[10px]"
                        containerClassName="w-fit"
                        previewClassName="h-[120px] w-[120px]"
                        chooseLabel="Upload Left"
                        replaceLabel="Replace Left"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-white/80">Car Wash Video</div>
                    <FileUploader
                      label=""
                      kind="video"
                      value={carWashMedia.video}
                      onChange={(id) => setCarWashMedia((prev) => ({ ...prev, video: id ?? "" }))}
                      buttonOnly
                      showPreview
                      buttonClassName="h-8 px-3 text-[10px]"
                      containerClassName="w-fit"
                      previewClassName="h-[120px] w-[180px]"
                      chooseLabel="Upload Wash Video"
                      replaceLabel="Replace Wash Video"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-white/80">Car Wash Notes (optional)</div>
                    <textarea
                      className={`${theme.input} h-20 resize-none`}
                      value={carWashNotes}
                      onChange={(e) => setCarWashNotes(e.target.value)}
                      placeholder="Optional note after wash."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-white/70">
                      {isCarWashDone ? "Car wash stage completed." : "All images + video are mandatory."}
                    </div>
                    <button
                      type="button"
                      className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-60"
                      onClick={saveCarWashStage}
                      disabled={isSavingCarWash || isCarWashDone || !canSaveCarWashNow}
                    >
                      {isSavingCarWash ? "Saving..." : isCarWashDone ? "Car Wash Done" : "Complete Car Wash"}
                    </button>
                  </div>
                </div>
              )}
              {(isStartStep || isCompleteStep || isFinalInspectionStep || isCarWashStep) && (
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="space-y-1 lg:col-span-2">
                    <div className="text-xs font-semibold">Lead Advisor</div>
                    <input className={`${theme.input} h-9`} value={jobCard?.branch_name ?? ""} readOnly />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">Job Start Time</div>
                    <input className={`${theme.input} h-9`} value={startAt} readOnly placeholder="Job Start Time" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold">Job Completed Time</div>
                    <input
                      className={`${theme.input} h-9`}
                      value={completeAt}
                      readOnly
                      placeholder="Job Completed Time"
                    />
                  </div>
                </div>
              )}
              {showPartsTable && (
              <div className={`overflow-x-auto rounded-md ${theme.cardBorder}`}>
                <table className="hidden min-w-full text-xs md:table">
                  <thead className={`${theme.surfaceSubtle} ${theme.appText}`}>
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Parts</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Quantity</th>
                      <th className="px-2 py-1 text-left">Order Status</th>
                      <th className="px-2 py-1 text-left">Part Pic</th>
                      {isCompleteStep ? <th className="px-2 py-1 text-left">Scrap Pic</th> : null}
                      <th className="px-2 py-1 text-left">Receive Status</th>
                      {isFinalInspectionStep ? <th className="px-2 py-1 text-left">Verify / Re-Work</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {primaryItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={
                            (isCompleteStep ? 9 : 8) + (isFinalInspectionStep ? 1 : 0)
                          }
                          className="px-3 py-3 text-xs text-muted-foreground"
                        >
                          No parts assigned yet.
                        </td>
                      </tr>
                    ) : (
                      primaryItems.map((item, idx) => {
                        const itemId = String(item.id ?? "");
                        const currentStatus = normalizeReceiveStatus(item);
                        const selectedStatus = currentStatus === "Ordered" ? "" : currentStatus;
                        const isSavingStatus = Boolean(savingReceiveByItemId[itemId]);
                        const isProcurementLinked = Boolean(item.procurement_linked);
                        const qtyInput = String(receiveQtyByItemId[itemId] ?? "");
                        const itemQty = Math.max(0, Number(item.quantity ?? 0));
                        const visibleStatusActions =
                          itemQty <= 1
                            ? statusActionMeta.filter((status) => status.value !== "Partially Received")
                            : statusActionMeta;
                        return (
                        <tr key={item.id ?? idx} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1">{idx + 1}</td>
                          <td className="px-2 py-1 font-semibold">{item.product_name ?? item.productName ?? "-"}</td>
                          <td className="px-2 py-1">{item.type ?? item.product_type ?? "-"}</td>
                          <td className="px-2 py-1">{item.description ?? "-"}</td>
                          <td className="px-2 py-1">{item.quantity ?? 0}</td>
                          <td className="px-2 py-1">
                            {(() => {
                              const partStatus = String(item.po_status ?? item.order_status ?? "Ordered");
                              const partStatusLower = partStatus.toLowerCase();
                              const isAdditionalPendingApproval =
                                Number(item.is_add ?? 0) === 1 && partStatusLower === "pending";
                              return (
                                <>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                                partStatusLower === "received"
                                  ? "bg-emerald-500 text-white"
                                  : partStatusLower === "returned"
                                  ? "bg-sky-500 text-white"
                                  : "bg-amber-400 text-slate-900"
                              }`}
                            >
                              {partStatus}
                            </span>
                            {!(item.part_pic ?? "") && (
                              <span className="ml-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-rose-300">
                                Required
                              </span>
                            )}
                            {isAdditionalPendingApproval && (
                              <span className="ml-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-sky-300">
                                Pending Customer Approval
                              </span>
                            )}
                                </>
                              );
                            })()}
                            <div className="mt-1 flex items-center gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                                  isProcurementLinked
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-rose-500/15 text-rose-300"
                                }`}
                              >
                                {isProcurementLinked ? "Linked To PO" : "Not Linked"}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <FileUploader
                              label=""
                              kind="image"
                              value={item.part_pic ?? ""}
                              onChange={(id) => updateItemPic(item.id, "partPic", id ?? null)}
                              buttonOnly
                              showPreview
                              buttonClassName="h-8 px-3 text-[10px]"
                              containerClassName="w-fit"
                              previewClassName="h-[100px] w-[100px]"
                              chooseLabel="Upload Part Photo"
                              replaceLabel="Replace Part Photo"
                            />
                            <div className="mt-1 text-[10px]">
                              {(item.part_pic ?? "") ? (
                                <span className="text-emerald-300">Done</span>
                              ) : (
                                <span className="text-amber-300">Missing</span>
                              )}
                            </div>
                          </td>
                          {isCompleteStep ? (
                            <td className="px-2 py-1">
                              <FileUploader
                                label=""
                                kind="image"
                                value={item.scrap_pic ?? ""}
                                onChange={(id) => updateItemPic(item.id, "scrapPic", id ?? null)}
                                buttonOnly
                                showPreview
                                buttonClassName="h-8 px-3 text-[10px]"
                                containerClassName="w-fit"
                                previewClassName="h-[100px] w-[100px]"
                                chooseLabel="Upload Scrap Photo"
                                replaceLabel="Replace Scrap Photo"
                              />
                              <div className="mt-1 text-[10px]">
                                {(item.scrap_pic ?? "") ? (
                                  <span className="text-emerald-300">Done</span>
                                ) : (
                                  <span className="text-amber-300">Missing</span>
                                )}
                              </div>
                            </td>
                          ) : null}
                          <td className="px-2 py-1">
                            {isPartsReceiveStep && Number(item.is_add ?? 0) !== 1 ? (
                              <div className="min-w-[230px] space-y-1">
                                <div className={`grid gap-1 ${visibleStatusActions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                                  {visibleStatusActions.map((status) => {
                                    const isActive = selectedStatus === status.value;
                                    return (
                                      <button
                                        key={status.value}
                                        type="button"
                                        className={`h-8 rounded-md border px-2 text-[10px] font-semibold transition ${
                                          isActive
                                            ? status.activeClass
                                            : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                        }`}
                                        onClick={() =>
                                          handleReceiveStatusClick(
                                            itemId,
                                            status.value,
                                            qtyInput,
                                            isProcurementLinked
                                          )
                                        }
                                        disabled={isSavingStatus}
                                      >
                                        <span className="flex items-center justify-center gap-1">
                                          {status.icon}
                                          <span>{status.label}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  className={`${theme.input} h-8 w-full text-[10px]`}
                                  value={qtyInput}
                                  onChange={(e) =>
                                    setReceiveQtyByItemId((prev) => ({
                                      ...prev,
                                      [itemId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Qty for Partial/Return"
                                  disabled={isSavingStatus || !isProcurementLinked}
                                />
                                {!isProcurementLinked ? (
                                  <div className="text-[10px] text-rose-300">
                                    Link this part to procurement PO first.
                                  </div>
                                ) : null}
                                {isSavingStatus ? (
                                  <div className="text-[10px] text-cyan-300">Saving status...</div>
                                ) : null}
                                <div className="grid grid-cols-3 gap-1 text-[10px]">
                                  <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                    <div className="text-white/50">GRN</div>
                                    <div className="truncate text-white/90">
                                      {String(item.procurement_latest_grn_number ?? "-")}
                                    </div>
                                  </div>
                                  <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                    <div className="text-white/50">Inventory</div>
                                    <div
                                      className={
                                        item.procurement_inventory_moved
                                          ? "text-emerald-300"
                                          : "text-amber-300"
                                      }
                                    >
                                      {item.procurement_inventory_moved ? "Moved" : "Pending"}
                                    </div>
                                  </div>
                                  <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                    <div className="text-white/50">Accounting</div>
                                    <div
                                      className={
                                        item.procurement_accounting_posted
                                          ? "text-emerald-300"
                                          : "text-amber-300"
                                      }
                                    >
                                      {item.procurement_accounting_posted ? "Posted" : "Pending"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-white/70">{currentStatus}</span>
                            )}
                          </td>
                          {isFinalInspectionStep ? (
                            <td className="px-2 py-1">
                              {finalInspectionRequiredItemIds.includes(itemId) ? (
                                <div className="min-w-[210px] space-y-1">
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      type="button"
                                      className={`h-8 rounded-md border px-2 text-[10px] font-semibold transition ${
                                        finalInspectionPartStatusByItemId[itemId] === "verified"
                                          ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                                          : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                      }`}
                                      onClick={() =>
                                        setFinalInspectionPartStatusByItemId((prev) => ({
                                          ...prev,
                                          [itemId]:
                                            prev[itemId] === "verified" ? "" : "verified",
                                        }))
                                      }
                                    >
                                      Verify
                                    </button>
                                    <button
                                      type="button"
                                      className={`h-8 rounded-md border px-2 text-[10px] font-semibold transition ${
                                        finalInspectionPartStatusByItemId[itemId] === "rework"
                                          ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                                          : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                      }`}
                                      onClick={() =>
                                        setFinalInspectionPartStatusByItemId((prev) => ({
                                          ...prev,
                                          [itemId]:
                                            prev[itemId] === "rework" ? "" : "rework",
                                        }))
                                      }
                                    >
                                      Re-Work
                                    </button>
                                  </div>
                                  {!finalInspectionPartStatusByItemId[itemId] ? (
                                    <div className="text-[10px] text-amber-300">Mandatory</div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-[10px] text-white/45">-</span>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                      })
                    )}
                  </tbody>
                  {primaryItems.length > 0 ? (
                    <tfoot>
                      <tr className="border-t border-border/70 bg-white/[0.02] text-[10px]">
                        <td colSpan={3} className="px-2 py-2 font-semibold text-white/85">
                          Totals
                        </td>
                        <td className="px-2 py-2 text-white/80">Items: {primaryItems.length}</td>
                        <td className="px-2 py-2 text-white/80">
                          Qty: {primaryItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)}
                        </td>
                        <td className="px-2 py-2 text-amber-300">Pending Uploads: {requiredUploadsPending}</td>
                        <td className="px-2 py-2 text-amber-300">Part Missing: {partPicMissingCount}</td>
                        {isCompleteStep ? (
                          <td className="px-2 py-2 text-amber-300">Scrap Missing: {scrapPicMissingCount}</td>
                        ) : null}
                        <td className="px-2 py-2 text-white/60">Receive status per line item</td>
                        {isFinalInspectionStep ? (
                          <td className="px-2 py-2 text-amber-300">
                            Pending decision:{" "}
                            {Math.max(
                              0,
                              finalInspectionRequiredItemIds.filter(
                                (itemId) => !finalInspectionPartStatusByItemId[itemId]
                              ).length
                            )}
                          </td>
                        ) : null}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
                <div className="space-y-2 p-2 md:hidden">
                  {primaryItems.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-muted-foreground">
                      No parts assigned yet.
                    </div>
                  ) : (
                    primaryItems.map((item, idx) => {
                      const itemId = String(item.id ?? "");
                      const currentStatus = normalizeReceiveStatus(item);
                      const selectedStatus = currentStatus === "Ordered" ? "" : currentStatus;
                      const isSavingStatus = Boolean(savingReceiveByItemId[itemId]);
                      const isProcurementLinked = Boolean(item.procurement_linked);
                      const qtyInput = String(receiveQtyByItemId[itemId] ?? "");
                      const itemQty = Math.max(0, Number(item.quantity ?? 0));
                      const visibleStatusActions =
                        itemQty <= 1
                          ? statusActionMeta.filter((status) => status.value !== "Partially Received")
                          : statusActionMeta;
                      return (
                      <div key={item.id ?? idx} className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="font-semibold">{item.product_name ?? item.productName ?? "-"}</div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                              String(item.po_status ?? item.order_status ?? "Ordered").toLowerCase() === "received"
                                ? "bg-emerald-500 text-white"
                                : String(item.po_status ?? item.order_status ?? "Ordered").toLowerCase() === "returned"
                                ? "bg-sky-500 text-white"
                                : "bg-amber-400 text-slate-900"
                            }`}
                          >
                            {String(item.po_status ?? item.order_status ?? "Ordered")}
                          </span>
                        </div>
                        <div className="mb-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                              isProcurementLinked
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            {isProcurementLinked ? "Linked To PO" : "Not Linked"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <div className="text-white/60">Qty</div>
                            <div>{item.quantity ?? 0}</div>
                          </div>
                          <div>
                            <div className="text-white/60">Type</div>
                            <div>{item.type ?? item.product_type ?? "-"}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-white/60">Description</div>
                            <div>{item.description ?? "-"}</div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {isPartsReceiveStep && Number(item.is_add ?? 0) !== 1 && (
                            <div>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                                Receive Status
                              </div>
                              <div className={`grid gap-1 ${visibleStatusActions.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                                {visibleStatusActions.map((status) => {
                                  const isActive = selectedStatus === status.value;
                                  return (
                                    <button
                                      key={status.value}
                                      type="button"
                                      className={`h-9 rounded-md border px-2 text-[10px] font-semibold transition ${
                                        isActive
                                          ? status.activeClass
                                          : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                      }`}
                                      onClick={() =>
                                        handleReceiveStatusClick(
                                          itemId,
                                          status.value,
                                          qtyInput,
                                          isProcurementLinked
                                        )
                                      }
                                      disabled={isSavingStatus}
                                    >
                                      <span className="flex items-center justify-center gap-1">
                                        {status.icon}
                                        <span>{status.label}</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className={`${theme.input} mt-2 h-9 w-full text-[11px]`}
                                value={qtyInput}
                                onChange={(e) =>
                                  setReceiveQtyByItemId((prev) => ({
                                    ...prev,
                                    [itemId]: e.target.value,
                                  }))
                                }
                                placeholder="Qty for Partial/Return"
                                disabled={isSavingStatus || !isProcurementLinked}
                              />
                              {!isProcurementLinked ? (
                                <div className="mt-1 text-[10px] text-rose-300">
                                  Link this part to procurement PO first.
                                </div>
                              ) : null}
                              {isSavingStatus ? (
                                <div className="mt-1 text-[10px] text-cyan-300">Saving status...</div>
                              ) : null}
                              <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                                <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                  <div className="text-white/50">GRN</div>
                                  <div className="truncate text-white/90">
                                    {String(item.procurement_latest_grn_number ?? "-")}
                                  </div>
                                </div>
                                <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                  <div className="text-white/50">Inventory</div>
                                  <div
                                    className={
                                      item.procurement_inventory_moved
                                        ? "text-emerald-300"
                                        : "text-amber-300"
                                    }
                                  >
                                    {item.procurement_inventory_moved ? "Moved" : "Pending"}
                                  </div>
                                </div>
                                <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-1">
                                  <div className="text-white/50">Accounting</div>
                                  <div
                                    className={
                                      item.procurement_accounting_posted
                                        ? "text-emerald-300"
                                        : "text-amber-300"
                                    }
                                  >
                                    {item.procurement_accounting_posted ? "Posted" : "Pending"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {isFinalInspectionStep && finalInspectionRequiredItemIds.includes(itemId) && (
                            <div>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                                Verify / Re-Work
                              </div>
                              <div className="grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  className={`h-9 rounded-md border px-2 text-[10px] font-semibold transition ${
                                    finalInspectionPartStatusByItemId[itemId] === "verified"
                                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                  }`}
                                  onClick={() =>
                                    setFinalInspectionPartStatusByItemId((prev) => ({
                                      ...prev,
                                      [itemId]: prev[itemId] === "verified" ? "" : "verified",
                                    }))
                                  }
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  className={`h-9 rounded-md border px-2 text-[10px] font-semibold transition ${
                                    finalInspectionPartStatusByItemId[itemId] === "rework"
                                      ? "border-amber-400/60 bg-amber-500/20 text-amber-200"
                                      : "border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]"
                                  }`}
                                  onClick={() =>
                                    setFinalInspectionPartStatusByItemId((prev) => ({
                                      ...prev,
                                      [itemId]: prev[itemId] === "rework" ? "" : "rework",
                                    }))
                                  }
                                >
                                  Re-Work
                                </button>
                              </div>
                              {!finalInspectionPartStatusByItemId[itemId] ? (
                                <div className="mt-1 text-[10px] text-amber-300">Mandatory selection</div>
                              ) : null}
                            </div>
                          )}
                          <div>
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Part Pic</div>
                            <FileUploader
                              label=""
                              kind="image"
                              value={item.part_pic ?? ""}
                              onChange={(id) => updateItemPic(item.id, "partPic", id ?? null)}
                              buttonOnly
                              showPreview
                              buttonClassName="h-9 w-full px-3 text-[10px]"
                              containerClassName="w-full"
                              previewClassName="h-[100px] w-[100px]"
                              chooseLabel="Upload Part Photo"
                              replaceLabel="Replace Part Photo"
                            />
                            <div className="mt-1 text-[10px]">
                              {(item.part_pic ?? "") ? (
                                <span className="text-emerald-300">Done</span>
                              ) : (
                                <span className="text-amber-300">Missing</span>
                              )}
                            </div>
                          </div>
                          {isCompleteStep ? (
                            <div>
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Scrap Pic</div>
                              <FileUploader
                                label=""
                                kind="image"
                                value={item.scrap_pic ?? ""}
                                onChange={(id) => updateItemPic(item.id, "scrapPic", id ?? null)}
                                buttonOnly
                                showPreview
                                buttonClassName="h-9 w-full px-3 text-[10px]"
                                containerClassName="w-full"
                                previewClassName="h-[100px] w-[100px]"
                                chooseLabel="Upload Scrap Photo"
                                replaceLabel="Replace Scrap Photo"
                              />
                              <div className="mt-1 text-[10px]">
                                {(item.scrap_pic ?? "") ? (
                                  <span className="text-emerald-300">Done</span>
                                ) : (
                                  <span className="text-amber-300">Missing</span>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                    })
                  )}
                  {primaryItems.length > 0 ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span>Items</span>
                        <span>{primaryItems.length}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Total Qty</span>
                        <span>{primaryItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-amber-300">
                        <span>Pending Uploads</span>
                        <span>{requiredUploadsPending}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              )}
              <div className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-md border border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-[11px] text-white/80 md:text-left">
                  {unmetRequirementCount > 0
                    ? `${unmetRequirementCount} stage requirement${unmetRequirementCount > 1 ? "s" : ""} pending`
                    : isCarWashStep
                    ? isCarWashDone
                      ? "Car wash stage completed"
                      : "Upload wash images and wash video"
                    : isFinalInspectionStep
                    ? isFinalInspectionDone
                      ? "Final inspection completed"
                      : "Complete final inspection checklist and remarks"
                    : isCompleteStep
                    ? !hasCompletionEngineImage || !hasCompletionBottomImage
                      ? "Engine and bottom images are required"
                      : scrapPicMissingCount > 0
                      ? `${scrapPicMissingCount} scrap image${scrapPicMissingCount > 1 ? "s" : ""} pending`
                      : "Completion evidence ready"
                    : isEvidenceStep
                    ? requiredUploadsPending > 0
                    ? `${requiredUploadsPending} required upload${requiredUploadsPending > 1 ? "s" : ""} pending`
                    : "All required uploads completed"
                    : isStartStep
                    ? receivedRequiredUploadsPending > 0
                      ? `${receivedRequiredUploadsPending} upload${
                          receivedRequiredUploadsPending > 1 ? "s" : ""
                        } pending for received parts`
                      : "Ready-to-start checks"
                    : "Follow selected stage requirements"}
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
                {!isAssignedWorkshop ? (
                  <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-200">
                    Only assigned workshop can perform actions on this job card.
                  </div>
                ) : null}
                {isAssignedWorkshop && !canProgressByQuote && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Quote must be accepted before starting/completing this job card.
                  </div>
                )}
                {isStartStep && canProgressJobCard && !jobCard?.start_at && !jobCard?.complete_at && !atLeastOnePartReceived && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    At least one part must be received before starting the job card.
                  </div>
                )}
                {isStartStep && canProgressJobCard && !jobCard?.start_at && !jobCard?.complete_at && !isCollectCarDone && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Complete and save Collect Car stage before starting.
                  </div>
                )}
                {isStartStep && canProgressJobCard && !jobCard?.start_at && !jobCard?.complete_at && !isPreWorkDone && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Complete Pre-Work Check before starting the job.
                  </div>
                )}
                {isStartStep &&
                  canProgressJobCard &&
                  !jobCard?.start_at &&
                  !jobCard?.complete_at &&
                  !hasAllReceivedPartPictures && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Upload part pictures for all received parts before starting.
                  </div>
                )}
                {isStartStep &&
                  canProgressJobCard &&
                  !jobCard?.start_at &&
                  !jobCard?.complete_at &&
                  atLeastOnePartReceived &&
                  isCollectCarDone &&
                  isPreWorkDone &&
                  hasAllReceivedPartPictures && (
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-5 py-2 text-xs font-semibold text-white md:min-w-[130px]"
                    onClick={startJobCard}
                  >
                    Start Job
                  </button>
                )}
                {isCompleteStep &&
                  canProgressJobCard &&
                  jobCard?.start_at &&
                  !jobCard?.complete_at &&
                  !allRequiredPartsFullyReceived && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    All required parts must be fully received before completing the job.
                  </div>
                )}
                {isCompleteStep &&
                  canProgressJobCard &&
                  jobCard?.start_at &&
                  !jobCard?.complete_at &&
                  (!hasCompletionEngineImage || !hasCompletionBottomImage) && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Upload and save engine and bottom images before completing.
                  </div>
                )}
                {isCompleteStep &&
                  canProgressJobCard &&
                  jobCard?.start_at &&
                  !jobCard?.complete_at &&
                  scrapPicMissingCount > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    Upload scrap images for all parts before completing.
                  </div>
                )}
                {isCompleteStep && canProgressJobCard && jobCard?.start_at && !jobCard?.complete_at && (
                  <button
                    type="button"
                    className="rounded-md bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[130px]"
                    onClick={completeJobCard}
                    disabled={!allRequiredPartsFullyReceived || !hasCompletionEngineImage || !hasCompletionBottomImage || scrapPicMissingCount > 0}
                  >
                    Complete Job
                  </button>
                )}
                {isFinalInspectionStep &&
                  canProgressJobCard &&
                  jobCard?.complete_at &&
                  !jobCard?.final_inspection_at && (
                  <button
                    type="button"
                    className="rounded-md bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[160px]"
                    onClick={saveFinalInspection}
                    disabled={
                      isSavingFinalInspection || !canSaveFinalInspectionNow
                    }
                  >
                    {isSavingFinalInspection ? "Saving..." : "Save Final Inspection"}
                  </button>
                )}
                {isCarWashStep &&
                  canProgressJobCard &&
                  jobCard?.complete_at &&
                  jobCard?.final_inspection_at &&
                  !isCarWashDone && (
                  <button
                    type="button"
                    className="rounded-md bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[160px]"
                    onClick={saveCarWashStage}
                    disabled={isSavingCarWash || !canSaveCarWashNow}
                  >
                    {isSavingCarWash ? "Saving..." : "Complete Car Wash"}
                  </button>
                )}
                </div>
              </div>
            </div>
          </section>
          <div className="space-y-3">
            <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
              <div
                className={`rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
              >
                Customer Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Customer ID</div>
                  <div className="font-semibold text-sky-300">{jobCard?.customer_code ?? jobCard?.customer_id ?? "N/A"}</div>
                  <div className="text-white/70">Customer Name</div>
                  <div className="font-semibold">{jobCard?.customer_name ?? "N/A"}</div>
                  <div className="text-white/70">Customer Phone</div>
                  <div className="font-semibold">{jobCard?.customer_phone ?? "N/A"}</div>
                  <div className="text-white/70">Customer Type</div>
                  <div className="font-semibold">{jobCard?.customer_type ?? "Regular"}</div>
                </div>
              </div>
            </section>
            <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
              <div
                className={`rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
              >
                Car Details
              </div>
              <div className="p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-white/70">Plate #</div>
                  <div className="font-semibold">{jobCard?.plate_number ?? "N/A"}</div>
                  <div className="text-white/70">Car</div>
                  <div className="font-semibold">{carLabel || "N/A"}</div>
                  <div className="text-white/70">Type</div>
                  <div className="font-semibold">{jobCard?.body_type ?? "Regular"}</div>
                </div>
                <div className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                  {jobCard?.plate_number ?? "N/A"}
                </div>
              </div>
            </section>
            <section className={`rounded-md ${theme.cardBg} ${theme.cardBorder}`}>
              <div
                className={`rounded-t-md px-3 py-2 text-xs font-semibold ${theme.surfaceSubtle} ${theme.appText} border-b border-border/60`}
              >
                Additional Items
              </div>
              <div className="space-y-3 p-3 text-xs">
                <div className="space-y-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2">
                  <input
                    className={`${theme.input} h-9`}
                    value={additionalItemName}
                    onChange={(e) => setAdditionalItemName(e.target.value)}
                    placeholder="Search and select item name"
                    list="additional-item-options"
                  />
                  <datalist id="additional-item-options">
                    {productOptions.map((product) => (
                      <option key={String(product.id)} value={product.name}>
                        {product.name}
                        {product.type ? ` (${product.type})` : ""}
                      </option>
                    ))}
                  </datalist>
                  <select
                    className={`${theme.input} h-9`}
                    value={additionalItemMode}
                    onChange={(e) => setAdditionalItemMode(e.target.value)}
                  >
                    <option value="mandatory">Mandatory</option>
                    <option value="recommended">Recommended</option>
                  </select>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Item Image
                    </div>
                    <FileUploader
                      label=""
                      kind="image"
                      value={additionalItemImageId}
                      onChange={(id) => setAdditionalItemImageId(id ?? "")}
                      buttonOnly
                      showPreview
                      buttonClassName="h-8 px-3 text-[10px]"
                      containerClassName="w-fit"
                      previewClassName="h-[90px] w-[90px]"
                      chooseLabel="Upload Image"
                      replaceLabel="Replace Image"
                    />
                  </div>
                  <button
                    type="button"
                    className="w-full rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-60"
                    onClick={addAdditionalLineItem}
                    disabled={isSavingAdditionalItem}
                  >
                    {isSavingAdditionalItem ? "Adding..." : "Add Item"}
                  </button>
                </div>
                <div className="space-y-2">
                  {additionalItems.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-2 text-muted-foreground">
                      No additional items.
                    </div>
                  ) : (
                    additionalItems.map((item) => {
                      const approvalStatus = String(item.customer_approval_status ?? "pending").toLowerCase();
                      const mode = String(item.additional_item_mode ?? "recommended");
                      const imageId = String(item.additional_item_image_id ?? "").trim();
                      return (
                        <div key={item.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2">
                          <div className="font-semibold">{item.product_name ?? "-"}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-200">
                              {mode}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                approvalStatus === "approved"
                                  ? "bg-emerald-500/20 text-emerald-200"
                                  : approvalStatus === "rejected"
                                  ? "bg-rose-500/20 text-rose-200"
                                  : "bg-amber-500/20 text-amber-200"
                              }`}
                            >
                              {approvalStatus}
                            </span>
                          </div>
                          {imageId ? (
                            <a
                              href={`/api/files/${imageId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex rounded-md border border-white/15 bg-white/[0.04] p-1 hover:bg-white/[0.08]"
                            >
                              <img
                                src={`/api/files/${imageId}`}
                                alt="Additional item"
                                className="h-16 w-16 rounded object-cover"
                              />
                            </a>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
