"use client";

import React, { useEffect, useState } from "react";
import type { Lead, LeadStatus, LeadType } from "@repo/ai-core/crm/leads/types";
import { formatStageLabel } from "@repo/ai-core/crm/leads/jobFlows";
import { MainPageShell } from "./MainPageShell";
import { LeadStatusBadge, LeadHealthBadge, LeadTypeBadge } from "../components/leads/LeadBadges";

type JobsMainProps = {
  companyId: string;
  companyName?: string;
  includeTypes?: LeadType[];
};

type LoadState<T> =
  | { status: "idle" | "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function JobsMain({ companyId, companyName, includeTypes }: JobsMainProps) {
  const [state, setState] = useState<LoadState<Lead[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<"all" | LeadType>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/sales/leads`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const leads: Lead[] = json.data ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: leads, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load jobs." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";

  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const allLeads = state.status === "loaded" ? state.data : [];

  const allowedTypes =
    includeTypes && includeTypes.length > 0 ? includeTypes : (["rsa", "recovery", "workshop"] as LeadType[]);

  const active = allLeads.filter(
    (l) =>
      allowedTypes.includes(l.leadType as LeadType) &&
      l.leadStatus !== "closed_won" &&
      l.leadStatus !== "closed" &&
      l.leadStatus !== "lost"
  );

  const rsaJobs = active.filter((l) => l.leadType === "rsa");
  const recoveryJobs = active.filter((l) => l.leadType === "recovery");
  const workshopJobs = active.filter((l) => l.leadType === "workshop");

  return (
    <MainPageShell
      title="Jobs"
      subtitle="Monitor and manage all active RSA, Recovery and Workshop jobs."
      scopeLabel={scopeLabel}
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading jobs.</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!isLoading && !loadError && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/80 px-3 py-2 text-sm">
            {([
              { key: "all" as const, label: "All", count: active.length },
              { key: "rsa" as const, label: "RSA", count: rsaJobs.length },
              { key: "recovery" as const, label: "Recovery", count: recoveryJobs.length },
              { key: "workshop" as const, label: "Workshop", count: workshopJobs.length },
            ] as const)
              .filter((t) => t.key === "all" || allowedTypes.includes(t.key))
              .map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeTab === tab.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/60"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
          </div>

          <div className="space-y-6">
            {(activeTab === "all" || activeTab === "rsa") && allowedTypes.includes("rsa") && (
              <JobsSection
                companyId={companyId}
                title="RSA Jobs"
                description="Assigned RSA roadside assistance jobs."
                jobs={rsaJobs}
              />
            )}
            {(activeTab === "all" || activeTab === "recovery") && allowedTypes.includes("recovery") && (
              <JobsSection
                companyId={companyId}
                title="Recovery Jobs"
                description="Assigned vehicle recovery / towing jobs."
                jobs={recoveryJobs}
              />
            )}
            {(activeTab === "all" || activeTab === "workshop") && allowedTypes.includes("workshop") && (
              <JobsSection
                companyId={companyId}
                title="Workshop Jobs"
                description="Cars moving through workshop inspection, estimate and repair."
                jobs={workshopJobs}
              />
            )}
          </div>
        </div>
      )}
    </MainPageShell>
  );
}

type JobsSectionProps = {
  companyId: string;
  title: string;
  description?: string;
  jobs: Lead[];
};

function JobsSection({ companyId, title, description, jobs }: JobsSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="text-xs text-muted-foreground">{jobs.length} active</div>
      </div>
      {jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active jobs in this category.</p>
      ) : (
        <JobsTable companyId={companyId} jobs={jobs} />
      )}
    </section>
  );
}

type JobsTableProps = {
  companyId: string;
  jobs: Lead[];
};

function JobsTable({ companyId, jobs }: JobsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="py-2 pl-3 pr-4 text-left">Job</th>
            <th className="py-2 px-4 text-left">Customer</th>
            <th className="py-2 px-4 text-left">Car</th>
            <th className="py-2 px-4 text-left">Type / Stage</th>
            <th className="py-2 px-4 text-left">Status</th>
            <th className="py-2 px-4 text-left">Source</th>
            <th className="py-2 px-4 text-left">Agent / Tech</th>
            <th className="py-2 px-4 text-left">Health</th>
            <th className="py-2 px-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const leadHref = `/company/${companyId}/leads/${job.id}`;
            const customerHref = job.customerId ? `/company/${companyId}/customers/${job.customerId}` : null;
            const carHref = job.carId ? `/company/${companyId}/cars/${job.carId}` : null;

            return (
              <tr key={job.id} className="border-b last:border-0">
                <td className="py-2 pl-3 pr-4">
                  <a href={leadHref} className="font-medium text-primary hover:underline">
                    {job.id.slice(0, 8)}.
                  </a>
                  <div className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</div>
                </td>
                <td className="py-2 px-4">
                  {job.customerName ? (
                    customerHref ? (
                      <a href={customerHref} className="text-sm hover:underline">
                        {job.customerName}
                      </a>
                    ) : (
                      <span className="text-sm">{job.customerName}</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No customer</span>
                  )}
                  {job.customerPhone && <div className="text-xs text-muted-foreground">{job.customerPhone}</div>}
                </td>
                <td className="py-2 px-4">
                  {job.carPlateNumber ? (
                    carHref ? (
                      <a href={carHref} className="hover:underline">
                        <div className="text-sm">{job.carPlateNumber}</div>
                        {job.carModel && <div className="text-xs text-muted-foreground">{job.carModel}</div>}
                      </a>
                    ) : (
                      <>
                        <div className="text-sm">{job.carPlateNumber}</div>
                        {job.carModel && <div className="text-xs text-muted-foreground">{job.carModel}</div>}
                      </>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No car</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <div className="flex flex-col gap-1">
                    <LeadTypeBadge type={job.leadType as any} />
                    <span className="text-xs text-muted-foreground">
                      {formatStageLabel(job.leadType as any, job.leadStage)}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-4">
                  <LeadStatusBadge status={job.leadStatus as any} />
                </td>
                <td className="py-2 px-4 text-xs capitalize">
                  {job.source || <span className="text-muted-foreground">Unknown</span>}
                </td>
                <td className="py-2 px-4 text-sm">
                  {job.agentName || <span className="text-xs text-muted-foreground">Unassigned</span>}
                </td>
                <td className="py-2 px-4">
                  <LeadHealthBadge score={job.healthScore ?? null} />
                </td>
                <td className="py-2 px-4">
                  <JobActionsCell companyId={companyId} job={job} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type RsaAction = "accept" | "start" | "reach" | "complete" | "invoice";
type RecoveryAction = "accept" | "start" | "pickup" | "dropoff" | "invoice";
type WorkshopAction =
  | "checkin"
  | "inspection_start"
  | "inspection_complete"
  | "estimate_pending"
  | "estimate_approved"
  | "parts_pending"
  | "work_start"
  | "work_complete"
  | "qc_start"
  | "qc_complete"
  | "gatepass_ready"
  | "invoice"
  | "close";

function getAvailableRsaActions(job: Lead): RsaAction[] {
  if (job.leadType !== "rsa") return [];

  const stage = job.leadStage;
  const status = job.leadStatus as LeadStatus;

  if (status === "closed_won" || status === "closed" || status === "lost") return [];

  const actions: RsaAction[] = [];

  if (stage === "new" || !stage) {
    actions.push("accept");
    return actions;
  }

  if (stage === "assigned") {
    actions.push("start");
  } else if (stage === "enroute") {
    actions.push("reach");
  } else if (stage === "inprocess") {
    actions.push("complete");
  } else if (stage === "completed") {
    actions.push("invoice");
  }

  return actions;
}

function getAvailableRecoveryActions(job: Lead): RecoveryAction[] {
  if (job.leadType !== "recovery") return [];

  const stage = job.leadStage;
  const status = job.leadStatus as LeadStatus;

  if (status === "closed_won" || status === "closed" || status === "lost") return [];

  const actions: RecoveryAction[] = [];

  if (stage === "new" || !stage) {
    actions.push("accept");
    return actions;
  }

  if (stage === "assigned") {
    actions.push("start");
  } else if (stage === "enroute") {
    actions.push("pickup");
  } else if (stage === "pickup") {
    actions.push("dropoff");
  } else if (stage === "dropoff") {
    actions.push("invoice");
  }

  return actions;
}

function getAvailableWorkshopActions(job: Lead): WorkshopAction[] {
  if (job.leadType !== "workshop") return [];

  const stage = job.leadStage;
  const status = job.leadStatus as LeadStatus;

  if (status === "closed_won" || status === "closed" || status === "lost") return [];

  const actions: WorkshopAction[] = [];

  if (!stage || stage === "assigned_branch" || stage === "inspection_queue") {
    actions.push("checkin");
    return actions;
  }

  if (stage === "checkin" || stage === "inspection_queue") {
    actions.push("inspection_start");
  } else if (stage === "inspection_started") {
    actions.push("inspection_complete");
  } else if (stage === "inspection_completed") {
    actions.push("estimate_pending");
  } else if (stage === "estimate_pending") {
    actions.push("estimate_approved");
  } else if (stage === "estimate_approved") {
    actions.push("parts_pending");
  } else if (stage === "parts_pending") {
    actions.push("work_start");
  } else if (stage === "work_started") {
    actions.push("work_complete");
  } else if (stage === "work_completed") {
    actions.push("qc_start");
  } else if (stage === "qc_started") {
    actions.push("qc_complete");
  } else if (stage === "qc_completed") {
    actions.push("gatepass_ready");
  } else if (stage === "gatepass_queue") {
    actions.push("invoice");
  } else if (stage === "invoice_issued") {
    actions.push("close");
  }

  return actions;
}

export type JobActionsCellProps = {
  companyId: string;
  job: Lead;
};

export function JobActionsCell({ companyId, job }: JobActionsCellProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rsaActions = getAvailableRsaActions(job);
  const recoveryActions = getAvailableRecoveryActions(job);
  const workshopActions = getAvailableWorkshopActions(job);

  async function performAction(action: RsaAction) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsaAction: action }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      setError("Failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function performRecoveryAction(action: RecoveryAction) {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryAction: action }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      setError("Failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function performWorkshopAction(action: WorkshopAction) {
    setIsLoading(true);
    setError(null);
    try {
      if (action === "inspection_start" || action === "work_start") {
        const leadRes = await fetch(`/api/company/${companyId}/sales/leads/${job.id}`);
        if (!leadRes.ok) throw new Error(`HTTP ${leadRes.status}`);
        const leadJson = await leadRes.json();
        const leadData = leadJson.data?.lead ?? leadJson.data?.data ?? leadJson.data ?? {};
        const carInVideo = leadData.carInVideo ?? leadData.carin_video ?? null;
        if (!carInVideo) {
          setError("Car in video is required before starting the job.");
          setIsLoading(false);
          return;
        }
      }
      const patchBody: any = { workshopAction: action };

      const patchRes = await fetch(`/api/company/${companyId}/sales/leads/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) throw new Error(`HTTP ${patchRes.status}`);

      if (action === "inspection_start") {
        const createBody = {
          leadId: job.id,
          carId: (job as any).carId ?? null,
          customerId: (job as any).customerId ?? null,
          status: "pending",
        };

        const inspRes = await fetch(`/api/company/${companyId}/workshop/inspections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        if (!inspRes.ok) throw new Error(`HTTP ${inspRes.status}`);
        const inspJson = await inspRes.json();
        const inspectionId: string =
          inspJson.data?.id ?? inspJson.data?.inspection?.id ?? inspJson.id;

        if (inspectionId) {
          window.location.href = `/company/${companyId}/workshop/inspections/${inspectionId}`;
          return;
        }
      }

      window.location.reload();
    } catch (err) {
      console.error(err);
      setError("Failed");
      setIsLoading(false);
    }
  }

  function labelForAction(action: RsaAction): string {
    switch (action) {
      case "accept":
        return "Accept";
      case "start":
        return "Start";
      case "reach":
        return "Reach";
      case "complete":
        return "Complete";
      case "invoice":
        return "Invoice";
    }
  }

  function labelForRecoveryAction(action: RecoveryAction): string {
    switch (action) {
      case "accept":
        return "Accept";
      case "start":
        return "Start";
      case "pickup":
        return "Pickup";
      case "dropoff":
        return "Dropoff";
      case "invoice":
        return "Invoice";
    }
  }

  function labelForWorkshopAction(action: WorkshopAction): string {
    switch (action) {
      case "checkin":
        return "Check-in";
      case "inspection_start":
        return "Inspection Start";
      case "inspection_complete":
        return "Inspection Done";
      case "estimate_pending":
        return "Estimate Pending";
      case "estimate_approved":
        return "Estimate Approved";
      case "parts_pending":
        return "Parts Pending";
      case "work_start":
        return "Work Start";
      case "work_complete":
        return "Work Complete";
      case "qc_start":
        return "QC Start";
      case "qc_complete":
        return "QC Complete";
      case "gatepass_ready":
        return "Gatepass Ready";
      case "invoice":
        return "Invoice";
      case "close":
        return "Close";
    }
  }

  if (job.leadType === "rsa") {
    if (!rsaActions.length) {
      return <span className="text-xs text-muted-foreground">No available actions</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {rsaActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={isLoading}
            onClick={() => performAction(action)}
            className="rounded-md border px-2 py-0.5 text-xs"
          >
            {labelForAction(action)}
          </button>
        ))}
        {error && <span className="text-[10px] text-destructive">{error}</span>}
      </div>
    );
  }

  if (job.leadType === "recovery") {
    if (!recoveryActions.length) {
      return <span className="text-xs text-muted-foreground">No available actions</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {recoveryActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={isLoading}
            onClick={() => performRecoveryAction(action)}
            className="rounded-md border px-2 py-0.5 text-xs"
          >
            {labelForRecoveryAction(action)}
          </button>
        ))}
        {error && <span className="text-[10px] text-destructive">{error}</span>}
      </div>
    );
  }

  if (job.leadType === "workshop") {
    if (!workshopActions.length) {
      return <span className="text-xs text-muted-foreground">No available actions</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {workshopActions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={isLoading}
            onClick={() => performWorkshopAction(action)}
            className="rounded-md border px-2 py-0.5 text-xs"
          >
            {labelForWorkshopAction(action)}
          </button>
        ))}
        {error && <span className="text-[10px] text-destructive">{error}</span>}
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">Actions coming soon</span>;
}
