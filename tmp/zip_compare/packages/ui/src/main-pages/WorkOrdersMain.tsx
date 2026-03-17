"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { WorkOrder, WorkOrderStatus } from "@repo/ai-core/workshop/workorders/types";

type WorkOrdersMainProps = {
  companyId: string;
  companyName?: string;
  branchId?: string | null;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function WorkOrdersMain({ companyId, companyName, branchId }: WorkOrdersMainProps) {
  const [state, setState] = useState<LoadState<WorkOrder[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (branchId) params.set("branchId", branchId);
        const qs = params.toString();
        const res = await fetch(`/api/company/${companyId}/workshop/workorders${qs ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data: WorkOrder[] = json.data ?? [];
        if (!cancelled) setState({ status: "loaded", data, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load work orders." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, statusFilter]);

  const scopeLabel = branchId
    ? `Branch: ${branchId}`
    : companyName
    ? `Company: ${companyName}`
    : "Company workspace";
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell
      title="Work Orders"
      subtitle="Track jobs moving into workshop execution."
      scopeLabel={scopeLabel}
    >
      <div className="flex items-center gap-3 py-2">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as WorkOrderStatus | "all")}
        >
          <option value="all">All</option>
          <option value="quoting">Quoting</option>
          <option value="queue">Queue</option>
          <option value="waiting_parts">Waiting parts</option>
          <option value="ready">Ready</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading work orders…</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!isLoading && !loadError && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">Work Order</th>
                <th className="py-2 px-4 text-left">Estimate</th>
                {!branchId && <th className="py-2 px-4 text-left">Branch</th>}
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Queue reason</th>
                <th className="py-2 px-4 text-left">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={branchId ? 5 : 6} className="py-3 text-center text-xs text-muted-foreground">
                    No work orders found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const href = `/company/${companyId}/workshop/workorders/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <a href={href} className="font-medium text-primary hover:underline">
                          {row.id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.estimateId.slice(0, 8)}…</td>
                      {!branchId && <td className="py-2 px-4 text-xs">{row.branchId ?? "-"}</td>}
                      <td className="py-2 px-4 text-xs capitalize">{row.status.replace("_", " ")}</td>
                      <td className="py-2 px-4 text-xs">{row.queueReason ?? "-"}</td>
                      <td className="py-2 px-4 text-[11px] text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </MainPageShell>
  );
}

