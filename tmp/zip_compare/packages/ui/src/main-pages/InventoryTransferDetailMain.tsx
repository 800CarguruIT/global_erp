"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  InventoryLocation,
  InventoryTransfer,
  InventoryTransferItem,
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
  const [resolvedCompanyId, setResolvedCompanyId] = useState(companyId);
  const [resolvedTransferId, setResolvedTransferId] = useState(transferId);
  const [state, setState] = useState<LoadState<{ transfer: InventoryTransfer; items: InventoryTransferItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const locationMap = useMemo(() => {
    const map = new Map<string, InventoryLocation>();
    locations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [locations]);

  const formatLocation = (locationId: string) => {
    const loc = locationMap.get(locationId);
    if (!loc) return locationId;
    if (loc.code && loc.name) return `${loc.code} - ${loc.name}`;
    return loc.code || loc.name || locationId;
  };

  useEffect(() => {
    if (companyId && transferId) {
      setResolvedCompanyId(companyId);
      setResolvedTransferId(transferId);
    }
  }, [companyId, transferId]);

  useEffect(() => {
    if ((companyId && transferId) || typeof window === "undefined") return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const companyIdx = parts.indexOf("company");
    const inventoryIdx = parts.indexOf("inventory");
    const transfersIdx = parts.indexOf("transfers");
    if (companyIdx >= 0 && parts[companyIdx + 1]) {
      setResolvedCompanyId(parts[companyIdx + 1]);
    }
    if (transfersIdx >= 0 && parts[transfersIdx + 1]) {
      setResolvedTransferId(parts[transfersIdx + 1]);
    } else if (inventoryIdx >= 0 && parts[inventoryIdx + 2]) {
      setResolvedTransferId(parts[inventoryIdx + 2]);
    }
  }, [companyId, transferId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!resolvedCompanyId || !resolvedTransferId) {
        if (!cancelled) setState({ status: "error", data: null, error: "Missing transfer details." });
        return;
      }
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(
          `/api/company/${resolvedCompanyId}/workshop/inventory/transfers/${resolvedTransferId}`
        );
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
  }, [resolvedCompanyId, resolvedTransferId]);

  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      if (!resolvedCompanyId) return;
      try {
        const res = await fetch(`/api/company/${resolvedCompanyId}/workshop/inventory/locations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setLocations(json.data ?? []);
      } catch {
        if (!cancelled) setLocations([]);
      }
    }
    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [resolvedCompanyId]);

  async function transition(kind: "approve" | "start" | "complete") {
    if (!resolvedCompanyId || !resolvedTransferId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/company/${resolvedCompanyId}/workshop/inventory/transfers/${resolvedTransferId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [kind]: true }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : `Failed to update transfer (HTTP ${res.status})`;
        if (message.startsWith("INSUFFICIENT_STOCK:")) {
          window.alert(`Insufficient stock:\n${message.replace("INSUFFICIENT_STOCK:", "").trim()}`);
          return;
        }
        throw new Error(message);
      }
      window.location.reload();
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : "Failed to update transfer");
    } finally {
      setIsSaving(false);
    }
  }

  async function printDispatchDetails() {
    const { toDataURL } = await import("qrcode");
    const qrPayload = JSON.stringify({
      transferNumber: transfer.transferNumber,
      transferId: transfer.id,
      from: formatLocation(transfer.fromLocationId),
      to: formatLocation(transfer.toLocationId),
    });
    const qrDataUrl = await toDataURL(qrPayload, { width: 180, margin: 1 });
    const linesHtml = items
      .map(
        (item) => `
          <tr>
            <td>${item.partName || "Part"}<div class="muted">${item.partCode || item.partsCatalogId}</div></td>
            <td class="right">${item.quantity}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Dispatch ${transfer.transferNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0b1220; padding: 24px; }
            h1 { font-size: 18px; margin: 0 0 6px; }
            .muted { color: #5b6b7d; font-size: 12px; }
            .row { display: flex; gap: 24px; align-items: flex-start; }
            .card { border: 1px solid #d7dde5; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e6ebf1; }
            th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #5b6b7d; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="row">
            <div style="flex:1">
              <h1>Dispatch Note</h1>
              <div class="muted">Transfer ${transfer.transferNumber}</div>
              <div class="muted">Printed ${new Date().toLocaleString()}</div>
              <div class="card">
                <div><strong>From:</strong> ${formatLocation(transfer.fromLocationId)}</div>
                <div><strong>To:</strong> ${formatLocation(transfer.toLocationId)}</div>
                <div><strong>Status:</strong> ${transfer.status.replace("_", " ")}</div>
              </div>
            </div>
            <div class="card">
              <img src="${qrDataUrl}" alt="QR Code" />
              <div class="muted" style="text-align:center">Scan for transfer</div>
            </div>
          </div>
          <div class="card">
            <table>
              <thead>
                <tr><th>Part</th><th class="right">Qty</th></tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Transfer" subtitle="Loading transfer..." scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading...</p>
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
  const formatUser = (name?: string | null, userId?: string | null) => {
    if (name && name.trim()) return name;
    if (userId) return userId.slice(0, 8);
    return "System";
  };
  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "--");
  const approvedAt = transfer.approvedAt ?? null;
  const approvedBy = transfer.approvedBy ?? null;
  const dispatchedAt = transfer.dispatchedAt ?? null;
  const dispatchedBy = transfer.dispatchedBy ?? null;

  return (
    <MainPageShell
      title="Inventory Transfer"
      subtitle={`${formatLocation(transfer.fromLocationId)} -> ${formatLocation(transfer.toLocationId)}`}
      scopeLabel={transfer.transferNumber}
      primaryAction={<span className="text-xs text-muted-foreground">{isSaving ? "Saving..." : ""}</span>}
      contentClassName="rounded-2xl border-0 bg-transparent p-0"
      secondaryActions={
        <div className="flex items-center gap-2">
          {transfer.status === "draft" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => transition("approve")}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
            >
              Approve
            </button>
          )}
          {transfer.status === "approved" && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => transition("start")}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
            >
              Dispatch
            </button>
          )}
          {transfer.status === "in_transit" && (
            <>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-200">
                Dispatched
              </span>
              <button
                type="button"
                onClick={printDispatchDetails}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-900"
              >
                Print dispatch
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => transition("complete")}
                className="rounded-md bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900"
              >
                Receive
              </button>
            </>
          )}
          {transfer.status === "completed" && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] text-emerald-200">
              Received
            </span>
          )}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl bg-slate-950/80 p-5 shadow-xl">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="From" value={formatLocation(transfer.fromLocationId)} />
            <Field label="To" value={formatLocation(transfer.toLocationId)} />
            <Field label="Status" value={transfer.status.replace("_", " ")} />
            <Field label="Updated" value={new Date(transfer.updatedAt).toLocaleString()} />
          </div>
        </section>

        <section className="rounded-2xl bg-slate-950/80 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Transfer timeline</h2>
            <span className="text-xs text-slate-400">{transfer.transferNumber}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Created</div>
              <div className="text-sm font-semibold text-slate-100">{formatDate(transfer.createdAt)}</div>
              <div className="text-[11px] text-slate-400">
                By {formatUser(transfer.createdByName, transfer.createdBy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Approved</div>
              <div className="text-sm font-semibold text-slate-100">{formatDate(approvedAt)}</div>
              <div className="text-[11px] text-slate-400">
                By {formatUser(transfer.approvedByName, approvedBy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Dispatched</div>
              <div className="text-sm font-semibold text-slate-100">{formatDate(dispatchedAt)}</div>
              <div className="text-[11px] text-slate-400">
                By {formatUser(transfer.dispatchedByName, dispatchedBy)}
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Received</div>
              <div className="text-sm font-semibold text-slate-100">{formatDate(transfer.completedAt)}</div>
              <div className="text-[11px] text-slate-400">
                By {formatUser(transfer.completedByName, transfer.completedBy)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-slate-950/80 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">Transfer items</h2>
            <span className="text-xs text-slate-400">{items.length} line(s)</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pl-3 pr-4 text-left">Part details</th>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-400">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id ?? idx} className="bg-slate-900/60 text-slate-100">
                      <td className="rounded-l-xl py-3 pl-3 pr-4">
                        <div className="font-semibold">{item.partName || "Part"}</div>
                        <div className="text-[11px] text-slate-400">{item.partCode || item.partsCatalogId}</div>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-300">
                        {formatLocation(transfer.fromLocationId)}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-slate-300">
                        {formatLocation(transfer.toLocationId)}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-semibold">{item.quantity}</td>
                      <td className="rounded-r-xl px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {transfer.status === "draft" && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => transition("approve")}
                              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                            >
                              Approve
                            </button>
                          )}
                          {transfer.status === "approved" && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => transition("start")}
                              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                            >
                              Dispatch
                            </button>
                          )}
                          {transfer.status === "in_transit" && (
                            <>
                              <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-200">
                                Dispatched
                              </span>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={() => transition("complete")}
                                className="rounded-md bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900"
                              >
                                Receive
                              </button>
                            </>
                          )}
                          {transfer.status === "completed" && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200">
                              Received
                            </span>
                          )}
                        </div>
                      </td>
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
