"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RecoveryRequestsTable } from "../components/recovery/RecoveryRequestsTable";
import type { RecoveryRequestRow } from "../components/recovery/RecoveryRequestsTable";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";

export type RecoveryRequestsMainProps = {
  companyId: string;
};

type SortKey = "created" | "customer" | "car" | "status" | "stage" | "type";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function normalize(value: string | number | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

export function RecoveryRequestsMain({ companyId }: RecoveryRequestsMainProps) {
  const [rows, setRows] = useState<RecoveryRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "pickup" | "dropoff">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const refreshRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/recovery-requests`);
      if (!res.ok) throw new Error("Failed to load recovery requests");
      const data = await res.json();
      setRows(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load recovery requests");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  const filteredRows = useMemo(() => {
    const term = normalize(query);
    let next =
      tab === "all"
        ? rows
        : rows.filter((r) => normalize(r.type) === tab);

    if (!term) return next;

    return next.filter((row) => {
      const haystack = [
        row.id,
        row.leadId,
        row.customerName,
        row.customerPhone,
        row.carPlateNumber,
        row.carMake,
        row.carModel,
        row.pickupLocation,
        row.dropoffLocation,
        row.status,
        row.stage,
        row.type,
      ]
        .map(normalize)
        .join(" ");
      return haystack.includes(term);
    });
  }, [rows, tab, query]);

  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "customer":
          return dir * collator.compare(normalize(a.customerName), normalize(b.customerName));
        case "car":
          return dir * collator.compare(normalize(a.carPlateNumber), normalize(b.carPlateNumber));
        case "status":
          return dir * collator.compare(normalize(a.status), normalize(b.status));
        case "stage":
          return dir * collator.compare(normalize(a.stage), normalize(b.stage));
        case "type":
          return dir * collator.compare(normalize(a.type), normalize(b.type));
        case "created": {
          const left = new Date(a.createdAt ?? 0).getTime();
          const right = new Date(b.createdAt ?? 0).getTime();
          return dir * (left - right);
        }
        default:
          return 0;
      }
    });
    return list;
  }, [filteredRows, sortDir, sortKey]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

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
  }, [query, tab, sortKey, sortDir]);

  const sortLabel = sortDir === "asc" ? "ASC" : "DESC";

  const now = useMemo(() => new Date(), []);
  const todayKey = now.toDateString();
  const tomorrowKey = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString();

  function isToday(value?: string | null) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toDateString() === todayKey;
  }

  function isTomorrow(value?: string | null) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toDateString() === tomorrowKey;
  }

  const metrics = useMemo(() => {
    const base = {
      todayPickups: 0,
      todayDropoffs: 0,
      totalPickups: 0,
      totalDropoffs: 0,
      total: rows.length,
    };
    rows.forEach((r) => {
      const type = (r.type ?? "").toLowerCase();
      const createdAt = r.createdAt ?? null;
      if (type === "pickup") {
        base.totalPickups += 1;
        if (isToday(createdAt)) base.todayPickups += 1;
      } else if (type === "dropoff") {
        base.totalDropoffs += 1;
        if (isToday(createdAt)) base.todayDropoffs += 1;
      }
    });
    return base;
  }, [rows, todayKey]);

  const statusPanels = useMemo(() => {
    const data = {
      pending: { pickup: 0, dropoff: 0, total: 0 },
      today: { pickup: 0, dropoff: 0, total: 0 },
      tomorrow: { pickup: 0, dropoff: 0, total: 0 },
      completed: { pickup: 0, dropoff: 0, total: 0 },
    };
    rows.forEach((r) => {
      const type = (r.type ?? "").toLowerCase();
      const status = (r.status ?? "").toLowerCase();
      const createdAt = r.createdAt ?? null;
      const isDone = status === "done";
      if (status === "pending") {
        data.pending.total += 1;
        if (type === "pickup") data.pending.pickup += 1;
        if (type === "dropoff") data.pending.dropoff += 1;
      }
      if (isToday(createdAt)) {
        data.today.total += 1;
        if (type === "pickup") data.today.pickup += 1;
        if (type === "dropoff") data.today.dropoff += 1;
      }
      if (isTomorrow(createdAt)) {
        data.tomorrow.total += 1;
        if (type === "pickup") data.tomorrow.pickup += 1;
        if (type === "dropoff") data.tomorrow.dropoff += 1;
      }
      if (isDone && isToday(createdAt)) {
        data.completed.total += 1;
        if (type === "pickup") data.completed.pickup += 1;
        if (type === "dropoff") data.completed.dropoff += 1;
      }
    });
    return data;
  }, [rows, todayKey, tomorrowKey]);

  return (
    <MainPageShell
      title="Recovery Requests"
      subtitle="Track pickup and dropoff recovery requests in one place."
      scopeLabel="Company workspace"
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-[220px_repeat(5,minmax(0,1fr))]">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 text-sm text-muted-foreground">
            Today Pickup Recovery Leads.
          </div>
          <div className="rounded-lg bg-cyan-600/90 p-4 text-white shadow-sm">
            <div className="text-lg font-semibold">Today Pickups</div>
            <div className="mt-2 text-2xl font-bold">{metrics.todayPickups}</div>
          </div>
          <div className="rounded-lg bg-amber-400 p-4 text-slate-900 shadow-sm">
            <div className="text-lg font-semibold">Today Drop offs</div>
            <div className="mt-2 text-2xl font-bold">{metrics.todayDropoffs}</div>
          </div>
          <div className="rounded-lg bg-cyan-600/90 p-4 text-white shadow-sm">
            <div className="text-lg font-semibold">Total Pickups</div>
            <div className="mt-2 text-2xl font-bold">{metrics.totalPickups}</div>
          </div>
          <div className="rounded-lg bg-amber-400 p-4 text-slate-900 shadow-sm">
            <div className="text-lg font-semibold">Total Drop offs</div>
            <div className="mt-2 text-2xl font-bold">{metrics.totalDropoffs}</div>
          </div>
          <div className="rounded-lg bg-slate-800 p-4 text-white shadow-sm">
            <div className="text-lg font-semibold">Total</div>
            <div className="mt-2 text-2xl font-bold">{metrics.total}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-cyan-700/90 p-3 text-white shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
            {[
              { label: "Pending", data: statusPanels.pending },
              { label: "Today", data: statusPanels.today },
              { label: "Tomorrow", data: statusPanels.tomorrow },
              { label: "Today Completed", data: statusPanels.completed },
            ].map((panel) => (
              <div key={panel.label} className="rounded-md border border-white/20 bg-white/10 p-3">
                <div className="text-sm font-semibold">{panel.label}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md border border-white/20 bg-white/10 p-2">
                    <div className="font-semibold">Pickup</div>
                    <div className="text-lg font-bold">{panel.data.pickup}</div>
                  </div>
                  <div className="rounded-md border border-white/20 bg-white/10 p-2">
                    <div className="font-semibold">Dropoff</div>
                    <div className="text-lg font-bold">{panel.data.dropoff}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-white/80">Total: {panel.data.total}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <span className="text-xs text-muted-foreground">&nbsp;</span>
          <div className="flex items-center gap-2">
            <a
              href={`/company/${companyId}/recovery-requests/summary`}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
            >
              Recovery Summary
            </a>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md"
              onClick={refreshRequests}
              disabled={loading}
            >
              {loading ? "Working..." : "Refresh"}
            </button>
          </div>
        </div>

        {loading && !error ? (
          <p className="text-sm text-muted-foreground">Loading recovery requests...</p>
        ) : (
          <>
            <Card className="border-0 p-0 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
                <div className="inline-flex rounded-lg bg-muted/40 p-1 text-xs">
                  {[
                    { key: "all", label: "All" },
                    { key: "pickup", label: "Pickup" },
                    { key: "dropoff", label: "Dropoff" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTab(t.key as any)}
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
              <RecoveryRequestsTable
                companyId={companyId}
                rows={pagedRows}
                onVerified={refreshRequests}
                sortKey={sortKey}
                sortDir={sortDir}
                sortLabel={sortLabel}
                onSort={toggleSort}
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
          </>
        )}
      </div>
    </MainPageShell>
  );
}
