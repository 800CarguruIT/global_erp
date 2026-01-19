"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";
import { Card } from "../components/Card";

type JobCardsMainProps = {
  companyId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type JobCardRow = {
  id: string;
  status: string;
  estimate_id?: string | null;
  lead_id?: string | null;
  start_at?: string | null;
  complete_at?: string | null;
  created_at?: string | null;
  branch_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  plate_number?: string | null;
  make?: string | null;
  model?: string | null;
};

export function JobCardsMain({ companyId }: JobCardsMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<JobCardRow[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/job-cards`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setState({ status: "loaded", data: json.data ?? [], error: null });
    } catch (err) {
      setState({ status: "error", data: null, error: "Failed to load job cards." });
    }
  }, [companyId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const rows = state.status === "loaded" ? state.data : [];
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => {
      const hay = [
        row.id,
        row.customer_name,
        row.customer_phone,
        row.plate_number,
        row.make,
        row.model,
        row.branch_name,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const statusCounts = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const key = (row.status ?? "Pending").toLowerCase();
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [rows]);

  function statusClass(status: string) {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-emerald-500/15 text-emerald-400";
      case "pending":
        return "bg-amber-500/15 text-amber-400";
      default:
        return "bg-slate-500/15 text-slate-300";
    }
  }

  return (
    <MainPageShell
      title="Job Cards"
      subtitle=""
      scopeLabel=""
      primaryAction={
        <span className="text-xs text-muted-foreground">
          Pending: {statusCounts.pending ?? 0} · Completed: {statusCounts.completed ?? 0}
        </span>
      }
      contentClassName="p-0 bg-transparent"
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading job cards…</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!isLoading && !loadError && (
        <Card className="border-0 p-0 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                onClick={() => load()}
              >
                Refresh
              </button>
              <span className="text-xs text-muted-foreground">{filtered.length} job cards</span>
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
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-xs text-muted-foreground">No job cards yet.</div>
          ) : (
            <div className="overflow-x-auto border-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Customer Details</th>
                    <th className="py-2 px-4 text-left">Car Details</th>
                    <th className="py-2 px-4 text-left">Job Start Time</th>
                    <th className="py-2 px-4 text-left">Completed Time</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const detailHref = `/company/${companyId}/workshop/job-cards/${row.id}`;
                    const carLabel = [row.make, row.model].filter(Boolean).join(" ");
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 px-4">
                          <div className="text-sm">{row.customer_name ?? "N/A"}</div>
                          {row.customer_phone && (
                            <div className="text-xs text-muted-foreground">{row.customer_phone}</div>
                          )}
                          <div className="text-[10px] uppercase text-muted-foreground">
                            Lead {row.lead_id?.slice(0, 8) ?? "-"}
                          </div>
                        </td>
                        <td className="py-2 px-4">
                          <div className="text-sm">{row.plate_number ?? "N/A"}</div>
                          {carLabel && <div className="text-xs text-muted-foreground">{carLabel}</div>}
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {row.branch_name ?? "Unassigned"}
                          </div>
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {row.start_at ? new Date(row.start_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {row.complete_at ? new Date(row.complete_at).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(row.status ?? "Pending")}`}>
                            {row.status ?? "Pending"}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <a
                            href={detailHref}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </MainPageShell>
  );
}
