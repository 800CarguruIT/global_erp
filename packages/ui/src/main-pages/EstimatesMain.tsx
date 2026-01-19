"use client";

import React, { useEffect, useState } from "react";
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
      } catch (err) {
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

  return (
    <MainPageShell
      title="Estimates"
      subtitle="Parts and labor estimates generated from inspections."
      scopeLabel={scopeLabel}
      primaryAction={
        <a href={`/company/${companyId}/workshop/inspections`} className="rounded-md border px-3 py-1 text-sm font-medium">
          Back to Inspections
        </a>
      }
    >
      <div className="flex flex-wrap items-center gap-2 py-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`rounded-full border px-3 py-1 text-xs ${
              statusFilter === tab.id ? "border-primary text-primary" : "hover:border-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading estimates...</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {!isLoading && !loadError && (
        <>
          {estimates.length === 0 ? (
            <p className="text-xs text-muted-foreground">No estimates found for this company.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="py-2 pl-3 pr-4 text-left">Estimate</th>
                    <th className="py-2 px-4 text-left">Inspection</th>
                    <th className="py-2 px-4 text-left">Status</th>
                    <th className="py-2 px-4 text-left">Total sale</th>
                    <th className="py-2 px-4 text-left">Final price</th>
                    <th className="py-2 px-4 text-left">VAT</th>
                    <th className="py-2 px-4 text-left">Grand total</th>
                    <th className="py-2 px-4 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((est) => {
                    const href = `/company/${companyId}/workshop/estimates/${est.id}`;
                    return (
                      <tr key={est.id} className="border-b last:border-0">
                        <td className="py-2 pl-3 pr-4">
                          <a href={href} className="font-medium text-primary hover:underline">
                            {est.id.slice(0, 8)}...
                          </a>
                        </td>
                        <td className="py-2 px-4 text-xs">{est.inspectionId.slice(0, 8)}...</td>
                        <td className="py-2 px-4 text-xs capitalize">{est.status.replace("_", " ")}</td>
                        <td className="py-2 px-4 text-xs">{est.totalSale.toFixed(2)}</td>
                        <td className="py-2 px-4 text-xs">{est.finalPrice.toFixed(2)}</td>
                        <td className="py-2 px-4 text-xs">
                          {est.vatRate}% ({est.vatAmount.toFixed(2)})
                        </td>
                        <td className="py-2 px-4 text-xs">{est.grandTotal.toFixed(2)}</td>
                        <td className="py-2 px-4 text-[11px] text-muted-foreground">
                          {new Date(est.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </MainPageShell>
  );
}
