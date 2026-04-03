"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Estimate, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

type EstimatesMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function EstimatesMain({ companyId, companyName }: EstimatesMainProps) {
  const [state, setState] = useState<LoadState<Estimate[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<"10" | "25" | "50" | "100" | "all">("25");
  const [page, setPage] = useState(1);

  const statusTabs: Array<{ id: EstimateStatus | "all"; label: string }> = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "pending_approval", label: "Pending approval" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "cancelled", label: "Cancelled" },
  ];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const qs = statusFilter === "all" ? "" : `?status=${statusFilter}`;
        const res = await fetch(`/api/company/${companyId}/workshop/estimates${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const estimates: Estimate[] = json.data ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: estimates, error: null });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load estimates." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, statusFilter]);

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const estimates = state.status === "loaded" ? state.data : [];
  const kpis = useMemo(() => {
    let draft = 0;
    let finalized = 0;
    let grandTotal = 0;
    for (const est of estimates) {
      const status = String(est.status ?? "").toLowerCase();
      if (status === "draft") draft += 1;
      if (status === "finalized" || status === "approved") finalized += 1;
      grandTotal += Number(est.grandTotal ?? 0);
    }
    return {
      total: estimates.length,
      draft,
      finalized,
      grandTotal,
      avgTicket: estimates.length > 0 ? grandTotal / estimates.length : 0,
    };
  }, [estimates]);

  const filteredEstimates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estimates;
    return estimates.filter((est) => {
      const haystack = [
        est.id,
        est.inspectionId,
        est.status,
        String(est.totalSale ?? 0),
        String(est.finalPrice ?? 0),
        String(est.grandTotal ?? 0),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [estimates, search]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === "all") return 1;
    const size = Number(pageSize);
    return Math.max(1, Math.ceil(filteredEstimates.length / size));
  }, [filteredEstimates.length, pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const pagedEstimates = useMemo(() => {
    if (pageSize === "all") return filteredEstimates;
    const size = Number(pageSize);
    const start = (page - 1) * size;
    return filteredEstimates.slice(start, start + size);
  }, [filteredEstimates, page, pageSize]);

  const pageItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <MainPageShell
      title="Estimates"
      subtitle="Parts and labor estimates generated from inspections."
      scopeLabel={scopeLabel}
      contentClassName="border-0 bg-transparent p-0"
      primaryAction={
        <a href={`/company/${companyId}/workshop/inspections`} className="rounded-md border px-3 py-1 text-sm font-medium">
          Back to Inspections
        </a>
      }
    >
      <div className="rounded-xl border border-border bg-card/40 p-3">
        <div className="overflow-x-auto py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/80">
          <div className="flex min-w-max flex-nowrap gap-2 text-xs">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-w-[96px] shrink-0 rounded-full px-4 py-1.5 text-[11px] font-medium transition ${
                  statusFilter === tab.id
                    ? "bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.35)] border border-emerald-400/40"
                    : "bg-muted/40 text-foreground/70 border border-border hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md border border-border bg-gradient-to-b from-card/55 to-card/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Estimates</div>
            <div className="text-base font-semibold text-foreground">{isLoading ? "..." : kpis.total}</div>
          </div>
          <div className="rounded-md border border-border bg-gradient-to-b from-card/55 to-card/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Draft</div>
            <div className="text-base font-semibold text-foreground">{isLoading ? "..." : kpis.draft}</div>
          </div>
          <div className="rounded-md border border-border bg-gradient-to-b from-card/55 to-card/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Finalized</div>
            <div className="text-base font-semibold text-foreground">{isLoading ? "..." : kpis.finalized}</div>
          </div>
          <div className="rounded-md border border-border bg-gradient-to-b from-card/55 to-card/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Grand Total</div>
            <div className="text-base font-semibold text-foreground">
              {isLoading ? "..." : formatCurrency(kpis.grandTotal)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-gradient-to-b from-card/55 to-card/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg Ticket</div>
            <div className="text-base font-semibold text-foreground">
              {isLoading ? "..." : formatCurrency(kpis.avgTicket)}
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-12">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search estimate, inspection, status, totals"
            className="h-10 rounded-md border border-primary/40 bg-card/40 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring md:col-span-10"
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Rows</span>
            <select
              className="h-10 w-full rounded-md border border-primary/40 bg-card/40 px-2 text-sm text-foreground outline-none focus:border-ring md:col-span-2"
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as "10" | "25" | "50" | "100" | "all")}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading estimates...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!isLoading && !loadError && (
          <>
            {filteredEstimates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No estimates found for this company.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-foreground/70">
                  Showing {pagedEstimates.length} of {filteredEstimates.length} estimates
                </div>

                <div className="hidden max-h-[620px] overflow-auto rounded-md border border-border bg-card/40 md:block">
                  <table className="min-w-full table-fixed text-xs">
                    <thead className="sticky top-0 z-20 bg-card text-foreground/85">
                      <tr className="border-b border-border">
                        <th className="w-[200px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Estimate</th>
                        <th className="w-[180px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Inspection</th>
                        <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Status</th>
                        <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Total Sale</th>
                        <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Final Price</th>
                        <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">VAT</th>
                        <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Grand Total</th>
                        <th className="w-[180px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEstimates.map((est, idx) => {
                        const href = `/company/${companyId}/estimates/${est.id}`;
                        return (
                          <tr key={est.id} className={`border-b border-border text-foreground/85 hover:bg-muted/30 ${idx % 2 === 0 ? "bg-muted/10" : ""}`}>
                            <td className="px-3 py-2">
                              <a
                                href={href}
                                className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/80 hover:bg-muted"
                              >
                                View
                              </a>
                            </td>
                            <td className="px-3 py-2">{est.inspectionId.slice(0, 8)}...</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estimateStatusBadgeClass(est.status)}`}>
                                {titleize(est.status)}
                              </span>
                            </td>
                            <td className="px-3 py-2">{formatCurrency(est.totalSale)}</td>
                            <td className="px-3 py-2">{formatCurrency(est.finalPrice)}</td>
                            <td className="px-3 py-2">
                              {est.vatRate}% ({est.vatAmount.toFixed(2)})
                            </td>
                            <td className="px-3 py-2">{formatCurrency(est.grandTotal)}</td>
                            <td className="px-3 py-2 text-foreground/70">{new Date(est.updatedAt).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 md:hidden">
                  {pagedEstimates.map((est) => {
                    const href = `/company/${companyId}/estimates/${est.id}`;
                    return (
                      <div key={est.id} className="space-y-2 rounded-md border border-border bg-card/50 px-3 py-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estimateStatusBadgeClass(est.status)}`}>
                            {titleize(est.status)}
                          </span>
                          <a
                            href={href}
                            className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70 hover:bg-muted"
                          >
                            View
                          </a>
                        </div>
                        <div className="text-foreground/75">Inspection: {est.inspectionId.slice(0, 8)}...</div>
                        <div className="text-foreground/70">Total Sale: {formatCurrency(est.totalSale)}</div>
                        <div className="text-foreground/70">Final Price: {formatCurrency(est.finalPrice)}</div>
                        <div className="text-foreground/70">Grand Total: {formatCurrency(est.grandTotal)}</div>
                        <div className="text-muted-foreground">Updated: {new Date(est.updatedAt).toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground/70 disabled:opacity-50"
                      disabled={page <= 1}
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      Prev
                    </button>
                    {pageItems.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md px-2 py-1 text-[11px] ${item === page ? "bg-primary text-foreground" : "border border-border text-foreground/70"}`}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground/70 disabled:opacity-50"
                      disabled={page >= totalPages}
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </MainPageShell>
  );
}

function titleize(value?: string | null) {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function estimateStatusBadgeClass(value?: string | null) {
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "finalized" || normalized === "approved") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-400/35";
  }
  if (normalized === "cancelled" || normalized === "rejected") {
    return "bg-rose-500/15 text-rose-300 border-rose-400/35";
  }
  if (normalized === "draft" || normalized === "pending_approval") {
    return "bg-amber-500/15 text-amber-300 border-amber-400/35";
  }
  return "bg-slate-500/15 text-slate-300 border-slate-400/35";
}

function formatCurrency(value?: number | null) {
  const amount = Number(value ?? 0);
  return `AED ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}
