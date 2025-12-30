"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderType,
} from "@repo/ai-core/workshop/procurement/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemDraft = {
  id?: string;
  lineNo?: number;
  name: string;
  description?: string | null;
  quantity: number;
  unitCost: number;
  receiveNow?: number;
};

export function ProcurementDetailMain({ companyId, poId }: { companyId: string; poId: string }) {
  const [state, setState] = useState<LoadState<{ po: PurchaseOrder; items: PurchaseOrderItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [header, setHeader] = useState<{
    status?: PurchaseOrderStatus;
    poType?: PurchaseOrderType;
    expectedDate?: string | null;
    notes?: string | null;
    vendorName?: string | null;
    vendorContact?: string | null;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const po: PurchaseOrder = json.data?.po ?? json.data?.purchaseOrder ?? json.data?.data ?? json.data?.po ?? json.data;
        const list: PurchaseOrderItem[] = json.data?.items ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: { po, items: list }, error: null });
          setItems(
            list.map((i) => ({
              id: i.id,
              lineNo: i.lineNo,
              name: i.name ?? "",
              description: i.description ?? "",
              quantity: i.quantity ?? 0,
              unitCost: i.unitCost ?? 0,
              receiveNow: 0,
            }))
          );
          setHeader({
            status: po.status,
            poType: po.poType,
            expectedDate: po.expectedDate ?? "",
            notes: po.notes ?? "",
            vendorName: po.vendorName ?? "",
            vendorContact: po.vendorContact ?? "",
          });
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load purchase order." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, poId]);

  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitCost ?? 0), 0);
    return { total };
  }, [items]);

  async function save() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        status: header.status,
        poType: header.poType,
        expectedDate: header.expectedDate ?? null,
        notes: header.notes ?? null,
        vendorName: header.vendorName ?? null,
        vendorContact: header.vendorContact ?? null,
        items: items.map((i, idx) => ({
          id: i.id,
          lineNo: i.lineNo ?? idx + 1,
          name: i.name ?? "",
          description: i.description ?? null,
          quantity: i.quantity ?? 0,
          unitCost: i.unitCost ?? 0,
        })),
      };
      const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function receiveSelected() {
    setIsReceiving(true);
    setReceiveError(null);
    try {
      const toReceive = items
        .filter((i) => (i.receiveNow ?? 0) > 0 && i.id)
        .map((i) => ({ itemId: i.id!, quantity: i.receiveNow ?? 0 }));
      const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toReceive }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const refreshed: PurchaseOrderItem[] = json.data?.items ?? [];
      setItems((prev) =>
        prev.map((p) => {
          const newer = refreshed.find((r) => r.id === p.id);
          return newer
            ? { ...p, receiveNow: 0, quantity: newer.quantity ?? p.quantity, unitCost: newer.unitCost ?? p.unitCost }
            : p;
        })
      );
    } catch (err) {
      console.error(err);
      setReceiveError("Failed to receive");
    } finally {
      setIsReceiving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Procurement" subtitle="Loading PO…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Procurement" subtitle="Unable to load PO" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const po = state.data.po;
  const editable = po.status === "draft";

  return (
    <MainPageShell
      title="Procurement"
      subtitle="Purchase order / LPO."
      scopeLabel={`PO ${po.poNumber}`}
      primaryAction={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSaving ? "Saving…" : "Autosaves"} · Total {totals.total.toFixed(2)}
        </div>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} className="rounded-md border px-3 py-1 text-sm font-medium">
            Save
          </button>
          {editable ? (
            <button
              type="button"
              onClick={() => setHeader((p) => ({ ...p, status: "issued" as PurchaseOrderStatus }))}
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              Issue PO
            </button>
          ) : (
            <button
              type="button"
              disabled={isReceiving}
              onClick={receiveSelected}
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              {isReceiving ? "Receiving…" : "Receive selected"}
            </button>
          )}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {receiveError && <span className="text-xs text-destructive">{receiveError}</span>}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField
              label="Status"
              value={header.status ?? po.status}
              onChange={(v) => setHeader((p) => ({ ...p, status: v as PurchaseOrderStatus }))}
              options={["draft", "issued", "partially_received", "received", "cancelled"]}
            />
            <SelectField
              label="Type"
              value={header.poType ?? po.poType}
              onChange={(v) => setHeader((p) => ({ ...p, poType: v as PurchaseOrderType }))}
              options={["po", "lpo"]}
              disabled={!editable}
            />
            <TextField
              label="Vendor name"
              value={header.vendorName ?? ""}
              onChange={(v) => setHeader((p) => ({ ...p, vendorName: v }))}
              readOnly={!editable}
            />
            <TextField
              label="Vendor contact"
              value={header.vendorContact ?? ""}
              onChange={(v) => setHeader((p) => ({ ...p, vendorContact: v }))}
              readOnly={!editable}
            />
            <TextField
              label="Expected date"
              type="date"
              value={header.expectedDate ?? ""}
              onChange={(v) => setHeader((p) => ({ ...p, expectedDate: v }))}
            />
          </div>
          <TextareaField
            label="Notes"
            value={header.notes ?? ""}
            onChange={(v) => setHeader((p) => ({ ...p, notes: v }))}
          />
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Items</h2>
            {editable && (
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { name: "New item", description: "", quantity: 1, unitCost: 0, receiveNow: 0 },
                  ])
                }
                className="rounded-md border px-3 py-1 text-sm font-medium"
              >
                Add line
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Item</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                  <th className="px-2 py-1 text-left">Unit cost</th>
                  <th className="px-2 py-1 text-left">Line total</th>
                  <th className="px-2 py-1 text-left">Receive now</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const lineTotal = (item.quantity ?? 0) * (item.unitCost ?? 0);
                    return (
                      <tr key={item.id ?? idx} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <input
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.name}
                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                            readOnly={!editable}
                          />
                          <textarea
                            className="mt-1 h-14 w-full resize-none rounded border bg-background px-2 py-1 text-[11px]"
                            value={item.description ?? ""}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                            readOnly={!editable}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            min={0}
                            readOnly={!editable}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.unitCost}
                            onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                            min={0}
                            step="0.01"
                            readOnly={!editable}
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">{lineTotal.toFixed(2)}</td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.receiveNow ?? 0}
                            onChange={(e) => updateItem(idx, { receiveNow: Number(e.target.value) })}
                            min={0}
                            step="0.01"
                            disabled={editable}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="rounded-md border px-2 py-1 text-[11px]"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Receiving</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainPageShell>
  );

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        ...patch,
        name: patch.name ?? current.name ?? "",
        quantity: patch.quantity ?? current.quantity ?? 0,
        unitCost: patch.unitCost ?? current.unitCost ?? 0,
        receiveNow: patch.receiveNow ?? current.receiveNow ?? 0,
      };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <select
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        readOnly={readOnly}
        type={type}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <textarea
        className="h-24 w-full resize-none rounded border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
