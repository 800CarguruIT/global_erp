"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";
import type { Inspection } from "@repo/ai-core/workshop/inspections/types";

type InspectionMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function InspectionMain({ companyId, companyName }: InspectionMainProps) {
  const [state, setState] = useState<LoadState<Inspection[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed" | "cancelled">("all");

  const load = useCallback(async () => {
    setState({ status: "loading", data: null, error: null });
    try {
      const statusParam = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/company/${companyId}/workshop/inspections${statusParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const inspections: Inspection[] = json.data ?? [];
      setState({ status: "loaded", data: inspections, error: null });
    } catch (err) {
      setState({
        status: "error",
        data: null,
        error: "Failed to load inspections.",
      });
    }
  }, [companyId, statusFilter]);

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

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";

  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const inspections = state.status === "loaded" ? state.data : [];
  const filtered = useMemo(() => {
    if (!query) return inspections;
    const q = query.toLowerCase();
    return inspections.filter((insp: any) => {
      const car = insp.car ?? {};
      const customer = insp.customer ?? {};
      const hay = `${insp.id} ${insp.status} ${insp.overallHealth ?? ""} ${
        car.plate_number ?? ""
      } ${car.make ?? ""} ${car.model ?? ""} ${customer.name ?? ""} ${customer.phone ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inspections, query]);

  return (
    <MainPageShell
      title="Inspection Queue"
      subtitle="All company inspections."
      scopeLabel={scopeLabel}
      primaryAction={null}
      contentClassName="p-0 bg-transparent"
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading inspections...</p>}
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
              <select
                className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter((e.target.value as typeof statusFilter) || "all")
                }
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
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
            <div className="px-4 py-6 text-xs text-muted-foreground">No inspections found.</div>
          ) : (
            <div className="overflow-x-auto border-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Customer</th>
                    <th className="py-2 px-4 text-left">Car</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Start At</th>
                    <th className="py-2 px-4 text-left">Completed At</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                    <th className="py-2 px-4 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((insp: any) => {
                    const href = `/company/${companyId}/inspections/${insp.id}`;
                    const car = insp.car ?? {};
                    const customer = insp.customer ?? {};
                    const plate = car.plate_number ?? "N/A";
                    const carLabel =
                      [car.make, car.model, car.model_year].filter(Boolean).join(" ") || "Car";
                    const startAt = insp.startAt || insp.start_at;
                    const completedAt = insp.completeAt || insp.complete_at;
                    return (
                      <tr key={insp.id} className="border-b last:border-0">
                        <td className="py-2 pl-3 pr-4">
                          <a href={href} className="font-medium text-primary hover:underline">
                            {insp.id.slice(0, 8)}
                          </a>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div className="font-semibold">{customer.name ?? "N/A"}</div>
                          <div className="text-muted-foreground">{customer.phone ?? ""}</div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <div className="font-semibold">{plate}</div>
                          <div className="text-muted-foreground">{carLabel}</div>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              insp.status === "completed"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : insp.status === "cancelled"
                                ? "bg-rose-500/15 text-rose-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}
                          >
                            {insp.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-xs">
                          {startAt ? new Date(startAt).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          {completedAt ? new Date(completedAt).toLocaleString() : "N/A"}
                        </td>
                        <td className="py-2 px-4 text-xs text-muted-foreground">
                          {new Date(insp.updatedAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-xs">
                          <a
                            href={href}
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
