"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import { FileUploader } from "../components/FileUploader";

type JobCardDetailMainProps = {
  companyId: string;
  jobCardId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type JobCardPayload = {
  jobCard: any;
  items: any[];
};

export function JobCardDetailMain({ companyId, jobCardId }: JobCardDetailMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<JobCardPayload>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [remarks, setRemarks] = useState("");

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
          setRemarks(json.data?.jobCard?.remarks ?? "");
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

  const jobCard = state.status === "loaded" ? state.data.jobCard : null;
  const items = state.status === "loaded" ? state.data.items ?? [] : [];

  const carLabel = useMemo(() => {
    if (!jobCard) return "";
    return [jobCard.make, jobCard.model].filter(Boolean).join(" ");
  }, [jobCard]);

  const startAtRaw = jobCard?.start_at ?? null;
  const startAt = startAtRaw ? new Date(startAtRaw).toLocaleString() : "";
  const completeAt = jobCard?.complete_at ? new Date(jobCard.complete_at).toLocaleString() : "";

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
        <div className="p-4 text-sm text-muted-foreground">Loading job card…</div>
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
              <div className="space-y-1">
                <div className="text-xs font-semibold">Job Remarks</div>
                <textarea
                  className={`${theme.input} h-20 resize-none`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add remarks before completing the job"
                />
              </div>
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
              <div className={`overflow-x-auto rounded-md ${theme.cardBorder}`}>
                <table className="min-w-full text-xs">
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
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${
                                (item.order_status ?? "Ordered").toLowerCase() === "received"
                                  ? "bg-emerald-500 text-white"
                                  : (item.order_status ?? "Ordered").toLowerCase() === "returned"
                                  ? "bg-sky-500 text-white"
                                  : "bg-amber-400 text-slate-900"
                              }`}
                            >
                              {item.order_status ?? "Ordered"}
                            </span>
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
                            />
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
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2">
                {!jobCard?.start_at && !jobCard?.complete_at && (
                  <button
                    type="button"
                    className="rounded-md bg-sky-600 px-5 py-2 text-xs font-semibold text-white"
                    onClick={startJobCard}
                  >
                    Start Job
                  </button>
                )}
                {jobCard?.start_at && !jobCard?.complete_at && (
                  <button
                    type="button"
                    className="rounded-md bg-amber-400 px-5 py-2 text-xs font-semibold text-slate-900"
                    onClick={completeJobCard}
                  >
                    Complete Job
                  </button>
                )}
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
