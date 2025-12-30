"use client";

import React, { useEffect, useState } from "react";
import type { Lead } from "@repo/ai-core/crm/leads/types";
import { formatStageLabel } from "@repo/ai-core/crm/leads/jobFlows";
import { MainPageShell } from "./MainPageShell";
import { LeadHealthBadge, LeadStatusBadge } from "../components/leads/LeadBadges";
import { JobActionsCell } from "./JobsMain";

type WorkshopJobsMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type WorkshopTabId = "all" | "inspection" | "estimates" | "parts" | "work" | "qc" | "gatepass";

const WORKSHOP_TABS: { id: WorkshopTabId; label: string; description?: string }[] = [
  { id: "all", label: "All", description: "All active workshop jobs." },
  { id: "inspection", label: "Inspection", description: "Check-in & inspection queue." },
  { id: "estimates", label: "Estimates", description: "Estimate / approval / RFQ steps." },
  { id: "parts", label: "Parts", description: "Waiting for or receiving parts." },
  { id: "work", label: "Work", description: "Assigned for work, work in progress or completed." },
  { id: "qc", label: "QC", description: "Quality check queue and in-progress." },
  { id: "gatepass", label: "Gatepass", description: "Gatepass, invoice and handover steps." },
];

export function WorkshopJobsMain({ companyId, companyName }: WorkshopJobsMainProps) {
  const [state, setState] = useState<LoadState<Lead[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<WorkshopTabId>("inspection");

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
          setState({
            status: "error",
            data: null,
            error: "Failed to load workshop jobs.",
          });
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

  const workshopLeads = allLeads.filter(
    (l) => l.leadType === "workshop" && l.leadStatus !== "closed_won" && l.leadStatus !== "lost"
  );

  const filtered = filterWorkshopByTab(workshopLeads, activeTab);

  return (
    <MainPageShell
      title="Workshop Board"
      subtitle="Track workshop jobs across inspection, estimates, parts, work, QC and gatepass."
      scopeLabel={scopeLabel}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {WORKSHOP_TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  isActive ? "bg-primary text-primary-foreground" : "bg-background text-foreground",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {WORKSHOP_TABS.find((t) => t.id === activeTab)?.description}
        </p>

        {isLoading && <p className="text-sm text-muted-foreground">Loading workshop jobs.</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!isLoading && !loadError && (
          <>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground">No jobs in this queue.</p>
            ) : (
              <WorkshopJobsTable companyId={companyId} jobs={filtered} />
            )}
          </>
        )}
      </div>
    </MainPageShell>
  );
}

function filterWorkshopByTab(leads: Lead[], tab: WorkshopTabId): Lead[] {
  if (tab === "all") return leads;

  const stageSet = new Set<string>();

  switch (tab) {
    case "inspection":
      ["checkin", "inspection_queue", "inspection_started"].forEach((s) => stageSet.add(s));
      break;
    case "estimates":
      ["inspection_completed", "estimate_pending", "estimate_approved", "rfq_pending", "estimate_approval_pending"].forEach(
        (s) => stageSet.add(s)
      );
      break;
    case "parts":
      ["parts_pending"].forEach((s) => stageSet.add(s));
      break;
    case "work":
      ["assigned_for_work", "workorder_queue", "work_started", "work_completed"].forEach((s) => stageSet.add(s));
      break;
    case "qc":
      ["qc_queue", "qc_started", "qc_completed"].forEach((s) => stageSet.add(s));
      break;
    case "gatepass":
      ["gatepass_queue", "invoice_issued", "handover_pending"].forEach((s) => stageSet.add(s));
      break;
    default:
      return leads;
  }

  return leads.filter((l) => l.leadStage && stageSet.has(l.leadStage));
}

type WorkshopJobsTableProps = {
  companyId: string;
  jobs: Lead[];
};

function WorkshopJobsTable({ companyId, jobs }: WorkshopJobsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="py-2 pl-3 pr-4 text-left">Job</th>
            <th className="py-2 px-4 text-left">Customer</th>
            <th className="py-2 px-4 text-left">Car</th>
            <th className="py-2 px-4 text-left">Stage</th>
            <th className="py-2 px-4 text-left">Status</th>
            <th className="py-2 px-4 text-left">Source</th>
            <th className="py-2 px-4 text-left">Branch / Agent</th>
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
                    {job.id.slice(0, 8)}…
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
                <td className="py-2 px-4 text-xs text-muted-foreground">
                  {formatStageLabel(job.leadType as any, job.leadStage)}
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
