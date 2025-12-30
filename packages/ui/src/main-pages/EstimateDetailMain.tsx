"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Estimate, EstimateItem, EstimateItemStatus, EstimateStatus } from "@repo/ai-core/workshop/estimates/types";

type EstimateDetailMainProps = {
  companyId: string;
  estimateId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemDraft = {
  id?: string;
  lineNo?: number;
  partName: string;
  description?: string;
  type: EstimateItem["type"];
  quantity: number;
  cost: number;
  sale: number;
  gpPercent?: number | null;
  status: EstimateItemStatus;
};

type DraftState = {
  status: EstimateStatus;
  vatRate: number;
  discountAmount: number;
  items: ItemDraft[];
};

export function EstimateDetailMain({ companyId, estimateId }: EstimateDetailMainProps) {
  const [loadState, setLoadState] = useState<LoadState<{ estimate: Estimate; items: EstimateItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const estimate: Estimate = json.data?.estimate ?? json.data?.data ?? json.data.estimate ?? json.data;
        const items: EstimateItem[] = json.data?.items ?? json.items ?? json.data?.data?.items ?? [];
        if (!cancelled) {
          setLoadState({ status: "loaded", data: { estimate, items }, error: null });
          setDraft({
            status: estimate.status,
            vatRate: estimate.vatRate,
            discountAmount: estimate.totalDiscount ?? 0,
            items: items.map((i) => ({
              id: i.id,
              lineNo: i.lineNo,
              partName: i.partName ?? "",
              description: i.description ?? "",
              type: i.type,
              quantity: i.quantity ?? 1,
              cost: i.cost ?? 0,
              sale: i.sale ?? 0,
              gpPercent: i.gpPercent ?? null,
              status: i.status,
            })),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLoadState({ status: "error", data: null, error: "Failed to load estimate." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, estimateId]);

  useEffect(() => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    const timeout = setTimeout(async () => {
      try {
        const body = {
          status: draft.status,
          vatRate: draft.vatRate,
          discountAmount: draft.discountAmount,
          items: draft.items.map((i, idx) => ({
            id: i.id,
            lineNo: i.lineNo ?? idx + 1,
            partName: i.partName ?? "",
            description: i.description ?? "",
            type: i.type,
            quantity: i.quantity ?? 1,
            cost: i.cost ?? 0,
            sale: i.sale ?? 0,
            gpPercent: i.gpPercent ?? null,
            status: i.status ?? "pending",
          })),
        };
        const res = await fetch(`/api/company/${companyId}/workshop/estimates/${estimateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setIsSaving(false);
        setLastSavedAt(new Date());
      } catch (err) {
        console.error(err);
        setIsSaving(false);
        setSaveError("Autosave failed");
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [draft, companyId, estimateId]);

  const totals = useMemo(() => {
    if (!draft) return null;
    const activeItems = draft.items.filter((i) => i.status !== "rejected");
    let totalCost = 0;
    let totalSale = 0;
    for (const i of activeItems) {
      const qty = i.quantity ?? 0;
      totalCost += (i.cost ?? 0) * qty;
      totalSale += (i.sale ?? 0) * qty;
    }
    const finalPrice = totalSale - (draft.discountAmount ?? 0);
    const vatAmount = finalPrice * (draft.vatRate / 100);
    const grandTotal = finalPrice + vatAmount;
    return { totalCost, totalSale, finalPrice, vatAmount, grandTotal };
  }, [draft]);

  async function createWorkOrder() {
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/workorders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const id: string = json.data?.workOrder?.id ?? json.data?.id ?? json.data?.workOrderId;
      if (id) {
        window.location.href = `/company/${companyId}/workshop/workorders/${id}`;
      }
    } catch (err) {
      console.error("Failed to create work order", err);
    }
  }

  if (loadState.status === "loading" || !draft) {
    return (
      <MainPageShell title="Estimate" subtitle="Loading estimate…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading estimate…</p>
      </MainPageShell>
    );
  }

  if (loadState.status === "error") {
    return (
      <MainPageShell title="Estimate" subtitle="Unable to load estimate" scopeLabel="">
        <p className="text-sm text-destructive">{loadState.error}</p>
      </MainPageShell>
    );
  }

  const saveStatusText = saveError ? saveError : isSaving ? "Saving…" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : "All changes saved";

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      const current = next[index];
      if (!current) return prev;
      const updated: ItemDraft = {
        ...current,
        ...patch,
        partName: patch.partName ?? current.partName ?? "",
        type: patch.type ?? current.type ?? "genuine",
        quantity: patch.quantity ?? current.quantity ?? 0,
        cost: patch.cost ?? current.cost ?? 0,
        sale: patch.sale ?? current.sale ?? 0,
        gpPercent: patch.gpPercent ?? current.gpPercent ?? null,
        status: patch.status ?? current.status ?? "pending",
      };
      next[index] = updated;
      return { ...prev, items: next };
    });
  }

  function addItem() {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              {
                partName: "",
                description: "",
                type: "genuine",
                quantity: 1,
                cost: 0,
                sale: 0,
                status: "pending",
              },
            ],
          }
        : prev
    );
  }

  function removeItem(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: next };
    });
  }

  function updateStatus(status: EstimateStatus) {
    setDraft((prev) => (prev ? { ...prev, status } : prev));
    if (status === "approved") {
      createWorkOrder();
    }
  }

  function updateVatRate(rate: number) {
    setDraft((prev) => (prev ? { ...prev, vatRate: rate } : prev));
  }

  function updateDiscount(amount: number) {
    setDraft((prev) => (prev ? { ...prev, discountAmount: amount } : prev));
  }

  return (
    <MainPageShell
      title="Estimate"
      subtitle="Adjust costs, GP%, and totals for this estimate."
      scopeLabel={`Estimate ID: ${loadState.data!.estimate.id.slice(0, 8)}…`}
      primaryAction={
        draft.status === "draft" ? (
          <button type="button" onClick={() => updateStatus("pending_approval")} className="rounded-md border px-3 py-1 text-sm font-medium">
            Send for Approval
          </button>
        ) : draft.status === "pending_approval" ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => updateStatus("approved")} className="rounded-md border px-3 py-1 text-sm font-medium">
              Mark Approved
            </button>
            <button type="button" onClick={() => updateStatus("rejected")} className="rounded-md border px-3 py-1 text-sm font-medium">
              Mark Rejected
            </button>
          </div>
        ) : (
          <button type="button" onClick={createWorkOrder} className="rounded-md border px-3 py-1 text-sm font-medium">
            Open Work Order
          </button>
        )
      }
      secondaryActions={<span className="text-xs text-muted-foreground">{saveStatusText}</span>}
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Status</div>
              <select
                className="rounded-md border px-2 py-1 text-sm"
                value={draft.status}
                onChange={(e) => updateStatus(e.target.value as EstimateStatus)}
              >
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">VAT rate (%)</div>
              <input
                type="number"
                step="0.01"
                className="w-24 rounded-md border px-2 py-1 text-sm"
                value={draft.vatRate}
                onChange={(e) => updateVatRate(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Discount amount</div>
              <input
                type="number"
                step="0.01"
                className="w-28 rounded-md border px-2 py-1 text-sm"
                value={draft.discountAmount}
                onChange={(e) => updateDiscount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Estimate items</h2>
              <p className="text-xs text-muted-foreground">Parts/labor lines converted from inspection findings.</p>
            </div>
            <button type="button" onClick={addItem} className="rounded-md border px-2 py-1 text-xs font-medium">
              Add line
            </button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Part / labor</th>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                  <th className="px-2 py-1 text-left">Cost (ea)</th>
                  <th className="px-2 py-1 text-left">GP %</th>
                  <th className="px-2 py-1 text-left">Sale (ea)</th>
                  <th className="px-2 py-1 text-left">Line cost</th>
                  <th className="px-2 py-1 text-left">Line sale</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-2 px-3 text-xs text-muted-foreground">
                      No items added yet.
                    </td>
                  </tr>
                ) : (
                  draft.items.map((item, idx) => {
                    const qty = item.quantity ?? 0;
                    const lineCost = (item.cost ?? 0) * qty;
                    const lineSale = (item.sale ?? 0) * qty;
                    return (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <input
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.partName}
                            onChange={(e) => updateItem(idx, { partName: e.target.value })}
                            placeholder="Part / labor name"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <textarea
                            className="h-16 w-full resize-none rounded border bg-background px-2 py-1 text-xs"
                            value={item.description ?? ""}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            placeholder="Description / why it's needed"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.type}
                            onChange={(e) => updateItem(idx, { type: e.target.value as any })}
                          >
                            <option value="genuine">Genuine</option>
                            <option value="oem">OEM</option>
                            <option value="aftermarket">Aftermarket</option>
                            <option value="used">Used</option>
                            <option value="repair">Repair</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.cost}
                            onChange={(e) => {
                              const cost = Number(e.target.value) || 0;
                              const sale = item.sale;
                              const gp = sale > 0 ? ((sale - cost) / sale) * 100 : item.gpPercent ?? null;
                              updateItem(idx, { cost, gpPercent: gp ?? null });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={item.gpPercent ?? 0}
                            onChange={(e) => {
                              const gp = Number(e.target.value);
                              const cost = item.cost ?? 0;
                              const sale = gp ? cost * (1 + gp / 100) : item.sale;
                              updateItem(idx, { gpPercent: gp, sale });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.sale}
                            onChange={(e) => {
                              const sale = Number(e.target.value) || 0;
                              const cost = item.cost ?? 0;
                              const gp = sale > 0 ? ((sale - cost) / sale) * 100 : null;
                              updateItem(idx, { sale, gpPercent: gp });
                            }}
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-xs">{lineCost.toFixed(2)}</td>
                        <td className="px-2 py-1 align-top text-xs">{lineSale.toFixed(2)}</td>
                        <td className="px-2 py-1 align-top">
                          <select
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.status}
                            onChange={(e) => updateItem(idx, { status: e.target.value as EstimateItemStatus })}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <button type="button" onClick={() => removeItem(idx)} className="rounded-md border px-2 py-1 text-[11px]">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Totals</h2>
          {totals ? (
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              <TotalsRow label="Total cost" value={totals.totalCost} />
              <TotalsRow label="Total sale" value={totals.totalSale} />
              <TotalsRow label="Discount" value={draft.discountAmount ?? 0} />
              <TotalsRow label="Final price" value={totals.finalPrice} />
              <TotalsRow label={`VAT (${draft.vatRate}%)`} value={totals.vatAmount} />
              <TotalsRow label="Grand total" value={totals.grandTotal} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No totals yet.</p>
          )}
        </section>
      </div>
    </MainPageShell>
  );
}

function TotalsRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1 rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value.toFixed(2)}</div>
    </div>
  );
}
