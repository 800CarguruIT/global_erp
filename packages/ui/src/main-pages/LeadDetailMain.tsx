"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Lead, LeadEvent, LeadStatus } from "@repo/ai-core/crm/leads/types";
import { LeadTypeBadge, LeadStatusBadge, LeadHealthBadge } from "../components/leads/LeadBadges";
import { LeadTimeline } from "../components/leads/LeadTimeline";

type LeadDetailMainProps = {
  companyId: string;
  leadId: string;
  onDeleted?: () => void;
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

export function LeadDetailMain({ companyId, leadId, onDeleted }: LeadDetailMainProps) {
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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

        const loadedEvents = await fetchEventsByUrl(`${salesLeadUrl}/events`);

        if (!cancelled) {
          setLead(loadedLead);
          setEvents(withFallbackEvents(loadedLead, loadedEvents));
          setStatus(loadedLead.leadStatus as LeadStatus);
          setStage(loadedLead.leadStage || "");
          const parsed = parseAutoAgentNotes(loadedLead.agentRemark);
          setAgentRemark(parsed.cleanedRemark);
          setAutoNotes(parsed.notes);
          setCustomerRemark(loadedLead.customerRemark ?? loadedLead.customerFeedback ?? "");
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
      const refreshedEvents = await fetchEventsByUrl(`/api/company/${companyId}/sales/leads/${lead.id}/events`);
      setIsReloadingTimeline(false);

      const timelineEvents = withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events);

      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
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

  return (
    <MainPageShell
      title="Lead Details"
      subtitle="Manage status, remarks and track the full timeline."
      scopeLabel="Company workspace"
      primaryAction={
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-md border px-3 py-1 text-sm font-medium"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      }
      secondaryActions={
        <>
          {saveSuccess && <span className="text-xs text-emerald-600">Saved.</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {deleteError && <span className="text-xs text-destructive">{deleteError}</span>}
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
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

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

          <div className="space-y-2 rounded-md border p-3">
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
                    <div className="mt-3 border-t pt-3">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Agent remarks</h2>
              <textarea
                className="h-24 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="Add or update agent remarks"
                value={agentRemark}
                onChange={(e) => setAgentRemark(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Customer remarks / feedback</h2>
              <textarea
                className="h-24 w-full rounded-md border bg-background p-2 text-sm"
                placeholder="Customer sentiment / feedback"
                value={customerRemark}
                onChange={(e) => setCustomerRemark(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Timeline</h2>
          </div>
          {isReloadingTimeline ? (
            <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
          ) : (
            <LeadTimeline events={events} />
          )}
        </div>
      </div>
    </MainPageShell>
  );
}





