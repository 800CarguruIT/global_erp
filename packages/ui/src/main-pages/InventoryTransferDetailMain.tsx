"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  InventoryTransfer,
  InventoryTransferItem,
  InventoryTransferStatus,
} from "@repo/ai-core/workshop/inventory/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function InventoryTransferDetailMain({
  companyId,
  transferId,
}: {
  companyId: string;
  transferId: string;
}) {
  const [state, setState] = useState<LoadState<{ transfer: InventoryTransfer; items: InventoryTransferItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/transfers/${transferId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const transfer: InventoryTransfer = json.data?.transfer ?? json.data;
        const items: InventoryTransferItem[] = json.data?.items ?? [];
        if (!cancelled) setState({ status: "loaded", data: { transfer, items }, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load transfer." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, transferId]);

  async function transition(kind: "start" | "complete") {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [kind]: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setSaveError("Failed to update transfer");
    } finally {
      setIsSaving(false);
    }
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Transfer" subtitle="Loading transfer…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Transfer" subtitle="Unable to load transfer" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const { transfer, items } = state.data;

  return (
    <MainPageShell
      title="Inventory Transfer"
      subtitle={`${transfer.fromLocationId.slice(0, 6)} → ${transfer.toLocationId.slice(0, 6)}`}
      scopeLabel={transfer.transferNumber}
      primaryAction={<span className="text-xs text-muted-foreground">{isSaving ? "Saving…" : ""}</span>}
      secondaryActions={
        <div className="flex items-center gap-2">
          {transfer.status === "draft" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => transition("start")}
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              Start transfer
            </button>
          )}
          {transfer.status === "in_transit" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => transition("complete")}
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              Complete transfer
            </button>
          )}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      }
    >
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="From location" value={transfer.fromLocationId} />
            <Field label="To location" value={transfer.toLocationId} />
            <Field label="Status" value={transfer.status} />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Items</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Part</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id ?? idx} className="border-b last:border-0">
                      <td className="py-1 pl-2 pr-3">
                        <div className="text-sm font-medium">{item.partsCatalogId.slice(0, 8)}…</div>
                      </td>
                      <td className="px-2 py-1">{item.quantity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainPageShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

