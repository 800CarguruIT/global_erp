"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { PartsRequirementRow } from "@repo/ai-core/workshop/parts/types";
import { MainPageShell } from "./MainPageShell";

type PartsMainProps = {
  companyId: string;
  companyName?: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function PartsMain({ companyId, companyName }: PartsMainProps) {
  const [state, setState] = useState<LoadState<PartsRequirementRow[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [showReceiveFor, setShowReceiveFor] = useState<string | null>(null);
  const [showIssueFor, setShowIssueFor] = useState<string | null>(null);
  const [formState, setFormState] = useState<any>({
    partNumber: "",
    brand: "",
    description: "",
    quantity: 1,
    costPerUnit: "",
    issueQty: 1,
  });
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/parts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: PartsRequirementRow[] = json.data ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: rows, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load parts." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const scopeLabel = companyName ? `Company: ${companyName}` : "Company workspace";
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  const waitingCount = useMemo(() => rows.filter((r) => r.procurementStatus === "pending").length, [rows]);

  async function handleReceive(row: PartsRequirementRow) {
    setActionError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/parts/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateItemId: row.estimateItemId,
          partNumber: formState.partNumber,
          brand: formState.brand,
          description: formState.description,
          quantity: Number(formState.quantity) || 0,
          costPerUnit: formState.costPerUnit ? Number(formState.costPerUnit) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setActionError("Receive failed");
    }
  }

  async function handleIssue(row: PartsRequirementRow) {
    setActionError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/parts/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateItemId: row.estimateItemId,
          quantity: Number(formState.issueQty) || 0,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setActionError("Issue failed");
    }
  }

  function openReceive(row: PartsRequirementRow) {
    setShowIssueFor(null);
    setShowReceiveFor(row.estimateItemId);
    setFormState({
      ...formState,
      partNumber: row.partNumber ?? "",
      brand: row.partBrand ?? "",
      description: row.partName,
      quantity: row.quantity - row.receivedQty,
      costPerUnit: "",
    });
  }

  function openIssue(row: PartsRequirementRow) {
    setShowReceiveFor(null);
    setShowIssueFor(row.estimateItemId);
    setFormState({
      ...formState,
      issueQty: row.quantity - row.issuedQty,
    });
  }

  return (
    <MainPageShell
      title="Parts & Inventory"
      subtitle="Track approved estimate items, receipts, and issues."
      scopeLabel={scopeLabel}
      primaryAction={
        <span className="text-xs text-muted-foreground">
          Waiting for parts: {waitingCount}
        </span>
      }
    >
      {isLoading && <p className="text-sm text-muted-foreground">Loading parts…</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!isLoading && !loadError && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">Estimate</th>
                <th className="py-2 px-4 text-left">Part</th>
                <th className="py-2 px-4 text-left">Brand</th>
                <th className="py-2 px-4 text-left">SKU</th>
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-left">Required</th>
                <th className="py-2 px-4 text-left">Received</th>
                <th className="py-2 px-4 text-left">Issued</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-3 text-center text-xs text-muted-foreground">
                    No parts requirements yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const estimateHref = `/company/${companyId}/workshop/estimates/${row.estimateId}`;
                  return (
                    <tr key={row.estimateItemId} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4 text-xs">
                        <a href={estimateHref} className="font-medium text-primary hover:underline">
                          {row.estimateId.slice(0, 8)}…
                        </a>
                        {row.inspectionId && (
                          <div className="text-[11px] text-muted-foreground">
                            Insp: {row.inspectionId.slice(0, 8)}…
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-sm">
                        <div className="font-medium">{row.partName}</div>
                        {row.partNumber && (
                          <div className="text-[11px] text-muted-foreground">No: {row.partNumber}</div>
                        )}
                      </td>
                      <td className="py-2 px-4 text-xs">{row.partBrand ?? "—"}</td>
                      <td className="py-2 px-4 text-xs">{row.partSku ?? "—"}</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.type}</td>
                      <td className="py-2 px-4 text-xs">{row.quantity}</td>
                      <td className="py-2 px-4 text-xs">{row.receivedQty}</td>
                      <td className="py-2 px-4 text-xs">{row.issuedQty}</td>
                      <td className="py-2 px-4 text-xs capitalize">
                        <StatusBadge status={row.procurementStatus} />
                      </td>
                      <td className="py-2 px-4 text-xs">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-[11px]"
                            onClick={() => openReceive(row)}
                          >
                            Receive
                          </button>
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-[11px]"
                            onClick={() => openIssue(row)}
                            disabled={row.receivedQty <= 0}
                          >
                            Issue
                          </button>
                        </div>
                        {showReceiveFor === row.estimateItemId && (
                          <div className="mt-2 space-y-1 rounded-md border p-2">
                            <h4 className="text-[11px] font-semibold">Receive</h4>
                            <input
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Part number"
                              value={formState.partNumber}
                              onChange={(e) => setFormState({ ...formState, partNumber: e.target.value })}
                            />
                            <input
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Brand"
                              value={formState.brand}
                              onChange={(e) => setFormState({ ...formState, brand: e.target.value })}
                            />
                            <textarea
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Description"
                              value={formState.description}
                              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                            />
                            <input
                              type="number"
                              step="0.01"
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Quantity"
                              value={formState.quantity}
                              onChange={(e) => setFormState({ ...formState, quantity: e.target.value })}
                            />
                            <input
                              type="number"
                              step="0.01"
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Cost per unit"
                              value={formState.costPerUnit}
                              onChange={(e) => setFormState({ ...formState, costPerUnit: e.target.value })}
                            />
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="rounded-md border px-2 py-1 text-[11px]"
                                onClick={() => handleReceive(row)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="text-[11px] text-muted-foreground"
                                onClick={() => setShowReceiveFor(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {showIssueFor === row.estimateItemId && (
                          <div className="mt-2 space-y-1 rounded-md border p-2">
                            <h4 className="text-[11px] font-semibold">Issue</h4>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full rounded border px-2 py-1 text-[11px]"
                              placeholder="Quantity"
                              value={formState.issueQty}
                              onChange={(e) => setFormState({ ...formState, issueQty: e.target.value })}
                            />
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                className="rounded-md border px-2 py-1 text-[11px]"
                                onClick={() => handleIssue(row)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="text-[11px] text-muted-foreground"
                                onClick={() => setShowIssueFor(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {actionError && <div className="mt-1 text-[11px] text-destructive">{actionError}</div>}
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

function StatusBadge({ status }: { status: string }) {
  const label = status.replace("_", " ");
  return <span className="rounded-full border px-2 py-0.5 text-[11px] capitalize">{label}</span>;
}
