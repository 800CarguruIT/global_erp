"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LeadsTable } from "../components/leads/LeadsTable";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import { useI18n } from "../i18n";

export type BranchLeadsMainProps = {
  companyId?: string | null;
  branchId?: string | null;
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

export function BranchLeadsMain({ companyId, branchId }: BranchLeadsMainProps) {
  const { t } = useI18n();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const refreshLeads = useCallback(async () => {
    if (!companyId) {
      setError(t("leads.loadError") ?? "Company is required to load leads.");
      setLoading(false);
      return;
    }
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
  }, [companyId, t]);

  useEffect(() => {
    refreshLeads();
  }, [refreshLeads]);

  const scopedLeads = useMemo(() => {
    if (!branchId) return [];
    return leads.filter((lead) => {
      const leadBranchId = lead.branchId ?? lead.branch_id ?? null;
      return leadBranchId === branchId;
    });
  }, [leads, branchId]);

  const filteredLeads = useMemo(() => {
    const term = normalize(query);
    if (!term) return scopedLeads;
    return scopedLeads.filter((lead) => {
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
  }, [scopedLeads, query]);

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

  function toggleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  useEffect(() => {
    setPage(1);
  }, [query, sortKey, sortDir]);

  if (!companyId || !branchId) {
    return (
      <MainPageShell title="Branch Leads" subtitle="Branch context missing. Please re-login." scopeLabel="Branch">
        <p className="text-sm text-destructive">Branch context is required to load leads.</p>
      </MainPageShell>
    );
  }

  return (
    <MainPageShell
      title="Branch Leads"
      subtitle="Assigned leads for this branch."
      scopeLabel="Branch workspace"
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="space-y-3">
        <Card className="border-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
            <div className="text-xs text-muted-foreground">
              {loading ? t("leads.loading") ?? "Loading leads..." : `${sortedLeads.length} leads`}
            </div>
            <div className="flex w-full max-w-md flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => refreshLeads()}
                disabled={loading}
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-md transition hover:bg-slate-50 hover:shadow-lg disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="-ml-1 mr-2 h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66M4 4v5h5M20 20v-5h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {loading ? "Refreshing" : "Refresh"}
              </button>
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
          </div>
          <LeadsTable
            companyId={companyId}
            leads={pagedLeads}
            onRefresh={refreshLeads}
            sortKey={sortKey}
            sortDir={sortDir}
            sortLabel={sortDir === "asc" ? "ASC" : "DESC"}
            onSort={toggleSort}
            renderActions={(lead) => (
              <a
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-primary hover:shadow-md"
                href={`/branches/leads/${lead.id}`}
              >
                Open
              </a>
            )}
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
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              disabled={safePage >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </MainPageShell>
  );
}
