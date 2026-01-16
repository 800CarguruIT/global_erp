"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LeadsTable } from "../components/leads/LeadsTable";
import { MainPageShell } from "./MainPageShell";
import { useI18n } from "../i18n";
import { Card } from "../components/Card";

export type LeadsMainProps = {
  companyId: string;
  companyName?: string;
};

type SortKey =
  | "lead"
  | "customer"
  | "car"
  | "status"
  | "source"
  | "branch"
  | "agent"
  | "service"
  | "health"
  | "created";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function normalize(value: string | number | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

export function LeadsMain({ companyId, companyName }: LeadsMainProps) {
  const { t } = useI18n();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "rsa" | "recovery" | "workshop">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignLeadType, setAssignLeadType] = useState<"rsa" | "recovery" | "workshop" | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignBranches, setAssignBranches] = useState<any[]>([]);
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [assignServiceType, setAssignServiceType] = useState<string>("");
  const [assignRecoveryDirection, setAssignRecoveryDirection] = useState<"pickup" | "dropoff" | "">("");
  const [assignRecoveryFlow, setAssignRecoveryFlow] = useState<
    "customer_to_branch" | "customer_to_customer" | "branch_to_branch" | "branch_to_customer" | ""
  >("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiAppreciation, setAiAppreciation] = useState<string | null>(null);

  const refreshLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/sales/leads`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      setLeads(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  const filteredLeads = useMemo(() => {
    const term = normalize(query);
    let rows = tab === "all" ? leads : leads.filter((l) => l.leadType === tab);

    if (!term) return rows;

    return rows.filter((lead) => {
      const haystack = [
        lead.id,
        lead.customerName,
        lead.customerPhone,
        lead.customerEmail,
        lead.carPlateNumber,
        lead.carModel,
        lead.leadType,
        lead.leadStage,
        lead.leadStatus,
        lead.source,
        lead.branchId,
        lead.agentName,
        lead.serviceType,
        lead.healthScore,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [leads, query, tab]);

  const sortedLeads = useMemo(() => {
    const rows = [...filteredLeads];
    rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "lead":
          return dir * collator.compare(normalize(a.id), normalize(b.id));
        case "customer":
          return dir * collator.compare(normalize(a.customerName), normalize(b.customerName));
        case "car":
          return dir * collator.compare(normalize(a.carPlateNumber), normalize(b.carPlateNumber));
        case "status":
          return dir * collator.compare(normalize(a.leadStatus), normalize(b.leadStatus));
        case "source":
          return dir * collator.compare(normalize(a.source), normalize(b.source));
        case "branch":
          return dir * collator.compare(normalize(a.branchId), normalize(b.branchId));
        case "agent":
          return dir * collator.compare(normalize(a.agentName), normalize(b.agentName));
        case "service":
          return dir * collator.compare(normalize(a.serviceType), normalize(b.serviceType));
        case "health": {
          const diff = Number(a.healthScore ?? 0) - Number(b.healthScore ?? 0);
          return dir * diff;
        }
        case "created": {
          const left = new Date(a.createdAt ?? 0).getTime();
          const right = new Date(b.createdAt ?? 0).getTime();
          return dir * (left - right);
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [filteredLeads, sortDir, sortKey]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedLeads = sortedLeads.slice((safePage - 1) * pageSize, safePage * pageSize);
  const tabs = useMemo(
    () =>
      [
        { key: "all", label: t("leads.tab.all") ?? "All" },
        { key: "rsa", label: t("leads.tab.rsa") ?? "RSA" },
        { key: "recovery", label: t("leads.tab.recovery") ?? "Recovery" },
        { key: "workshop", label: t("leads.tab.workshop") ?? "Workshop" },
      ] as const,
    [t]
  );

  function toggleSelect(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function bulkAction(action: "archive" | "delete") {
    if (selected.size === 0) return;
    setBulkWorking(true);
    setBulkMessage(null);
    try {
      const ids = Array.from(selected);
      const res = await fetch(`/api/company/${companyId}/sales/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed");
      }
      setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
      setSelected(new Set());
      setBulkMessage(
        `${action === "archive" ? t("leads.bulk.archived") ?? "Archived" : t("leads.bulk.deleted") ?? "Deleted"} ${
          ids.length
        }`
      );
    } catch (err: any) {
      setBulkMessage(err?.message ?? t("leads.bulk.failed") ?? "Bulk action failed.");
    } finally {
      setBulkWorking(false);
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {
      open: 0,
      assigned: 0,
      onboarding: 0,
      inprocess: 0,
      completed: 0,
      closed: 0,
      lost: 0,
    };
    leads.forEach((l) => {
      map[l.status] = (map[l.status] ?? 0) + 1;
    });
    return map;
  }, [leads]);

  useEffect(() => {
    const suggestions: string[] = [];
    if (counts.open > 5 || counts.assigned > 5) suggestions.push(t("leads.ai.actions.backlog"));
    if (counts.assigned > 0 && counts.open === 0) suggestions.push(t("leads.ai.actions.assigned"));
    if ((counts.onboarding ?? 0) + (counts.inprocess ?? 0) > 0) suggestions.push(t("leads.ai.actions.stalled"));
    if (counts.lost > 0) suggestions.push(t("leads.ai.actions.lost"));
    setAiSuggestions(suggestions);

    if ((counts.completed ?? 0) + (counts.closed ?? 0) > 0) {
      setAiAppreciation(t("leads.ai.appreciation.closed").replace("{count}", String((counts.completed ?? 0) + (counts.closed ?? 0))));
    } else if (counts.assigned > 0) {
      setAiAppreciation(t("leads.ai.appreciation.assigned").replace("{count}", String(counts.assigned)));
    } else {
      setAiAppreciation(t("leads.ai.appreciation.empty"));
    }
  }, [counts, t]);

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  const sortLabel = sortDir === "asc" ? "ASC" : "DESC";

  async function openAssign(leadId: string, lead?: any) {
    setAssignLeadId(leadId);
    const lt = (lead?.leadType as "rsa" | "recovery" | "workshop" | undefined) ?? null;
    if (
      lt === "workshop" &&
      lead?.leadStage !== "inspection_queue" &&
      lead?.leadStage !== "checkin"
    ) {
      setAssignError(t("leads.assign.onlyInspection") ?? "Only inspection leads can be assigned to branches.");
      setAssignLeadId(null);
      return;
    }
    setAssignLeadType(lt);
    setAssignServiceType(lead?.serviceType ?? "");
    setAssignRecoveryDirection((lead?.recoveryDirection as any) ?? (lt === "recovery" ? "pickup" : ""));
    setAssignRecoveryFlow((lead?.recoveryFlow as any) ?? (lt === "recovery" ? "customer_to_branch" : ""));
    setAssignError(null);
    setAssignSuccess(null);
    setAssignBranches([]);
    setAssignUsers([]);
    setAssignBranchId(null);
    setAssignUserId(null);
    try {
      const res = await fetch(`/api/company/${companyId}/branches`);
      if (!res.ok) throw new Error(t("leads.assign.loadBranches") ?? "Failed to load branches");
      const data = await res.json();
      const list = data.data ?? data.branches ?? [];
      const filtered = list.filter((b: any) => {
        const rawTypes = b.branch_types ?? b.branchTypes ?? [];
        const rawServices = b.service_types ?? b.serviceTypes ?? [];
        const types = (Array.isArray(rawTypes) ? rawTypes : []).map((t: string) => t.toLowerCase());
        const services = (Array.isArray(rawServices) ? rawServices : []).map((s: string) => s.toLowerCase());
        if (lt === "recovery") {
          const base =
            types.includes("recovery") ||
            services.some((s: string) =>
              [
                "recovery",
                "any",
                "regular",
                "flatbed",
                "covered",
                "recovery_regular",
                "recovery_flatbed",
                "recovery_covered",
              ].includes(`${s}`.toLowerCase())
            );
          if (!base) return false;
          if (assignServiceType) {
            return services.length === 0 || services.includes(assignServiceType.toLowerCase());
          }
          return true;
        }
        if (lt === "workshop") {
          const typesOk = types.includes("workshop");
          const servicesOk = services.some((s: string) => `${s}`.toLowerCase() === "workshop");
          return typesOk || servicesOk || services.length === 0;
        }
        // default RSA
        if (!(types.includes("rsa") || services.length > 0 || (types.length === 0 && services.length === 0))) return false;
        if (assignServiceType) {
          return services.length === 0 || services.includes(assignServiceType.toLowerCase());
        }
        return true;
      });
      setAssignBranches(filtered);
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.loadBranches") ?? "Failed to load branches");
    }
  }

  async function loadAssignUsers(branchId: string) {
    setAssignUsers([]);
    try {
      const res = await fetch(`/api/company/${companyId}/admin/users?branchId=${branchId}`);
      if (!res.ok) throw new Error(t("leads.assign.loadUsers") ?? "Failed to load users");
      const data = await res.json();
      setAssignUsers(data.data ?? data ?? []);
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.loadUsers") ?? "Failed to load users");
    }
  }

  async function assignLead() {
    if (!assignLeadId || !assignBranchId) return;
    if (assignLeadType === "recovery" && (!assignRecoveryDirection || !assignRecoveryFlow)) return;
    if ((assignLeadType === "rsa" || assignLeadType === "workshop") && !assignUserId && assignLeadType !== "workshop") return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const currentLead = leads.find((l) => l.id === assignLeadId);
      const res = await fetch(`/api/company/${companyId}/sales/leads/${assignLeadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: assignBranchId,
          assignedUserId: assignLeadType === "workshop" ? null : assignUserId,
          serviceType: assignServiceType || (currentLead?.serviceType as any) || null,
          leadStage: assignLeadType === "workshop" ? currentLead?.leadStage ?? "assigned" : "assigned",
          recoveryDirection: assignLeadType === "recovery" ? assignRecoveryDirection : undefined,
          recoveryFlow: assignLeadType === "recovery" ? assignRecoveryFlow : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to assign lead");
      }
      setAssignSuccess(t("leads.assign.success") ?? "Lead assigned");
      // refresh leads
      const refreshed = await fetch(`/api/company/${companyId}/sales/leads`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setLeads(data.data ?? []);
      }
    } catch (err: any) {
      setAssignError(err?.message ?? t("leads.assign.error") ?? "Failed to assign lead");
    } finally {
      setAssignLoading(false);
    }
  }

  function resetAssign() {
    setAssignLeadId(null);
    setAssignLeadType(null);
    setAssignBranchId(null);
    setAssignUserId(null);
    setAssignBranches([]);
    setAssignUsers([]);
    setAssignError(null);
    setAssignSuccess(null);
    setAssignRecoveryDirection("");
    setAssignRecoveryFlow("");
  }

  useEffect(() => {
    setPage(1);
  }, [query, tab, sortKey, sortDir]);

  return (
    <MainPageShell
      title={companyName ? t("leads.company.title") ?? t("leads.title") : t("leads.title")}
      subtitle={companyName ? t("leads.company.subtitle") ?? t("leads.subtitle") : t("leads.subtitle")}
      scopeLabel={companyName ? `${t("leads.scopePrefix") ?? "Company"}: ${companyName}` : t("scope.company") ?? "Company workspace"}
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive">{t("leads.loadError") ?? "Failed to load leads. Please try again."}</p>}
      {assignError && <p className="text-sm text-destructive">{assignError}</p>}
      {assignSuccess && <p className="text-sm text-emerald-500">{assignSuccess}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
            {selected.size > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{selected.size} selected</span>
                <button
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  onClick={() => bulkAction("archive")}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.archive") ?? "Archive selected"}
                </button>
                <button
                  className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:opacity-50"
                  onClick={() => bulkAction("delete")}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.delete") ?? "Delete selected"}
                </button>
                {bulkMessage && <span className="text-xs text-muted-foreground">{bulkMessage}</span>}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">&nbsp;</span>
            )}
            <a
              href={`/company/${companyId}/leads/new`}
              className="inline-flex items-center rounded-md border border-white/30 bg-primary px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-90 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              {t("leads.create") ?? "Create Lead"}
            </a>
          </div>
          {loading && !error ? (
            <p className="text-sm text-muted-foreground">{t("leads.loading") ?? "Loading leads..."}</p>
          ) : (
            <>
              <Card className="border-0 p-0 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
                  <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
                    {tabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`rounded-md px-3 py-1.5 font-medium transition ${
                          tab === t.key
                            ? "bg-background text-foreground shadow-sm border border-border/40"
                            : "border border-transparent text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full max-w-xs">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                        <path
                          d="M15.5 15.5L21 21M10.5 18a7.5 7.5 0 1 1 0-15a7.5 7.5 0 0 1 0 15Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
                <LeadsTable
                  companyId={companyId}
                  leads={pagedLeads}
                  selectable
                  selectedIds={selected}
                  onSelectChange={toggleSelect}
                  onAssign={(id, lead) => openAssign(id, lead)}
                  onRefresh={refreshLeads}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  sortLabel={sortLabel}
                />
              </Card>
              <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
                <span>
                  Page {safePage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={safePage <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                      <path
                        d="M15 6l-6 6 6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Next
                  </button>
                </div>
              </div>
              {assignLeadId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <Card className="w-full max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-slate-950 text-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {assignLeadType === "recovery"
                            ? t("leads.assign.recovery")
                            : assignLeadType === "workshop"
                            ? t("leads.assign.workshop")
                            : t("leads.assign.rsa")}
                        </div>
                        <div className="text-xs text-white/70">
                          {assignLeadType === "workshop"
                            ? t("leads.assign.workshop.helper")
                            : t("leads.assign.helper")}
                        </div>
                      </div>
                      <button
                        className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/20 hover:shadow-md"
                        onClick={() => resetAssign()}
                      >
                        {t("leads.assign.close")}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-white">
                      <select
                        className="rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                        value={assignBranchId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setAssignBranchId(val);
                          setAssignUserId(null);
                          if (val) loadAssignUsers(val);
                          else setAssignUsers([]);
                        }}
                      >
                        <option value="">{t("leads.assign.selectBranch")}</option>
                        {assignBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.display_name || b.name || b.code || b.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                      {assignLeadType !== "workshop" && (
                        <select
                          className="rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/60"
                          value={assignUserId ?? ""}
                          onChange={(e) => setAssignUserId(e.target.value || null)}
                          disabled={!assignUsers.length}
                        >
                          <option value="">{t("leads.assign.selectUser")}</option>
                          {assignUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name || u.email} {u.last_login_at ? t("leads.assign.online") : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        className="rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                        onClick={() => assignLead()}
                        disabled={
                          !assignBranchId ||
                          assignLoading ||
                          (assignLeadType !== "workshop" && assignLeadType !== "recovery" && !assignUserId) ||
                          (assignLeadType === "recovery" && (!assignRecoveryDirection || !assignRecoveryFlow))
                        }
                      >
                        {assignLoading ? t("leads.assign.working") : t("leads.assign.submit")}
                      </button>
                    </div>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
        <aside className="space-y-3">
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("leads.ai.title")}</div>
              {loading ? (
                <div className="text-sm text-muted-foreground">{t("leads.ai.loading")}</div>
              ) : aiSuggestions.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("leads.ai.actions.empty")}</div>
              ) : (
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {aiSuggestions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
          <Card>
            <div className="space-y-2">
              <div className="text-sm font-semibold">{t("leads.ai.appreciation.title")}</div>
              <div className="text-sm text-muted-foreground">{loading ? t("leads.ai.loading") : aiAppreciation}</div>
            </div>
          </Card>
        </aside>
      </div>
    </MainPageShell>
  );
}
