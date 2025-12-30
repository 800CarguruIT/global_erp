"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Quote, QuoteItem, QuoteStatus } from "@repo/ai-core/workshop/quotes/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemDraft = Partial<QuoteItem>;

export function VendorQuoteDetailMain({ companyId, quoteId }: { companyId: string; quoteId: string }) {
  const [state, setState] = useState<LoadState<{ quote: Quote; items: QuoteItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [header, setHeader] = useState<{ status?: QuoteStatus; validUntil?: string | null }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/quotes/${quoteId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const quote: Quote = json.data?.quote ?? json.data?.data?.quote ?? json.data?.quote ?? json.data;
        const list: QuoteItem[] = json.data?.items ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: { quote, items: list }, error: null });
          setItems(list.map((i) => ({ ...i })));
          setHeader({ status: quote.status, validUntil: quote.validUntil ?? "" });
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load quote." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, quoteId]);

  async function save(approve?: boolean) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = {
        status: header.status,
        validUntil: header.validUntil ?? null,
        items: items.map((i) => ({
          id: i.id,
          partNumber: i.partNumber,
          brand: i.brand,
          partType: i.partType,
          etaDays: i.etaDays ?? null,
          quantity: i.quantity ?? 0,
          unitPrice: i.unitPrice ?? 0,
        })),
        approve: !!approve,
      };
      const res = await fetch(`/api/company/${companyId}/workshop/quotes/${quoteId}`, {
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

  if (state.status === "loading") {
    return (
      <MainPageShell title="Vendor Quote" subtitle="Loading quote…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Vendor Quote" subtitle="Unable to load quote" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const { quote } = state.data;

  return (
    <MainPageShell
      title="Vendor Quote"
      subtitle="Internal vendor pricing for parts."
      scopeLabel={`Quote ${quote.id.slice(0, 8)}…`}
      primaryAction={
        <span className="text-xs text-muted-foreground">{isSaving ? "Saving…" : "Auto-saves"}</span>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="rounded-md border px-3 py-1 text-sm font-medium"
          >
            Approve & apply costs
          </button>
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      }
    >
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Status</div>
              <select
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={header.status}
                onChange={(e) => setHeader((p) => ({ ...p, status: e.target.value as QuoteStatus }))}
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Valid until</div>
              <input
                type="date"
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={header.validUntil ?? ""}
                onChange={(e) => setHeader((p) => ({ ...p, validUntil: e.target.value }))}
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Estimate</div>
              {quote.estimateId ? (
                <a
                  className="text-primary hover:underline"
                  href={`/company/${companyId}/workshop/estimates/${quote.estimateId}`}
                >
                  {quote.estimateId.slice(0, 8)}…
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Parts</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Part</th>
                  <th className="px-2 py-1 text-left">Brand</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                  <th className="px-2 py-1 text-left">Unit price</th>
                  <th className="px-2 py-1 text-left">ETA (days)</th>
                  <th className="px-2 py-1 text-left">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const qty = item.quantity ?? 0;
                    const unit = item.unitPrice ?? 0;
                    const total = qty * unit;
                    return (
                      <tr key={item.id ?? idx} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <div className="text-sm font-medium">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Part #{item.partNumber ?? "—"}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.brand ?? ""}
                            onChange={(e) => updateItem(idx, { brand: e.target.value })}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={item.partType ?? ""}
                            onChange={(e) => updateItem(idx, { partType: e.target.value })}
                          >
                            <option value="">—</option>
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
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={qty}
                            onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={unit}
                            onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                            min={0}
                            step="0.01"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            className="w-20 rounded border bg-background px-2 py-1 text-xs"
                            value={item.etaDays ?? 0}
                            onChange={(e) => updateItem(idx, { etaDays: Number(e.target.value) })}
                            min={0}
                          />
                        </td>
                        <td className="px-2 py-1 align-top text-right">{total.toFixed(2)}</td>
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

  function updateItem(index: number, patch: Partial<QuoteItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }
}
