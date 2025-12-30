"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
} from "@repo/ai-core/workshop/invoices/types";

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
  rate: number;
  lineDiscount: number;
};

type InvoiceDraft = {
  status: InvoiceStatus;
  invoiceDate: string;
  paymentMethod?: string | null;
  dueDate?: string | null;
  vatRate: number;
  terms?: string | null;
  notes?: string | null;
  items: ItemDraft[];
};

export function InvoiceDetailMain({
  companyId,
  invoiceId,
}: {
  companyId: string;
  invoiceId: string;
}) {
  const [state, setState] = useState<LoadState<{ invoice: Invoice; items: InvoiceItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [draft, setDraft] = useState<InvoiceDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/invoices/${invoiceId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const invoice: Invoice = json.data?.invoice ?? json.data?.data ?? json.data?.invoice ?? json.data?.invoice;
        const items: InvoiceItem[] = json.data?.items ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: { invoice, items }, error: null });
          setDraft({
            status: invoice.status,
            invoiceDate: invoice.invoiceDate,
            paymentMethod: invoice.paymentMethod ?? "",
            dueDate: invoice.dueDate ?? "",
            vatRate: invoice.vatRate ?? 0,
            terms: invoice.terms ?? "",
            notes: invoice.notes ?? "",
            items: items.map((i) => ({
              id: i.id,
              lineNo: i.lineNo,
              name: i.name ?? "",
              description: i.description ?? "",
              quantity: i.quantity ?? 0,
              rate: i.rate ?? 0,
              lineDiscount: i.lineDiscount ?? 0,
            })),
          });
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load invoice." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, invoiceId]);

  useEffect(() => {
    if (!draft) return;
    setIsSaving(true);
    setSaveError(null);
    const timeout = setTimeout(async () => {
      try {
        const body = {
          status: draft.status,
          invoiceDate: draft.invoiceDate,
          paymentMethod: draft.paymentMethod ?? null,
          dueDate: draft.dueDate ?? null,
          vatRate: draft.vatRate,
          terms: draft.terms ?? null,
          notes: draft.notes ?? null,
          items: draft.items.map((i, idx) => ({
            id: i.id,
            lineNo: i.lineNo ?? idx + 1,
            name: i.name ?? "",
            description: i.description ?? null,
            quantity: i.quantity,
            rate: i.rate,
            lineDiscount: i.lineDiscount ?? 0,
          })),
        };
        const res = await fetch(`/api/company/${companyId}/workshop/invoices/${invoiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setLastSavedAt(new Date());
      } catch (err) {
        console.error(err);
        setSaveError("Failed to save");
      } finally {
        setIsSaving(false);
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [draft, companyId, invoiceId]);

  const totals = useMemo(() => {
    if (!draft) {
      return {
        totalSale: 0,
        totalDiscount: 0,
        finalAmount: 0,
        vatAmount: 0,
        grandTotal: 0,
      };
    }
    const totalSale = draft.items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.rate ?? 0), 0);
    const totalDiscount = draft.items.reduce((sum, i) => sum + (i.lineDiscount ?? 0), 0);
    const finalAmount = totalSale - totalDiscount;
    const vatAmount = finalAmount * ((draft.vatRate ?? 0) / 100);
    const grandTotal = finalAmount + vatAmount;
    return { totalSale, totalDiscount, finalAmount, vatAmount, grandTotal };
  }, [draft]);

  if (state.status === "loading" || !draft) {
    return (
      <MainPageShell title="Invoice" subtitle="Loading invoice..." scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Invoice" subtitle="Unable to load invoice" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const invoice = state.data.invoice;

  const saveStatus = saveError
    ? saveError
    : isSaving
    ? "Saving..."
    : lastSavedAt
    ? `Saved ${lastSavedAt.toLocaleTimeString()}`
    : "All changes saved";

  function updateHeader<K extends keyof InvoiceDraft>(key: K, value: InvoiceDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.items];
      const current = next[index];
      if (!current) return prev;
      next[index] = {
        ...current,
        ...patch,
        name: patch.name ?? current.name ?? "",
        quantity: patch.quantity ?? current.quantity ?? 0,
        rate: patch.rate ?? current.rate ?? 0,
        lineDiscount: patch.lineDiscount ?? current.lineDiscount ?? 0,
      };

      // When sale changes, update gp / discount derived values
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
              { name: "New item", quantity: 1, rate: 0, lineDiscount: 0 },
            ],
          }
        : prev
    );
  }

  function deleteItem(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: next };
    });
  }

  function statusButton(nextStatus: InvoiceStatus, label: string) {
    const disabled = (draft?.status ?? "") === nextStatus;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => updateHeader("status", nextStatus)}
        className="rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-60"
      >
        {label}
      </button>
    );
  }

  return (
    <MainPageShell
      title="Invoice"
      subtitle="Review and finalize the invoice."
      scopeLabel={`Invoice ${invoice.invoiceNumber}`}
      primaryAction={<span className="text-xs text-muted-foreground">{saveStatus}</span>}
      secondaryActions={
        <div className="flex flex-wrap items-center gap-2">
          {statusButton("draft", "Draft")}
          {statusButton("issued", "Mark Issued")}
          {statusButton("paid", "Mark Paid")}
          {statusButton("cancelled", "Cancel")}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              label="Invoice number"
              value={invoice.invoiceNumber}
              onChange={() => {}}
              readOnly
            />
            <TextField
              label="Invoice date"
              type="date"
              value={draft.invoiceDate ?? ""}
              onChange={(v) => updateHeader("invoiceDate", v)}
            />
            <SelectField
              label="Payment method"
              value={draft.paymentMethod ?? ""}
              onChange={(v) => updateHeader("paymentMethod", v)}
              options={["", "cash", "card", "bank_transfer", "cod"]}
            />
            <TextField
              label="Due date"
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(v) => updateHeader("dueDate", v)}
            />
            <TextField
              label="VAT rate (%)"
              type="number"
              value={draft.vatRate?.toString() ?? "0"}
              onChange={(v) => updateHeader("vatRate", Number(v))}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <TextareaField
              label="Terms & conditions"
              value={draft.terms ?? ""}
              onChange={(v) => updateHeader("terms", v)}
            />
            <TextareaField
              label="Notes"
              value={draft.notes ?? ""}
              onChange={(v) => updateHeader("notes", v)}
            />
          </div>
        </section>

        {/* Items */}
        <section className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Line items</h2>
              <p className="text-xs text-muted-foreground">
                Adjust quantities, rates or discounts to finalize.
              </p>
            </div>
            <button type="button" onClick={addItem} className="rounded-md border px-3 py-1 text-sm font-medium">
              Add item
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Item</th>
                  <th className="px-2 py-1 text-left">Description</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                  <th className="px-2 py-1 text-left">Rate</th>
                  <th className="px-2 py-1 text-left">Line total</th>
                  <th className="px-2 py-1 text-left">Discount</th>
                  <th className="px-2 py-1 text-left">Final</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  draft.items.map((item, idx) => {
                    const lineTotal = (item.quantity ?? 0) * (item.rate ?? 0);
                    const lineFinal = lineTotal - (item.lineDiscount ?? 0);
                    return (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <input
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.name}
                            onChange={(e) => updateItem(idx, { name: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <textarea
                            className="h-16 w-full resize-none rounded border bg-background px-2 py-1 text-xs"
                            value={item.description ?? ""}
                            onChange={(e) => updateItem(idx, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.rate}
                            onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })}
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">{lineTotal.toFixed(2)}</td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={item.lineDiscount}
                            onChange={(e) => updateItem(idx, { lineDiscount: Number(e.target.value) })}
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">{lineFinal.toFixed(2)}</td>
                        <td className="px-2 py-1 align-top">
                          <button
                            type="button"
                            onClick={() => deleteItem(idx)}
                            className="rounded-md border px-2 py-1 text-[11px]"
                          >
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

        {/* Totals */}
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Totals</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryField label="Total sale" value={totals.totalSale} />
            <SummaryField label="Total discount" value={totals.totalDiscount} />
            <SummaryField label="Final amount" value={totals.finalAmount} />
            <SummaryField label="VAT amount" value={totals.vatAmount} />
            <SummaryField label="Grand total" value={totals.grandTotal} />
          </div>
        </section>
      </div>
    </MainPageShell>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        type={type}
        readOnly={readOnly}
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <select className="w-full rounded border bg-background px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "Select"}
          </option>
        ))}
      </select>
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
  onChange: (value: string) => void;
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

function SummaryField({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value.toFixed(2)}</div>
    </div>
  );
}
