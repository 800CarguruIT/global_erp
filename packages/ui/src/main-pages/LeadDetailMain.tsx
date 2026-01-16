"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Lead, LeadEvent, LeadStatus } from "@repo/ai-core/crm/leads/types";
import { LeadTypeBadge, LeadStatusBadge, LeadHealthBadge } from "../components/leads/LeadBadges";
import { LeadTimeline } from "../components/leads/LeadTimeline";
import { Card } from "../components/Card";

type LeadDetailMainProps = {
  companyId: string;
  leadId: string;
  onDeleted?: () => void;
  showDeleteActions?: boolean;
  useSectionCards?: boolean;
  showAcceptAction?: boolean;
  showCheckinAction?: boolean;
  showSaveAction?: boolean;
  timelineMode?: "events" | "status";
  currentBranchId?: string | null;
  timelineCutoff?: "accepted" | null;
  timelineVariant?: "default" | "centered";
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

export function LeadDetailMain({
  companyId,
  leadId,
  onDeleted,
  showDeleteActions = true,
  useSectionCards = false,
  showAcceptAction = false,
  showCheckinAction = false,
  showSaveAction = true,
  timelineMode = "events",
  currentBranchId = null,
  timelineCutoff = null,
  timelineVariant = "default",
}: LeadDetailMainProps) {
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

  const buildStatusTimeline = (currentLead: Lead, leadEvents: LeadEvent[]) => {
    const steps: LeadEvent[] = [];
    const acceptedEvent = leadEvents.find((e) => e.eventType === "accepted");
    const checkinEvent = leadEvents.find((e) => e.eventType === "car_in");
    const branchAssignedEvent = leadEvents.find((e) => e.eventType === "branch_updated");

    steps.push({
      id: `${currentLead.id}-created`,
      leadId: currentLead.id,
      companyId: currentLead.companyId,
      actorUserId: null,
      actorEmployeeId: null,
      eventType: "created",
      eventPayload: { order: 1 },
      createdAt: currentLead.createdAt,
    });

    const hasAssignment =
      currentLead.leadStage === "assigned" ||
      Boolean(currentLead.branchId) ||
      Boolean(currentLead.assignedUserId) ||
      Boolean(currentLead.assignedAt);
    if (hasAssignment) {
      steps.push({
        id: `${currentLead.id}-assigned`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: {
          label: "Assigned",
          actor: branchAssignedEvent?.actorName ?? branchAssignedEvent?.actorUserId ?? null,
          order: 2,
        },
        createdAt: currentLead.assignedAt ?? currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    const acceptedAt =
      (acceptedEvent?.eventPayload?.acceptedAt as string | undefined) ??
      acceptedEvent?.createdAt ??
      (currentLead.leadStatus === "accepted" ? currentLead.updatedAt : undefined);
    if (acceptedAt) {
      steps.push({
        id: `${currentLead.id}-accepted`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "accepted",
        eventPayload: {
          acceptedAt,
          actor: acceptedEvent?.actorName ?? acceptedEvent?.actorUserId ?? null,
          order: 3,
        },
        createdAt: acceptedAt,
      });
    }

    const checkinAt =
      (checkinEvent?.eventPayload?.checkinAt as string | undefined) ??
      checkinEvent?.createdAt ??
      currentLead.checkinAt ??
      (currentLead.leadStatus === "car_in" ? currentLead.updatedAt : undefined);
    if (checkinAt) {
      steps.push({
        id: `${currentLead.id}-car-in`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: {
          label: "Car check-in",
          actor: checkinEvent?.actorName ?? checkinEvent?.actorUserId ?? null,
          order: 4,
        },
        createdAt: checkinAt,
      });
    }

    if (currentLead.leadStatus === "processing") {
      steps.push({
        id: `${currentLead.id}-processing`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: { label: "Processing", order: 5 },
        createdAt: currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    if (["closed", "closed_won", "lost"].includes(currentLead.leadStatus)) {
      const label =
        currentLead.leadStatus === "closed_won"
          ? "Closed / Won"
          : currentLead.leadStatus === "lost"
          ? "Lost"
          : "Closed";
      steps.push({
        id: `${currentLead.id}-closed`,
        leadId: currentLead.id,
        companyId: currentLead.companyId,
        actorUserId: null,
        actorEmployeeId: null,
        eventType: "status_step",
        eventPayload: { label, order: 6 },
        createdAt: currentLead.closedAt ?? currentLead.updatedAt ?? currentLead.createdAt,
      });
    }

    return steps;
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

        const loadedEvents = await fetchEventsByUrl(
          `/api/company/${companyId}/crm/leads/${leadId}/events`
        );

        if (!cancelled) {
          setLead(loadedLead);
          setEvents(
            timelineMode === "status"
              ? buildStatusTimeline(loadedLead, loadedEvents)
              : withFallbackEvents(loadedLead, loadedEvents)
          );
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
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      setIsReloadingTimeline(false);

      const timelineEvents =
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events);

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

  async function handleAccept() {
    if (!lead) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/company/${companyId}/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: "accepted",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
      }
      setEvents(
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError("Failed to accept lead. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCheckin() {
    if (!lead) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/company/${companyId}/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadStatus: "car_in",
          checkinAt: new Date().toISOString(),
          branchId: currentBranchId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const refreshedLead = await fetchLeadByUrl(`/api/company/${companyId}/sales/leads/${lead.id}`);
      const refreshedEvents = await fetchEventsByUrl(
        `/api/company/${companyId}/crm/leads/${lead.id}/events`
      );
      if (refreshedLead) {
        setLead(refreshedLead);
        setStatus(refreshedLead.leadStatus as LeadStatus);
        setStage(refreshedLead.leadStage || "");
        const parsed = parseAutoAgentNotes(refreshedLead.agentRemark);
        setAgentRemark(parsed.cleanedRemark);
        setAutoNotes(parsed.notes);
        setCustomerRemark(refreshedLead.customerRemark ?? refreshedLead.customerFeedback ?? "");
      }
      setEvents(
        timelineMode === "status"
          ? buildStatusTimeline(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
          : withFallbackEvents(refreshedLead ?? lead, refreshedEvents.length ? refreshedEvents : events)
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError("Failed to check in car. Please try again.");
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
      contentClassName="border-0 p-0 bg-transparent"
      primaryAction={
        showSaveAction ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        ) : undefined
      }
      secondaryActions={
        <>
          {saveSuccess && <span className="text-xs text-emerald-600">Saved.</span>}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {deleteError && <span className="text-xs text-destructive">{deleteError}</span>}
          {showAcceptAction && lead?.leadStatus !== "accepted" && lead?.leadStatus !== "car_in" && (
            <button
              type="button"
              onClick={handleAccept}
              disabled={isSaving}
              className="rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
            >
              Accept lead
            </button>
          )}
          {showCheckinAction && lead?.leadStatus === "accepted" && (
            <button
              type="button"
              onClick={handleCheckin}
              disabled={isSaving}
              className="rounded-md border px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/10 disabled:opacity-50"
            >
              Car check-in
            </button>
          )}
          {showDeleteActions && (
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
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            {useSectionCards ? (
              <>
                <Card className="p-4">
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
                </Card>
                <Card className="p-4">
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
                </Card>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {useSectionCards ? (
            <Card className="p-4">
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
                  <option value="accepted">Accepted</option>
                  <option value="car_in">Car In</option>
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
            </Card>
          ) : (
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
                    <option value="car_in">Car In</option>
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
          )}

          {useSectionCards ? (
            <Card className="p-4">
              <div className="space-y-2">
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
                        <div className="mt-3 pt-3">
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
            </Card>
          ) : (
            <div className="space-y-2 rounded-md p-3">
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
                      <div className="mt-3 pt-3">
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
          )}

          {useSectionCards ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Agent remarks</h2>
                  <textarea
                    className="h-24 w-full rounded-md bg-background p-2 text-sm"
                    placeholder="Add or update agent remarks"
                    value={agentRemark}
                    onChange={(e) => setAgentRemark(e.target.value)}
                  />
                </div>
              </Card>
              <Card className="p-4">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Customer remarks / feedback</h2>
                  <textarea
                    className="h-24 w-full rounded-md bg-background p-2 text-sm"
                    placeholder="Customer sentiment / feedback"
                    value={customerRemark}
                    onChange={(e) => setCustomerRemark(e.target.value)}
                  />
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Agent remarks</h2>
                <textarea
                  className="h-24 w-full rounded-md bg-background p-2 text-sm"
                  placeholder="Add or update agent remarks"
                  value={agentRemark}
                  onChange={(e) => setAgentRemark(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Customer remarks / feedback</h2>
                <textarea
                  className="h-24 w-full rounded-md bg-background p-2 text-sm"
                  placeholder="Customer sentiment / feedback"
                  value={customerRemark}
                  onChange={(e) => setCustomerRemark(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {useSectionCards ? (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Timeline</h2>
              </div>
              {isReloadingTimeline ? (
                <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
              ) : (
                <LeadTimeline events={events} variant={timelineVariant} />
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Timeline</h2>
            </div>
            {isReloadingTimeline ? (
              <p className="text-xs text-muted-foreground">Refreshing timeline...</p>
            ) : (
              <LeadTimeline events={events} variant={timelineVariant} />
            )}
          </div>
        )}
      </div>
    </MainPageShell>
  );
}





