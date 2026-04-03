"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { RecoveryRequestRow } from "../components/recovery/RecoveryRequestsTable";
import { MainPageShell } from "./MainPageShell";
import Link from "next/link";

export type RecoveryRequestsMainProps = { companyId: string };

function normalize(value: string | number | null | undefined) {
  return (value ?? "").toString().trim().toLowerCase();
}

const STATUS_STEPS = ["new", "accepted", "picked_up", "dropped_off", "done"];

function getStepIndex(status: string | null | undefined, stage: string | null | undefined): number {
  const s = normalize(status);
  const st = normalize(stage);
  if (s === "done" || st === "done") return 4;
  if (st === "dropped off" || st === "dropped_off") return 3;
  if (st === "picked up" || st === "picked_up") return 2;
  if (st === "accepted" || s === "accepted") return 1;
  return 0;
}

function timeSince(date: string | null | undefined) {
  if (!date) return "";
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald-400" : "bg-muted"}`} title={s.replace("_", " ")} />
      ))}
    </div>
  );
}

function LocationLink({ location, label }: { location?: string | null; label: string }) {
  if (!location) return <span className="text-muted-foreground/30">—</span>;
  const isUrl = location.startsWith("http");
  return isUrl ? (
    <a href={location} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline truncate block max-w-[200px]" title={location}>
      {label}
    </a>
  ) : (
    <span className="text-xs text-muted-foreground truncate block max-w-[200px]" title={location}>{location}</span>
  );
}

export function RecoveryRequestsMain({ companyId }: RecoveryRequestsMainProps) {
  const [rows, setRows] = useState<RecoveryRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "pickup" | "dropoff">("all");
  const [query, setQuery] = useState("");
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
      setError(err?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { refreshRequests(); }, [refreshRequests]);

  const isPending = (r: RecoveryRequestRow) => getStepIndex(r.status, r.stage) === 0;
  const isInProgress = (r: RecoveryRequestRow) => { const s = getStepIndex(r.status, r.stage); return s >= 1 && s <= 3; };
  const isCompleted = (r: RecoveryRequestRow) => getStepIndex(r.status, r.stage) === 4;

  const pendingCount = rows.filter(isPending).length;
  const inProgressCount = rows.filter(isInProgress).length;
  const completedCount = rows.filter(isCompleted).length;

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const isToday = (r: RecoveryRequestRow) => r.createdAt ? new Date(r.createdAt).getTime() >= todayStart : false;
  const pickups = rows.filter((r) => normalize(r.type) === "pickup");
  const dropoffs = rows.filter((r) => normalize(r.type) === "dropoff");
  const todayPickups = pickups.filter(isToday).length;
  const todayDropoffs = dropoffs.filter(isToday).length;

  const filtered = useMemo(() => {
    const term = normalize(query);
    let next = rows;
    if (typeFilter !== "all") next = next.filter((r) => normalize(r.type) === typeFilter);
    if (tab === "pending") next = next.filter(isPending);
    else if (tab === "in_progress") next = next.filter(isInProgress);
    else if (tab === "completed") next = next.filter(isCompleted);
    if (term) {
      next = next.filter((r) =>
        [r.customerName, r.customerPhone, r.carPlateNumber, r.pickupLocation, r.dropoffLocation, r.type, r.status, r.stage, r.id]
          .map(normalize).join(" ").includes(term)
      );
    }
    return next.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  }, [rows, tab, typeFilter, query]);

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { setPage(1); }, [query, tab, typeFilter]);

  return (
    <MainPageShell
      title="Recovery Requests"
      subtitle="Manage vehicle pickup and dropoff recovery operations."
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { key: "all" as const, value: rows.length, label: "All", text: "text-foreground", dot: "bg-foreground/40" },
            { key: "pending" as const, value: pendingCount, label: "Pending", text: "text-amber-400", dot: "bg-amber-400" },
            { key: "in_progress" as const, value: inProgressCount, label: "In Progress", text: "text-sky-400", dot: "bg-sky-400" },
            { key: "completed" as const, value: completedCount, label: "Completed", text: "text-emerald-400", dot: "bg-emerald-400" },
          ]).map((kpi) => (
            <button
              key={kpi.key}
              onClick={() => setTab(kpi.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-4 transition active:scale-[0.97] ${
                tab === kpi.key ? "border-border/40 bg-card/60 shadow-lg" : "border-border/20 bg-card/20 opacity-50"
              }`}
            >
              <span className={`text-2xl font-extrabold ${kpi.text}`}>{kpi.value}</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${kpi.dot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Pickup / Dropoff KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-300">Today Pickup</div>
            <div className="mt-2 text-4xl font-extrabold text-blue-400">{todayPickups}</div>
          </div>
          <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-300/80">Total Pickup</div>
            <div className="mt-2 text-4xl font-extrabold text-blue-300">{pickups.length}</div>
          </div>
          <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-300">Today Dropoff</div>
            <div className="mt-2 text-4xl font-extrabold text-purple-400">{todayDropoffs}</div>
          </div>
          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-300/80">Total Dropoff</div>
            <div className="mt-2 text-4xl font-extrabold text-purple-300">{dropoffs.length}</div>
          </div>
        </div>

        {/* Type filter + Search + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border bg-card/30 p-0.5">
            {([
              { key: "all" as const, label: "All" },
              { key: "pickup" as const, label: "Pickup" },
              { key: "dropoff" as const, label: "Dropoff" },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  typeFilter === t.key ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, plate, location..."
            className="flex-1 min-w-[200px] rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none"
          />
          <button
            onClick={() => refreshRequests()}
            disabled={loading}
            className="rounded-xl border border-border bg-card/40 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>

        {/* Desktop Table */}
        {loading && !rows.length ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading recovery requests...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-2">🚛</div>
            <div className="text-sm text-muted-foreground">No {tab === "all" ? "" : tab.replace("_", " ")} recovery requests</div>
          </div>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Car</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Progress</th>
                    <th className="px-4 py-3 text-left">Pickup</th>
                    <th className="px-4 py-3 text-left">Dropoff</th>
                    <th className="px-4 py-3 text-left">Assigned</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row, idx) => {
                    const step = getStepIndex(row.status, row.stage);
                    const isPickup = normalize(row.type) === "pickup";
                    const typeColor = isPickup ? "text-blue-400 bg-blue-500/15 border-blue-500/20" : "text-purple-400 bg-purple-500/15 border-purple-500/20";
                    const stageLabel = STATUS_STEPS[step]?.replace("_", " ") ?? "new";

                    return (
                      <tr key={row.id} className={`transition hover:bg-muted/30 ${idx < paged.length - 1 ? "border-b border-border/60" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.customerName ?? "Unknown"}</div>
                          {row.customerPhone && <div className="text-xs text-muted-foreground font-mono">{row.customerPhone}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.carPlateNumber ? (
                            <div>
                              <div>{row.carPlateNumber}</div>
                              {(row.carMake || row.carModel) && <div className="text-muted-foreground/60">{[row.carMake, row.carModel].filter(Boolean).join(" ")}</div>}
                            </div>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${typeColor}`}>
                            {row.type ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <ProgressBar step={step} />
                          <div className="mt-1 text-[10px] text-muted-foreground capitalize">{stageLabel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <LocationLink location={row.pickupLocation} label="Open Pickup" />
                        </td>
                        <td className="px-4 py-3">
                          <LocationLink location={row.dropoffLocation} label="Open Dropoff" />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.assignedTo ?? <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {timeSince(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={async (e) => {
                              const btn = e.currentTarget;
                              btn.textContent = "...";
                              try {
                                const res = await fetch(`/api/company/${companyId}/sales/leads/${row.leadId}/share`, { method: "POST" });
                                const data = await res.json();
                                const url = data?.url ?? `${window.location.origin}/company/${companyId}/leads/${row.leadId}`;
                                await navigator.clipboard.writeText(url);
                                btn.textContent = "Copied!";
                                setTimeout(() => { btn.textContent = "Share"; }, 2000);
                              } catch {
                                btn.textContent = "Failed";
                                setTimeout(() => { btn.textContent = "Share"; }, 2000);
                              }
                            }}
                            className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            Share
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden grid gap-3">
              {paged.map((row) => {
                const step = getStepIndex(row.status, row.stage);
                const isPickup = normalize(row.type) === "pickup";
                const typeColor = isPickup ? "text-blue-400 bg-blue-500/15 border-blue-500/20" : "text-purple-400 bg-purple-500/15 border-purple-500/20";

                return (
                  <div key={row.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/30 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold text-foreground truncate">{row.customerName ?? "Unknown"}</div>
                        {row.customerPhone && <div className="text-xs text-muted-foreground font-mono">{row.customerPhone}</div>}
                      </div>
                      <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase ${typeColor}`}>{row.type ?? "—"}</span>
                    </div>
                    {row.carPlateNumber && <div className="text-xs text-muted-foreground">🚘 {row.carPlateNumber}</div>}
                    <ProgressBar step={step} />
                    {row.pickupLocation && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="text-blue-400">↑</span>
                        <span className="truncate flex-1">{row.pickupLocation}</span>
                      </div>
                    )}
                    {row.dropoffLocation && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-card/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="text-purple-400">↓</span>
                        <span className="truncate flex-1">{row.dropoffLocation}</span>
                      </div>
                    )}
                    <div className="flex gap-2 pt-1 mt-auto">
                      {row.customerPhone && (
                        <a href={`tel:${row.customerPhone}`} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400">
                          📞 Call
                        </a>
                      )}
                      <Link
                        href={`/company/${companyId}/leads/${row.leadId}`}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-border bg-card/40 py-2.5 text-xs font-semibold text-foreground/70"
                      >
                        View Lead
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1 py-3 text-xs text-muted-foreground">
                <span>Page {safePage} of {totalPages} · {filtered.length} requests</span>
                <div className="flex gap-2">
                  <button disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs disabled:opacity-30">Prev</button>
                  <button disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-border bg-card/40 px-3 py-1.5 text-xs disabled:opacity-30">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainPageShell>
  );
}