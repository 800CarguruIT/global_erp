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
};

export function JobCardDetailMain({ companyId, jobCardId, workshopBranchId = null }: JobCardDetailMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<JobCardPayload>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [remarks, setRemarks] = useState("");
  const [collectCarVideoId, setCollectCarVideoId] = useState("");
  const [collectCarMileage, setCollectCarMileage] = useState("");
  const [collectCarMileageImageId, setCollectCarMileageImageId] = useState("");
  const [isSavingCollectCar, setIsSavingCollectCar] = useState(false);
  const [preWorkNote, setPreWorkNote] = useState("");
  const [isSavingPreWork, setIsSavingPreWork] = useState(false);
  const [activeWizardStep, setActiveWizardStep] = useState("quote");

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
          setCollectCarVideoId(String(card?.collect_car_video_id ?? ""));
          setCollectCarMileage(
            card?.collect_car_mileage != null ? String(card.collect_car_mileage) : ""
          );
          setCollectCarMileageImageId(String(card?.collect_car_mileage_image_id ?? ""));
          setPreWorkNote(String(card?.pre_work_note ?? ""));
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

  const jobCard = useMemo(() => (state.status === "loaded" ? state.data.jobCard : null), [state]);
  const items = useMemo(() => (state.status === "loaded" ? state.data.items ?? [] : []), [state]);

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
  const canProgressByQuote = workshopQuoteStatus === "accepted";
  const canProgressJobCard = canProgressByQuote && isAssignedWorkshop;
  const isPreWorkDone = Boolean(jobCard?.pre_work_checked_at);
  const isJobStarted = Boolean(jobCard?.start_at);
  const isJobCompleted = Boolean(jobCard?.complete_at);
  const isCollectCarDone = useMemo(() => {
    const mileage = Number(collectCarMileage);
    return (
      collectCarVideoId.trim().length > 0 &&
      Number.isFinite(mileage) &&
      mileage > 0 &&
      collectCarMileageImageId.trim().length > 0
    );
  }, [collectCarMileage, collectCarMileageImageId, collectCarVideoId]);
  const allPartsReceived = useMemo(() => {
    if (items.length === 0) return true;
    return items.every((item) =>
      String(item.po_status ?? item.order_status ?? "").toLowerCase() === "received"
    );
  }, [items]);
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
    () => items.filter((item) => !(item.part_pic ?? "")).length,
    [items]
  );
  const scrapPicMissingCount = useMemo(
    () => items.filter((item) => !(item.scrap_pic ?? "")).length,
    [items]
  );
  const requiredUploadsPending = partPicMissingCount + scrapPicMissingCount;
  const isEvidenceDone = partPicMissingCount === 0 && scrapPicMissingCount === 0 && items.length > 0;
  const isQuoteStep = activeWizardStep === "quote";
  const isCollectCarStep = activeWizardStep === "collect_car";
  const isPreWorkStep = activeWizardStep === "pre_work";
  const isStartStep = activeWizardStep === "start";
  const isEvidenceStep = activeWizardStep === "evidence";
  const isCompleteStep = activeWizardStep === "complete";
  const showPartsTable = isStartStep || isEvidenceStep || isCompleteStep;
  const progressSteps = useMemo(
    () => [
      { key: "quote", label: "Quote Accepted", done: canProgressByQuote },
      { key: "collect_car", label: "Collect Car", done: isCollectCarDone },
      { key: "pre_work", label: "Pre-Work Check", done: isPreWorkDone },
      { key: "start", label: "Start Job", done: isJobStarted },
      { key: "evidence", label: "Evidence Upload", done: isEvidenceDone },
      { key: "complete", label: "Completed", done: isJobCompleted },
    ],
    [
      canProgressByQuote,
      isCollectCarDone,
      isPreWorkDone,
      isJobStarted,
      isEvidenceDone,
      isJobCompleted,
    ]
  );
  const currentProgressIndex = useMemo(() => {
    const firstPending = progressSteps.findIndex((step) => !step.done);
    return firstPending === -1 ? progressSteps.length - 1 : firstPending;
  }, [progressSteps]);

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

  async function saveCollectCarStage() {
    const mileage = Number(collectCarMileage);
    if (!collectCarVideoId.trim()) {
      setToastMessage({ type: "error", text: "Collect car video is required." });
      return;
    }
    if (!Number.isFinite(mileage) || mileage <= 0) {
      setToastMessage({ type: "error", text: "Enter valid car mileage." });
      return;
    }
    if (!collectCarMileageImageId.trim()) {
      setToastMessage({ type: "error", text: "Mileage image is required." });
      return;
    }
    setIsSavingCollectCar(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect_car",
          collectCarVideoId: collectCarVideoId.trim(),
          collectCarMileage: mileage,
          collectCarMileageImageId: collectCarMileageImageId.trim(),
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
              collect_car_video_id: json?.data?.collect_car_video_id ?? collectCarVideoId.trim(),
              collect_car_mileage: json?.data?.collect_car_mileage ?? mileage,
              collect_car_mileage_image_id:
                json?.data?.collect_car_mileage_image_id ?? collectCarMileageImageId.trim(),
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
    if (!isCollectCarDone) {
      setToastMessage({ type: "error", text: "Complete Collect Car stage first." });
      return;
    }
    if (!allPartsReceived) {
      setToastMessage({ type: "error", text: "All parts must be received before Pre-Work Check." });
      return;
    }
    setIsSavingPreWork(true);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards/${jobCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pre_work_check",
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
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {progressSteps.map((step, idx) => (
                    <div
                      key={step.key}
                      className={`rounded-md border px-2 py-2 text-[11px] ${
                        step.done
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : idx === currentProgressIndex
                          ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
                          : "border-white/10 bg-white/[0.02] text-white/70"
                      }`}
                    >
                      <div className="font-semibold">{step.label}</div>
                      <div className="mt-0.5 text-[10px] uppercase">{step.done ? "Done" : "Pending"}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">Workflow Wizard</div>
                  <div className="text-[11px] text-white/70">
                    Step {Math.max(1, progressSteps.findIndex((s) => s.key === activeWizardStep) + 1)} / {progressSteps.length}
                  </div>
                </div>
                <div className="mb-3 text-sm font-semibold text-white">
                  {progressSteps.find((step) => step.key === activeWizardStep)?.label ?? "Step"}
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-white/80">
                  {activeWizardStep === "quote" && "Quote must be accepted before workflow can proceed."}
                  {activeWizardStep === "collect_car" &&
                    "Upload collect-car video, enter mileage, and upload mileage image, then save stage."}
                  {activeWizardStep === "pre_work" &&
                    "Confirm parts received and complete pre-work check. Optional note can be added."}
                  {activeWizardStep === "start" && "Start the job after pre-work check is done."}
                  {activeWizardStep === "evidence" &&
                    "Upload part and scrap photos for all spare part lines before completion."}
                  {activeWizardStep === "complete" && "Add remarks and complete job."}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 disabled:opacity-50"
                    disabled={progressSteps.findIndex((step) => step.key === activeWizardStep) <= 0}
                    onClick={() => {
                      const idx = progressSteps.findIndex((step) => step.key === activeWizardStep);
                      const prevStep = idx > 0 ? progressSteps[idx - 1] : null;
                      if (prevStep) setActiveWizardStep(prevStep.key);
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 disabled:opacity-50"
                    disabled={progressSteps.findIndex((step) => step.key === activeWizardStep) >= progressSteps.length - 1}
                    onClick={() => {
                      const idx = progressSteps.findIndex((step) => step.key === activeWizardStep);
                      const nextStep = idx < progressSteps.length - 1 ? progressSteps[idx + 1] : null;
                      if (nextStep) setActiveWizardStep(nextStep.key);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
              {(isQuoteStep || isPreWorkStep || isCompleteStep) && (
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
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-white/80">Collect Video</div>
                    <FileUploader
                      label=""
                      kind="video"
                      value={collectCarVideoId}
                      onChange={(id) => setCollectCarVideoId(id ?? "")}
                      buttonOnly
                      showPreview
                      buttonClassName="h-8 px-3 text-[10px]"
                      containerClassName="w-fit"
                      previewClassName="h-[100px] w-[140px]"
                      chooseLabel="Upload Video"
                      replaceLabel="Replace Video"
                    />
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
                  <div className="space-y-1">
                    <div className="text-[11px] font-semibold text-white/80">Mileage Image</div>
                    <FileUploader
                      label=""
                      kind="image"
                      value={collectCarMileageImageId}
                      onChange={(id) => setCollectCarMileageImageId(id ?? "")}
                      buttonOnly
                      showPreview
                      buttonClassName="h-8 px-3 text-[10px]"
                      containerClassName="w-fit"
                      previewClassName="h-[100px] w-[100px]"
                      chooseLabel="Upload Image"
                      replaceLabel="Replace Image"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-white/70">
                    {isCollectCarDone ? "Collect Car completed." : "Video, mileage and mileage image are required."}
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
              {isPreWorkStep && (
              <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Pre-Work Check</div>
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
              {isCompleteStep && (
              <div className="space-y-1">
                <div className="text-xs font-semibold">Job Remarks</div>
                <textarea
                  className={`${theme.input} h-20 resize-none`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks before completing the job"
                />
              </div>
              )}
              {(isStartStep || isCompleteStep) && (
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
                      <th className="px-2 py-1 text-left">Scrap Pic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-3 text-xs text-muted-foreground">
                          No parts assigned yet.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => (
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
                            {(!(item.part_pic ?? "") || !(item.scrap_pic ?? "")) && (
                              <span className="ml-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-rose-300">
                                Required
                              </span>
                            )}
                                </>
                              );
                            })()}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                  {items.length > 0 ? (
                    <tfoot>
                      <tr className="border-t border-border/70 bg-white/[0.02] text-[10px]">
                        <td colSpan={3} className="px-2 py-2 font-semibold text-white/85">
                          Totals
                        </td>
                        <td className="px-2 py-2 text-white/80">Items: {items.length}</td>
                        <td className="px-2 py-2 text-white/80">
                          Qty: {items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)}
                        </td>
                        <td className="px-2 py-2 text-amber-300">Pending Uploads: {requiredUploadsPending}</td>
                        <td className="px-2 py-2 text-amber-300">Part Missing: {partPicMissingCount}</td>
                        <td className="px-2 py-2 text-amber-300">Scrap Missing: {scrapPicMissingCount}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
                <div className="space-y-2 p-2 md:hidden">
                  {items.length === 0 ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-muted-foreground">
                      No parts assigned yet.
                    </div>
                  ) : (
                    items.map((item, idx) => (
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
                        </div>
                      </div>
                    ))
                  )}
                  {items.length > 0 ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span>Items</span>
                        <span>{items.length}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span>Total Qty</span>
                        <span>{items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)}</span>
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
                  {isEvidenceStep || isCompleteStep
                    ? requiredUploadsPending > 0
                    ? `${requiredUploadsPending} required upload${requiredUploadsPending > 1 ? "s" : ""} pending`
                    : "All required uploads completed"
                    : isStartStep
                    ? "Ready-to-start checks"
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
                {isStartStep && canProgressJobCard && !jobCard?.start_at && !jobCard?.complete_at && !allPartsReceived && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200">
                    All parts must be received before starting the job card.
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
                  allPartsReceived &&
                  isCollectCarDone &&
                  isPreWorkDone && (
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-5 py-2 text-xs font-semibold text-white md:min-w-[130px]"
                    onClick={startJobCard}
                  >
                    Start Job
                  </button>
                )}
                {isCompleteStep && canProgressJobCard && jobCard?.start_at && !jobCard?.complete_at && (
                  <button
                    type="button"
                    className="rounded-md bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900 md:min-w-[130px]"
                    onClick={completeJobCard}
                  >
                    Complete Job
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
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
