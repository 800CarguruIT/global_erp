"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Quote, QuoteItem, QuoteStatus } from "@repo/ai-core/workshop/quotes/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function BranchQuoteDetailMain({ companyId, quoteId }: { companyId: string; quoteId: string }) {
  const [state, setState] = useState<LoadState<{ quote: Quote; items: QuoteItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [hours, setHours] = useState(0);
  const [rate, setRate] = useState(0);
  const [status, setStatus] = useState<QuoteStatus>("open");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/quotes/${quoteId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const quote: Quote = json.data?.quote ?? json.data;
        const items: QuoteItem[] = json.data?.items ?? [];
        const first = items[0];
        if (!cancelled) {
          setState({ status: "loaded", data: { quote, items }, error: null });
          setHours(first?.laborHours ?? first?.quantity ?? 0);
          setRate(first?.laborRate ?? first?.unitPrice ?? 0);
          const normalizedStatus =
            quote.status === "draft" || quote.status === "submitted" ? "open" : (quote.status as QuoteStatus);
          setStatus(normalizedStatus);
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
      const body: any = {
        header: { status },
        items: [
          {
            laborHours: hours,
            laborRate: rate,
            unitPrice: rate,
            quantity: hours,
          },
        ],
      };
      if (approve) body.approve = true;
      const res = await fetch(`/api/company/${companyId}/workshop/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const updated = await res.json();
      const quote: Quote = updated.data?.quote ?? updated.data;
      const items: QuoteItem[] = updated.data?.items ?? [];
      const first = items[0];
      setState({ status: "loaded", data: { quote, items }, error: null });
      setHours(first?.laborHours ?? first?.quantity ?? 0);
      setRate(first?.laborRate ?? first?.unitPrice ?? 0);
      setStatus(quote.status);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Branch Labor Quote" subtitle="Loading quote..." scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Branch Labor Quote" subtitle="Unable to load quote" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const { quote } = state.data;
  const total = hours * rate;

  return (
    <MainPageShell
      title="Branch Labor Quote"
      subtitle="Internal branch pricing for labor."
      scopeLabel={`Quote ${quote.id.slice(0, 8)}...`}
      primaryAction={<span className="text-xs text-muted-foreground">{isSaving ? "Saving..." : "Autosaves"}</span>}
      secondaryActions={
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => save(false)} className="rounded-md border px-3 py-1 text-sm font-medium">
            Save
          </button>
          <button type="button" onClick={() => save(true)} className="rounded-md border px-3 py-1 text-sm font-medium">
            Approve & apply
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
                value={status}
                onChange={(e) => setStatus(e.target.value as QuoteStatus)}
              >
                <option value="open">Open</option>
                <option value="quoted">Quoted</option>
                <option value="approved">Approved</option>
                <option value="accepted">Accepted</option>
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Work order</div>
              {quote.workOrderId ? (
                <a
                  className="text-primary hover:underline"
                  href={`/company/${companyId}/workshop/workorders/${quote.workOrderId}`}
                >
                  {quote.workOrderId.slice(0, 8)}...
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">-</span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Branch</div>
              <span className="text-xs text-muted-foreground">{quote.branchId ?? "-"}</span>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Labor</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Labor hours" value={hours.toString()} onChange={(v) => setHours(Number(v) || 0)} />
            <Field label="Labor rate" value={rate.toString()} onChange={(v) => setRate(Number(v) || 0)} />
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-sm font-semibold">{total.toFixed(2)}</div>
            </div>
          </div>
        </section>
      </div>
    </MainPageShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium">{label}</label>
      <input
        className="w-full rounded border bg-background px-2 py-1 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
