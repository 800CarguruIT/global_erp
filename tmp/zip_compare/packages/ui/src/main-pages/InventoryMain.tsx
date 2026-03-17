"use client";

import React, { useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { InventoryLocation, InventoryStockRow, InventoryTransfer } from "@repo/ai-core/workshop/inventory/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type MovementForm = {
  direction: "in" | "out";
  locationId: string;
  partId: string;
  quantity: string;
  note: string;
};

type StatusMessage = { saving: boolean; message: string | null; error: string | null };

type ReceiptLabel = {
  grnNumber: string;
  qrCode: string;
  partCode: string;
  partName?: string | null;
  locationCode: string;
  quantity: number;
};

export function InventoryMain({ companyId, branchId }: { companyId: string; branchId?: string }) {
  const controlClass =
    "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50 dark:placeholder:text-slate-400";
  const controlSmall =
    "rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 placeholder:text-slate-500 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50 dark:placeholder:text-slate-400";

  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [stockState, setStockState] = useState<LoadState<InventoryStockRow[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [transferState, setTransferState] = useState<LoadState<InventoryTransfer[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [locationFilter, setLocationFilter] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [stockReloadKey, setStockReloadKey] = useState(0);
  const [locationsReloadKey, setLocationsReloadKey] = useState(0);
  const [transferReloadKey, setTransferReloadKey] = useState(0);
  const [defaultLocationAttempted, setDefaultLocationAttempted] = useState(false);

  const [movementForm, setMovementForm] = useState<MovementForm>({
    direction: "in",
    locationId: "",
    partId: "",
    quantity: "1",
    note: "",
  });
  const [movementStatus, setMovementStatus] = useState<StatusMessage>({
    saving: false,
    message: null,
    error: null,
  });
  const [receiptLabels, setReceiptLabels] = useState<ReceiptLabel[]>([]);
  const [printableLabels, setPrintableLabels] = useState<Array<ReceiptLabel & { qrDataUrl?: string; qrPayload: string }>>(
    []
  );
  const [selectedParts, setSelectedParts] = useState<Record<string, boolean>>({});
  const [transferForm, setTransferForm] = useState<{ from?: string; to?: string }>({});
  const [transferStatus, setTransferStatus] = useState<StatusMessage>({ saving: false, message: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      setLocationsError(null);
      try {
        const qs = new URLSearchParams();
        if (branchId) qs.set("branchId", branchId);
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations${qs.toString() ? `?${qs}` : ""}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setLocations(json.data ?? []);
      } catch (err) {
        if (!cancelled) setLocationsError("Failed to load locations.");
      }
    }
    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, locationsReloadKey]);

  // If no locations exist, auto-create a default one for company/branch
  useEffect(() => {
    if (defaultLocationAttempted) return;
    if (locations.length > 0) return;

    async function createDefault() {
      try {
        setDefaultLocationAttempted(true);
        const payload = {
          code: branchId ? "BR-DEFAULT" : "MAIN",
          name: branchId ? "Branch" : "Company",
          locationType: branchId ? ("branch" as any) : ("warehouse" as any),
          branchId: branchId ?? null,
        };
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setLocationsReloadKey((k) => k + 1);
        }
      } catch (_err) {
        // ignore
      }
    }

    createDefault();
  }, [locations.length, companyId, branchId, defaultLocationAttempted]);

  const filteredLocations = useMemo(() => {
    if (!branchId) return locations;
    // Branch view: show branch locations and fleet locations tied to this branch only
    return locations.filter(
      (l: any) =>
        l.branchId === branchId ||
        l.branch_id === branchId ||
        ((l.fleetVehicleId || l.fleet_vehicle_id) && (l.branchId === branchId || l.branch_id === branchId))
    );
  }, [locations, branchId]);

  // When branchId is provided, pick the first matching location by default
  useEffect(() => {
    if (filteredLocations.length === 0) return;
    if (!locationFilter || locationFilter === "") {
      setLocationFilter(filteredLocations[0].id);
      return;
    }
    if (locationFilter === "all") return;
    const exists = filteredLocations.some((l) => l.id === locationFilter);
    if (!exists) {
      setLocationFilter(filteredLocations[0].id);
    }
  }, [branchId, filteredLocations, locationFilter]);

  useEffect(() => {
    if (!transferForm.from && filteredLocations.length > 0) {
      setTransferForm((prev) => ({ ...prev, from: filteredLocations[0].id }));
    }
    if (!transferForm.to && filteredLocations.length > 1) {
      setTransferForm((prev) => ({ ...prev, to: filteredLocations[1].id }));
    }
  }, [filteredLocations, transferForm.from, transferForm.to]);

  useEffect(() => {
    let cancelled = false;
    async function loadStock() {
      setStockState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", branchId);
        if (locationFilter !== "all") params.set("locationId", locationFilter);
        if (search) params.set("q", search);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/stock${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: InventoryStockRow[] = json.data ?? [];
        if (!cancelled) setStockState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setStockState({ status: "error", data: null, error: "Failed to load stock." });
      }
    }
    loadStock();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, locationFilter, search, stockReloadKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadTransfers() {
      setTransferState({ status: "loading", data: null, error: null });
      try {
        const qs = branchId ? `?branchId=${branchId}` : "";
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/transfers${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: InventoryTransfer[] = json.data ?? [];
        if (!cancelled) setTransferState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setTransferState({ status: "error", data: null, error: "Failed to load transfers." });
      }
    }
    loadTransfers();
    return () => {
      cancelled = true;
    };
  }, [companyId, branchId, transferReloadKey]);

  useEffect(() => {
    if (!receiptLabels.length) {
      setPrintableLabels([]);
      return;
    }
    let active = true;
    async function buildQrs() {
      try {
        const { toDataURL } = await import("qrcode");
        const enriched = await Promise.all(
          receiptLabels.map(async (label) => {
            const qrPayload = buildQrPayload(label);
            const qrDataUrl = await toDataURL(qrPayload, { width: 220, margin: 1 });
            return { ...label, qrDataUrl, qrPayload };
          })
        );
        if (active) setPrintableLabels(enriched);
      } catch (err) {
        // If QR generation fails (missing dep or runtime), still show textual payload.
        const fallback = receiptLabels.map((label) => ({
          ...label,
          qrPayload: buildQrPayload(label),
          qrDataUrl: undefined,
        }));
        if (active) setPrintableLabels(fallback);
      }
    }
    buildQrs();
    return () => {
      active = false;
    };
  }, [receiptLabels]);

  const stockRows = stockState.status === "loaded" ? stockState.data : [];
  const transfers = transferState.status === "loaded" ? transferState.data : [];
  const isStockLoading = stockState.status === "loading";
  const stockError = stockState.status === "error" ? stockState.error : null;
  const transfersLoading = transferState.status === "loading";
  const transfersError = transferState.status === "error" ? transferState.error : null;

  const locationMap = useMemo(() => {
    const map = new Map<string, InventoryLocation>();
    filteredLocations.forEach((l) => map.set(l.id, l));
    return map;
  }, [filteredLocations]);

  const partOptions = useMemo(() => {
    const map = new Map<string, { code: string; name?: string | null }>();
    stockRows.forEach((row) => map.set(row.partsCatalogId, { code: row.partCode, name: row.partName }));
    return Array.from(map.entries()).map(([id, info]) => ({
      id,
      label: info.code || id,
      helper: info.name || "",
    }));
  }, [stockRows]);

  useEffect(() => {
    const realLocations = filteredLocations;
    if (!movementForm.locationId && realLocations.length > 0) {
      setMovementForm((prev) => ({ ...prev, locationId: prev.locationId || realLocations[0].id }));
    }
  }, [filteredLocations, movementForm.locationId]);

  useEffect(() => {
    if (!movementForm.partId && partOptions.length > 0) {
      setMovementForm((prev) => ({ ...prev, partId: prev.partId || partOptions[0].id }));
    }
  }, [partOptions, movementForm.partId]);

  const summary = useMemo(() => {
    const onHandTotal = stockRows.reduce((sum, row) => sum + Number(row.onHand ?? 0), 0);
    const inTransit = transfers.filter((t) => t.status === "in_transit").length;
    const drafts = transfers.filter((t) => t.status === "draft").length;
    return {
      locationCount: filteredLocations.length,
      skuCount: stockRows.length,
      onHandTotal,
      transferSummary: `${inTransit} in transit${drafts ? `, ${drafts} draft` : ""}`,
    };
  }, [filteredLocations.length, stockRows, transfers]);

  const toggleSelectPart = (id: string) => {
    setSelectedParts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const locationLabel = (loc: InventoryLocation) => {
    const code = loc.code ?? "";
    const name = loc.name ?? "";
    if (code && name && code !== name) return `${code} - ${name}`;
    return code || name || "Location";
  };

  async function submitTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !branchId) return;
    const fromId = transferForm.from;
    const toId = transferForm.to;
    if (!fromId || !toId || fromId === toId) {
      setTransferStatus({ saving: false, message: null, error: "Select different From and To locations." });
      return;
    }
    const items = stockRows
      .filter((row) => selectedParts[row.partsCatalogId])
      .map((row) => ({
        partsCatalogId: row.partsCatalogId,
        quantity: Number(row.onHand ?? 0) || 0,
      }))
      .filter((i) => i.quantity > 0);
    if (!items.length) {
      setTransferStatus({ saving: false, message: null, error: "Select items with quantity > 0." });
      return;
    }
    setTransferStatus({ saving: true, message: null, error: null });
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          fromLocationId: fromId,
          toLocationId: toId,
          items,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTransferStatus({ saving: false, message: "Transfer created.", error: null });
      setSelectedParts({});
      setTransferReloadKey((k) => k + 1);
      setStockReloadKey((k) => k + 1);
    } catch (err: any) {
      setTransferStatus({ saving: false, message: null, error: err?.message || "Failed to create transfer." });
    }
  }

  return (
    <MainPageShell
      title="Inventory"
      subtitle={branchId ? "Branch stock by location." : "Company stock by location."}
      scopeLabel={branchId ? `Branch: ${branchId}` : `Company: ${companyId}`}
      primaryAction={
        <span className="text-xs text-muted-foreground">
          {isStockLoading || transfersLoading ? "Refreshing..." : "Up to date"}
        </span>
      }
      secondaryActions={
        <button
          type="button"
          onClick={() => {
            setStockReloadKey((key) => key + 1);
            setTransferReloadKey((key) => key + 1);
            setLocationsReloadKey((key) => key + 1);
          }}
          className="rounded-md border px-3 py-1 text-xs hover:bg-muted"
        >
          Reload data
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Locations" value={summary.locationCount} helper="active" />
          <SummaryCard label="SKUs tracked" value={summary.skuCount} helper="lines with stock" />
          <SummaryCard label="On hand" value={formatNumber(summary.onHandTotal)} helper="units" />
          <SummaryCard label="Transfers" value={summary.transferSummary} helper="Draft and in transit" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-3 rounded-2xl bg-slate-950/70 p-4 shadow-xl">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Location</span>
                <select
                  className={controlClass}
                  value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="all">All</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {locationLabel(loc)}
                  </option>
                ))}
              </select>
            </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Search</span>
                <input
                  className={controlClass}
                  placeholder="Part code or name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
            {isStockLoading && <p className="text-sm text-muted-foreground">Loading stock...</p>}
            {stockError && <p className="text-sm text-destructive">{stockError}</p>}
            {!isStockLoading && !stockError && (
              <div className="overflow-x-auto rounded-md bg-card/80">
                <table className="min-w-full text-xs divide-y divide-muted/30">
                  <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-3 pl-3 pr-4 text-left">Select</th>
                      <th className="py-3 px-4 text-left">Part</th>
                      <th className="py-3 px-4 text-left">Location</th>
                      <th className="py-3 px-4 text-left">On hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                          No stock found.
                        </td>
                      </tr>
                    ) : (
                      stockRows.map((row, idx) => (
                        <tr
                          key={`${row.partsCatalogId}-${row.locationId ?? idx}`}
                          className="bg-transparent hover:bg-muted/10"
                        >
                          <td className="py-3 pl-3 pr-4">
                            <input
                              type="checkbox"
                              checked={!!selectedParts[row.partsCatalogId]}
                              onChange={() => toggleSelectPart(row.partsCatalogId)}
                            />
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="font-semibold">{row.partCode}</div>
                            <div className="text-[11px] text-muted-foreground">{row.partName || "-"}</div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {row.locationCode ? `${row.locationCode} - ${row.locationName ?? ""}` : "Unassigned"}
                          </td>
                          <td className="py-3 px-4 text-xs">{row.onHand}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-2xl bg-slate-950/70 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Transfer selected</h3>
              {transferStatus.message && <div className="text-xs text-emerald-600">{transferStatus.message}</div>}
              {transferStatus.error && <div className="text-xs text-destructive">{transferStatus.error}</div>}
            </div>
            <form className="grid gap-3 md:grid-cols-2 text-sm" onSubmit={submitTransfer}>
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">From location</div>
                <select
                  className={controlClass}
                  value={transferForm.from || ""}
                  onChange={(e) => setTransferForm((p) => ({ ...p, from: e.target.value }))}
              >
                <option value="">Select</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {locationLabel(loc)}
                  </option>
                ))}
              </select>
            </label>
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">To location</div>
                <select
                  className={controlClass}
                  value={transferForm.to || ""}
                  onChange={(e) => setTransferForm((p) => ({ ...p, to: e.target.value }))}
              >
                <option value="">Select</option>
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {locationLabel(loc)}
                  </option>
                ))}
              </select>
            </label>
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={transferStatus.saving || !Object.values(selectedParts).some(Boolean)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {transferStatus.saving ? "Transferring..." : "Create transfer"}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setSelectedParts({});
                    setTransferStatus({ saving: false, message: null, error: null });
                  }}
                >
                  Clear selection
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-3 rounded-2xl bg-slate-950/70 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Transfers</h2>
              <button
                type="button"
                onClick={() => setTransferReloadKey((key) => key + 1)}
                className="rounded-md border px-3 py-1 text-xs hover:bg-muted"
              >
                Refresh
              </button>
            </div>
            {transfersLoading && <p className="text-sm text-muted-foreground">Loading transfers...</p>}
            {transfersError && <p className="text-sm text-destructive">{transfersError}</p>}
            {!transfersLoading && !transfersError && (
              <div className="overflow-x-auto rounded-md bg-card/80">
                <table className="min-w-full text-xs divide-y divide-muted/30">
                  <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-2 pl-3 pr-4 text-left">Transfer</th>
                      <th className="py-2 px-4 text-left">From</th>
                      <th className="py-2 px-4 text-left">To</th>
                      <th className="py-2 px-4 text-left">Status</th>
                      <th className="py-2 px-4 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                          No transfers yet.
                        </td>
                      </tr>
                    ) : (
                      transfers.map((t) => {
                        const from = locationMap.get(t.fromLocationId);
                        const to = locationMap.get(t.toLocationId);
                        return (
                          <tr key={t.id} className="bg-transparent hover:bg-muted/10">
                            <td className="py-3 pl-3 pr-4">
                              <a
                                href={`/company/${companyId}/workshop/inventory/transfers/${t.id}`}
                                className="text-primary hover:underline"
                              >
                                {t.transferNumber}
                              </a>
                            </td>
                            <td className="py-3 px-4 text-xs">
                              {from ? `${from.code} - ${from.name}` : "Unknown"}
                            </td>
                            <td className="py-3 px-4 text-xs">{to ? `${to.code} - ${to.name}` : "Unknown"}</td>
                            <td className="py-3 px-4 text-xs capitalize">{t.status.replace("_", " ")}</td>
                            <td className="py-3 px-4 text-[11px] text-muted-foreground">
                              {new Date(t.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </MainPageShell>
  );
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

function buildQrPayload(label: ReceiptLabel) {
  return `GRN:${label.grnNumber}|PART:${label.partCode}|LOC:${label.locationCode}|QTY:${label.quantity}`;
}

function printLabels(labels: Array<ReceiptLabel & { qrDataUrl?: string; qrPayload: string }>) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "width=600,height=800");
  if (!win) return;
  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 12px; }
      .label { border: 1px solid #ddd; padding: 8px; margin-bottom: 12px; display: flex; gap: 12px; align-items: center; }
      .qr { width: 120px; height: 120px; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; }
      .meta { font-size: 12px; }
      .meta div { margin-bottom: 4px; }
    </style>
  `;
  const content = labels
    .map(
      (label) => `
      <div class="label">
        <div class="qr">
          ${
            label.qrDataUrl
              ? `<img src="${label.qrDataUrl}" alt="QR" style="width:100%;height:100%;" />`
              : `<div style="font-size:10px;">${label.qrPayload}</div>`
          }
        </div>
        <div class="meta">
          <div><strong>GRN:</strong> ${label.grnNumber}</div>
          <div><strong>Part:</strong> ${label.partCode}</div>
          ${label.partName ? `<div><strong>Name:</strong> ${label.partName}</div>` : ""}
          <div><strong>Loc:</strong> ${label.locationCode}</div>
          <div><strong>Qty:</strong> ${label.quantity}</div>
        </div>
      </div>
    `
    )
    .join("\n");

  win.document.write(`<html><head>${styles}</head><body>${content}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
