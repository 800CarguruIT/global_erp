"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { MainPageShell } from "./MainPageShell";
import type { Lead } from "@repo/ai-core/crm/leads/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type StageFilter = { id: string; label: string; note?: string };

const RSA_STAGES: StageFilter[] = [
  { id: "assigned", label: "Assigned" },
  { id: "enroute", label: "Enroute" },
  { id: "inprocess", label: "In Process" },
  { id: "completed", label: "Completed", note: "After job is invoiced." },
  { id: "verified", label: "Verified", note: "Invoice paid + customer signature." },
];

const RECOVERY_STAGES: StageFilter[] = [
  { id: "assigned", label: "Assigned" },
  { id: "enroute", label: "Enroute" },
  { id: "inprocess", label: "In Process" },
  { id: "completed", label: "Completed", note: "After job is invoiced." },
  { id: "verified", label: "Verified", note: "Invoice paid + customer signature." },
];

const WORKSHOP_STAGES: StageFilter[] = [
  { id: "assigned", label: "Assigned" },
  { id: "checkin", label: "Check-in" },
  { id: "inspection", label: "Inspection" },
  { id: "workorder", label: "Work Order" },
  { id: "quality_check", label: "Quality Check" },
  { id: "completed", label: "Completed", note: "After car is invoiced." },
  { id: "checkout", label: "Check-out" },
  { id: "verified", label: "Verified", note: "Invoice paid + customer signature of car receiving." },
];

const WORKSHOP_SUBSETS: Record<
  "inspection" | "workorder" | "qc",
  { title: string; items: StageFilter[] }
> = {
  inspection: {
    title: "Inspection",
    items: [
      { id: "pending", label: "Pending" },
      { id: "inprocess", label: "In Process" },
      { id: "completed", label: "Completed" },
    ],
  },
  workorder: {
    title: "Work order",
    items: [
      { id: "parts_pending", label: "Parts Pending" },
      { id: "parts_ordered", label: "Parts Ordered" },
      { id: "parts_received", label: "Parts Received" },
      { id: "parts_issued", label: "Parts Issued" },
      { id: "work_pending", label: "Work Pending" },
      { id: "work_inprocess", label: "Work In Process" },
      { id: "work_completed", label: "Work Completed" },
    ],
  },
  qc: {
    title: "Quality check",
    items: [
      { id: "pending", label: "Pending" },
      { id: "inprocess", label: "In Process" },
      { id: "completed", label: "Completed" },
    ],
  },
};

type JobTypeTab = "rsa" | "recovery" | "workshop";

export function BranchJobsMain({
  companyId,
  branchId,
}: {
  companyId?: string | null;
  branchId?: string | null;
}) {
  const pathname = usePathname();
  const { effectiveCompanyId, effectiveBranchId } = useMemo(() => {
    const normalize = (v?: string | null) => {
      if (!v) return null;
      const t = `${v}`.trim();
      if (!t || t === "undefined" || t === "null") return null;
      return t;
    };
    const parsed = pathname?.match(/\/company\/([^/]+)\/branches\/([^/]+)/);
    const shortParsed = pathname?.match(/\/branches\/([^/]+)/);
    return {
      effectiveCompanyId: normalize(companyId) ?? normalize(parsed?.[1]),
      effectiveBranchId: normalize(branchId) ?? normalize(parsed?.[2] ?? shortParsed?.[1]),
    };
  }, [companyId, branchId, pathname]);

  const [state, setState] = useState<LoadState<Lead[]>>({ status: "loading", data: null, error: null });
  const [activeType, setActiveType] = useState<JobTypeTab>("rsa");
  const [stageFilter, setStageFilter] = useState<string | "all">("all");
  const [workshopSubFilter, setWorkshopSubFilter] = useState<string | "all">("all");
  const [requestedCustomer, setRequestedCustomer] = useState<Set<string>>(new Set());
  const [remarkLeadId, setRemarkLeadId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState<string>("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [carCheckLeadId, setCarCheckLeadId] = useState<string | null>(null);
  const [carCheckForm, setCarCheckForm] = useState({
    make: "",
    model: "",
    year: "",
    plate: "",
    vin: "",
    odometer: "",
    tireFront: "",
    tireRear: "",
    photoFront: "",
    photoBack: "",
    photoLeft: "",
    photoRight: "",
    video360: "",
    photoOdometer: "",
    photoVin: "",
  });
  const refresh = useCallback(() => {
    async function load() {
      if (!effectiveCompanyId) {
        setState({ status: "error", data: null, error: "Company is required to load jobs." });
        return;
      }
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${effectiveCompanyId}/sales/leads`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const leads: Lead[] = json.data ?? [];
        setState({ status: "loaded", data: leads, error: null });
        const requestedIds = new Set<string>(
          leads.filter((l: any) => (l as any).customerDetailsRequested).map((l) => l.id)
        );
        setRequestedCustomer(requestedIds);
      } catch (err) {
        console.error(err);
        setState({ status: "error", data: null, error: "Failed to load branch jobs." });
      }
    }
    load();
  }, [effectiveCompanyId]);

  useEffect(() => {
    let cancelled = false;
    refresh();
    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId, refresh]);

  const jobs = state.status === "loaded" ? state.data : [];
  const jobsForBranch =
    effectiveBranchId && jobs.length
      ? jobs.filter((j) => {
          const branchIdFromLead = (j as any).branchId ?? (j as any).branch_id ?? null;
          return branchIdFromLead === effectiveBranchId;
        })
      : jobs;
  const filteredByType = jobsForBranch.filter((j) => j.leadType === activeType);
  const filteredByBranch = filteredByType;

  const stageList = useMemo(() => {
    if (activeType === "rsa") return RSA_STAGES;
    if (activeType === "recovery") return RECOVERY_STAGES;
    return WORKSHOP_STAGES;
  }, [activeType]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stageList) counts[s.id] = 0;
    for (const job of filteredByBranch) {
      const key = (job.leadStage || "").toLowerCase();
      if (counts[key] !== undefined) counts[key] += 1;
    }
    return counts;
  }, [filteredByBranch, stageList]);

  const subStageCounts = useMemo(() => {
    if (activeType !== "workshop") return {};
    const counts: Record<string, number> = {};
    Object.values(WORKSHOP_SUBSETS).forEach((subset) =>
      subset.items.forEach((i) => {
        counts[i.id] = 0;
      })
    );
    for (const job of filteredByBranch) {
      const key = (job.leadStage || "").toLowerCase();
      if (counts[key] !== undefined) counts[key] += 1;
    }
    return counts;
  }, [filteredByBranch, activeType]);

  const visibleJobs = filteredByBranch.filter((job) => {
    const stageKey = (job.leadStage || "").toLowerCase();
    const matchesStage = stageFilter === "all" || stageKey === stageFilter;
    const matchesSub =
      activeType !== "workshop" || workshopSubFilter === "all" || stageKey === workshopSubFilter;
    return matchesStage && matchesSub;
  });

  return (
    <>
      <MainPageShell
        title="Branch Jobs"
        subtitle="Track RSA, Recovery, and Workshop jobs through their required stages."
        scopeLabel={effectiveBranchId ? `Branch: ${effectiveBranchId}` : "Branch workspace"}
      >
        <div className="space-y-4">
        <div className="flex flex-wrap gap-2 rounded-xl border bg-card/80 px-3 py-2 text-sm">
          {(["rsa", "recovery", "workshop"] as JobTypeTab[]).map((t) => {
            const count = jobsForBranch.filter((j) => j.leadType === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setActiveType(t);
                  setStageFilter("all");
                  setWorkshopSubFilter("all");
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  activeType === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {t === "rsa" ? "RSA" : t === "recovery" ? "Recovery" : "Workshop"} ({count})
              </button>
            );
          })}
        </div>

        <div className="space-y-2 rounded-xl border bg-card/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Stage</span>
            <button
              type="button"
              className={`rounded-full border px-3 py-1 text-xs ${
                stageFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
              onClick={() => setStageFilter("all")}
            >
              All ({filteredByBranch.length})
            </button>
            {stageList.map((stage) => (
              <button
                key={stage.id}
                type="button"
                className={`rounded-full border px-3 py-1 text-xs ${
                  stageFilter === stage.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
                onClick={() => setStageFilter(stage.id)}
              >
                {stage.label} ({stageCounts[stage.id] ?? 0})
              </button>
            ))}
          </div>

          {activeType === "workshop" && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-muted-foreground">Workshop sub-stages</div>
              <div className="grid gap-2 md:grid-cols-3">
                {Object.entries(WORKSHOP_SUBSETS).map(([key, subset]) => (
                  <div key={key} className="space-y-1 rounded-lg border bg-background/50 p-2">
                    <div className="text-xs font-medium">{subset.title}</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          workshopSubFilter === "all"
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                        onClick={() => setWorkshopSubFilter("all")}
                      >
                        All
                      </button>
                      {subset.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            workshopSubFilter === item.id
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                          onClick={() => setWorkshopSubFilter(item.id)}
                        >
                          {item.label} ({subStageCounts[item.id] ?? 0})
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading jobs...</p>}
        {state.status === "error" && <p className="text-sm text-destructive">{state.error}</p>}

        {state.status === "loaded" && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="py-2 pl-3 pr-4 text-left">Job</th>
                  <th className="py-2 px-3 text-left">Car</th>
                  <th className="py-2 px-3 text-left">Location</th>
                  <th className="py-2 px-3 text-left">Stage</th>
                  <th className="py-2 px-3 text-left">Status</th>
                  <th className="py-2 px-3 text-left">Actions</th>
                  <th className="py-2 px-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                      No jobs in this stage.
                    </td>
                  </tr>
                ) : (
                  visibleJobs.map((job) => {
                    const leadHref = effectiveCompanyId ? `/company/${effectiveCompanyId}/leads/${job.id}` : "#";
                    const stageKey = (job.leadStage || "").toLowerCase();
                    const isCompleted = stageKey === "completed" || stageKey === "verified";
                    const isRSA = job.leadType === "rsa";
                    const isRecovery = job.leadType === "recovery";

                    const nextActions: { label: string; stage: string; status?: string }[] = [];
                    const prevActions: { label: string; stage: string; status?: string }[] = [];
                    if (isRSA || isRecovery) {
                      if (stageKey === "assigned" || stageKey === "new") {
                        nextActions.push({ label: "Start", stage: "enroute" });
                        prevActions.push({ label: "Revert Assigned", stage: "new" });
                      } else if (stageKey === "enroute") {
                        nextActions.push({ label: "Reach", stage: "inprocess" });
                        prevActions.push({ label: "Back to Assigned", stage: "assigned" });
                      } else if (stageKey === "inprocess") {
                        nextActions.push({ label: "Punch Order", stage: "completed", status: "closed_won" });
                        prevActions.push({ label: "Back to Enroute", stage: "enroute" });
                      } else if (stageKey === "completed") {
                        // allow reverting completion back to in process
                        prevActions.push({ label: "Revert Completion", stage: "inprocess", status: "open" });
                      }
                    }

                    return (
                      <tr key={job.id} className="border-b last:border-0">
                        <td className="py-2 pl-3 pr-4">
                          <a href={leadHref} className="font-medium text-primary hover:underline">
                            {job.id.slice(0, 8)}
                          </a>
                        </td>
                        <td className="py-2 px-3">
                          <div className="text-sm">
                            {job.carPlateNumber ?? "No plate"} · {job.carModel ?? "Unknown model"}
                          </div>
                          {job.customerDetailsApproved ? (
                            <>
                              <div className="text-[11px] text-muted-foreground">
                                Customer: {job.customerName ?? "Unknown"}
                              </div>
                              {job.customerPhone && (
                                <div className="text-[11px] text-muted-foreground">{job.customerPhone}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-[11px] text-muted-foreground">
                              Customer details hidden. Request from company to view.
                            </div>
                          )}
                          {(job.customerRemark || job.customerFeedback) && (
                            <div className="text-[11px] text-muted-foreground">
                              Customer remark: {job.customerRemark || job.customerFeedback}
                            </div>
                          )}
                          {job.agentRemark && (
                            <div className="text-[11px] text-muted-foreground">Agent remark: {job.agentRemark}</div>
                          )}
                          {remarkLeadId === job.id ? (
                            <div className="mt-2 flex flex-col gap-1">
                              <textarea
                                className="w-full rounded border px-2 py-1 text-xs"
                                rows={2}
                                value={remarkText}
                                onChange={(e) => setRemarkText(e.target.value)}
                                placeholder="Technician remark"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-60"
                                  onClick={async () => {
                                    if (!effectiveCompanyId || !remarkLeadId) return;
                                    setRemarkSaving(true);
                                    try {
                                      await advanceJob(effectiveCompanyId, remarkLeadId, {
                                        leadStage: job.leadStage,
                                        leadStatus: job.leadStatus,
                                        agentRemark: remarkText,
                                      });
                                      setRemarkLeadId(null);
                                      setRemarkText("");
                                      refresh();
                                    } finally {
                                      setRemarkSaving(false);
                                    }
                                  }}
                                  disabled={!remarkText || remarkSaving}
                                >
                                  {remarkSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded border px-2 py-1 text-xs"
                                  onClick={() => {
                                    setRemarkLeadId(null);
                                    setRemarkText("");
                                  }}
                                  disabled={remarkSaving}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="mt-1 text-xs text-primary hover:underline"
                              onClick={() => {
                                setRemarkLeadId(job.id);
                                setRemarkText(job.agentRemark ?? "");
                              }}
                            >
                              Add technician remark
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {job.carLocation ? (
                            <iframe
                              title="Location"
                              src={`https://www.google.com/maps/embed/v1/place?key=YOUR_GOOGLE_MAPS_KEY&q=${encodeURIComponent(
                                job.carLocation
                              )}`}
                              width="200"
                              height="120"
                              style={{ border: 0 }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          ) : (
                            <span className="text-muted-foreground">No location</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <span className="rounded-full border px-2 py-1 capitalize">
                            {formatStageLabel(job.leadStage)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs capitalize">
                          {job.leadStatus?.replace("_", " ") ?? "open"}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded border px-2 py-1 hover:border-primary hover:text-primary disabled:opacity-60"
                              onClick={async () => {
                                if (!effectiveCompanyId) return;
                                await requestCustomerDetails(effectiveCompanyId, job.id);
                                setRequestedCustomer((prev) => {
                                  const next = new Set(prev);
                                  next.add(job.id);
                                  return next;
                                });
                              }}
                              disabled={!effectiveCompanyId || requestedCustomer.has(job.id)}
                            >
                              {requestedCustomer.has(job.id) ? "Requested" : "Request Customer"}
                            </button>
                            {nextActions.map((a) => (
                              <button
                                key={a.label}
                                type="button"
                                className="rounded border px-2 py-1 hover:border-primary hover:text-primary"
                                onClick={async () => {
                                  if (!effectiveCompanyId) return;
                                  await advanceJob(effectiveCompanyId, job.id, {
                                    leadStage: a.stage,
                                    leadStatus: a.status,
                                  });
                                  if (a.label.toLowerCase().includes("reach")) {
                                    setCarCheckLeadId(job.id);
                                    setCarCheckForm({
                                      make: (job as any).carMake ?? "",
                                      model: (job as any).carModel ?? "",
                                      year: (job as any).carYear ?? "",
                                      plate: job.carPlateNumber ?? "",
                                      vin: (job as any).carVin ?? "",
                                      odometer: (job as any).odometer ?? "",
                                      tireFront: (job as any).tireFront ?? "",
                                      tireRear: (job as any).tireRear ?? "",
                                      photoFront: "",
                                      photoBack: "",
                                      photoLeft: "",
                                      photoRight: "",
                                      video360: "",
                                      photoOdometer: "",
                                      photoVin: "",
                                    });
                                  } else {
                                    refresh();
                                  }
                                }}
                              >
                                {a.label}
                              </button>
                            ))}
                            {prevActions.map((a) => (
                              <button
                                key={a.label}
                                type="button"
                                className="rounded border px-2 py-1 hover:border-destructive hover:text-destructive"
                                onClick={async () => {
                                  if (!effectiveCompanyId) return;
                                  await advanceJob(effectiveCompanyId, job.id, {
                                    leadStage: a.stage,
                                    leadStatus: a.status,
                                  });
                                  refresh();
                                }}
                              >
                                {a.label}
                              </button>
                            ))}
                            {nextActions.length === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </MainPageShell>

      {carCheckLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <div className="text-lg font-semibold">Car Verification</div>
              <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setCarCheckLeadId(null)}>
                Close
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Make</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.make} onChange={(e) => setCarCheckForm((p) => ({ ...p, make: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Model</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.model} onChange={(e) => setCarCheckForm((p) => ({ ...p, model: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Year</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.year} onChange={(e) => setCarCheckForm((p) => ({ ...p, year: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Plate / Number</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.plate} onChange={(e) => setCarCheckForm((p) => ({ ...p, plate: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">VIN</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.vin} onChange={(e) => setCarCheckForm((p) => ({ ...p, vin: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Odometer Reading</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.odometer} onChange={(e) => setCarCheckForm((p) => ({ ...p, odometer: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Tire Size Front</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.tireFront} onChange={(e) => setCarCheckForm((p) => ({ ...p, tireFront: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Tire Size Rear</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.tireRear} onChange={(e) => setCarCheckForm((p) => ({ ...p, tireRear: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Front Photo (file ID / URL)</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoFront} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoFront: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Back Photo</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoBack} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoBack: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Left Photo</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoLeft} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoLeft: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Right Photo</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoRight} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoRight: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">360° Video</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.video360} onChange={(e) => setCarCheckForm((p) => ({ ...p, video360: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Odometer Photo</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoOdometer} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoOdometer: e.target.value }))} />
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">VIN Photo</div>
                <input className="w-full rounded border px-3 py-2" value={carCheckForm.photoVin} onChange={(e) => setCarCheckForm((p) => ({ ...p, photoVin: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="rounded border px-3 py-2 text-sm" onClick={() => setCarCheckLeadId(null)}>
                Cancel
              </button>
              <button
                className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                onClick={async () => {
                  if (!effectiveCompanyId || !carCheckLeadId) return;
                  await saveCarCheck(effectiveCompanyId, carCheckLeadId, carCheckForm);
                  setCarCheckLeadId(null);
                  refresh();
                }}
              >
                Save Car Check
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatStageLabel(stage?: string | null) {
  if (!stage) return "Unknown";
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function saveCarCheck(
  companyId: string,
  leadId: string,
  payload: any
): Promise<void> {
  await fetch(`/api/company/${companyId}/sales/leads/${leadId}/car-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function advanceJob(
  companyId: string,
  leadId: string,
  opts: { leadStage: string; leadStatus?: string | null; agentRemark?: string | null }
) {
  try {
    await fetch(`/api/company/${companyId}/sales/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadStage: opts.leadStage,
        status: opts.leadStatus ?? undefined,
        agentRemark: opts.agentRemark,
      }),
    });
    // No local state update here; the caller is expected to refetch (handled by parent load effect)
  } catch (err) {
    console.error("Failed to advance job", err);
  }
}

async function requestCustomerDetails(companyId: string | null, leadId: string) {
  if (!companyId) return;
  try {
    await fetch(`/api/company/${companyId}/sales/leads/${leadId}/request-customer`, {
      method: "POST",
    });
    // noop: company will approve separately
  } catch (err) {
    console.error("Failed to request customer details", err);
  }
}
