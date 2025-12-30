"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LeadsTable } from "../components/leads/LeadsTable";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import { Card } from "../components/Card";

export type LeadsMainProps = {
  companyId: string;
  companyName?: string;
};

export function LeadsMain({ companyId, companyName }: LeadsMainProps) {
  const { card, cardBorder } = useTheme();
  const { t } = useI18n();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "rsa" | "recovery" | "workshop">("all");
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

  const filteredLeads = tab === "all" ? leads : leads.filter((l) => l.leadType === tab);
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

  async function openAssign(leadId: string, lead?: any) {
    setAssignLeadId(leadId);
    const lt = (lead?.leadType as "rsa" | "recovery" | "workshop" | undefined) ?? null;
    if (lt === "workshop" && lead?.leadStage !== "inspection_queue") {
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
        const types = (b.branch_types ?? []).map((t: string) => t.toLowerCase());
        const services = (b.service_types ?? []).map((s: string) => s.toLowerCase());
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
        if (!(types.includes("rsa") || services.length > 0)) return false;
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

  return (
    <MainPageShell
      title={companyName ? t("leads.company.title") ?? t("leads.title") : t("leads.title")}
      subtitle={companyName ? t("leads.company.subtitle") ?? t("leads.subtitle") : t("leads.subtitle")}
      scopeLabel={companyName ? `${t("leads.scopePrefix") ?? "Company"}: ${companyName}` : t("scope.company") ?? "Company workspace"}
      primaryAction={
        <a
          href={`/company/${companyId}/leads/new`}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          {t("leads.create") ?? "Create Lead"}
        </a>
      }
    >
      {error && <p className="text-sm text-destructive">{t("leads.loadError") ?? "Failed to load leads. Please try again."}</p>}
      {assignError && <p className="text-sm text-destructive">{assignError}</p>}
      {assignSuccess && <p className="text-sm text-emerald-500">{assignSuccess}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
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
      </div>

      <div className="flex flex-wrap gap-2 pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tab === t.key ? "border-primary text-primary" : "hover:border-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading && !error ? (
        <p className="text-sm text-muted-foreground">{t("leads.loading") ?? "Loading leads..."}</p>
      ) : (
        <>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 pb-3 text-sm">
              <span className="text-muted-foreground">{selected.size} selected</span>
              <button
                className={`rounded-md border px-2 py-1 disabled:opacity-50 ${cardBorder}`}
                onClick={() => bulkAction("archive")}
                disabled={bulkWorking}
              >
                {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.archive") ?? "Archive selected"}
              </button>
              <button
                className="rounded-md border border-destructive px-2 py-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                onClick={() => bulkAction("delete")}
                disabled={bulkWorking}
              >
                {bulkWorking ? t("leads.working") ?? "Working..." : t("leads.bulk.delete") ?? "Delete selected"}
              </button>
              {bulkMessage && <span className="text-xs text-muted-foreground">{bulkMessage}</span>}
            </div>
          )}
          <div className={`${card} ${cardBorder} rounded-2xl p-2`}>
            <LeadsTable
              companyId={companyId}
              leads={filteredLeads}
              selectable
              selectedIds={selected}
              onSelectChange={toggleSelect}
              onAssign={(id, lead) => openAssign(id, lead)}
              onRefresh={refreshLeads}
            />
          </div>
          {assignLeadId && (
            <Card className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {assignLeadType === "recovery"
                      ? t("leads.assign.recovery")
                      : assignLeadType === "workshop"
                      ? t("leads.assign.workshop")
                      : t("leads.assign.rsa")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {assignLeadType === "workshop"
                      ? t("leads.assign.workshop.helper")
                      : t("leads.assign.helper")}
                  </div>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => resetAssign()}>
                  {t("leads.assign.close")}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded border px-3 py-2 text-sm"
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
                    className="rounded border px-3 py-2 text-sm"
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
          )}
        </>
      )}
    </MainPageShell>
  );
}
