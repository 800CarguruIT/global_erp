"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderType } from "@repo/ai-core/workshop/procurement/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function ProcurementMain({ companyId }: { companyId: string }) {
  const [state, setState] = useState<LoadState<PurchaseOrder[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [status, setStatus] = useState<PurchaseOrderStatus | "all">("all");
  const [showManualForm, setShowManualForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [poType, setPoType] = useState<PurchaseOrderType>("po");
  const [vendorOptions, setVendorOptions] = useState<{ id: string; name: string }[]>([]);
  const [vendorSelect, setVendorSelect] = useState<string>("");
  const [vendorName, setVendorName] = useState("");
  const [vendorContact, setVendorContact] = useState("");
  const [currency, setCurrency] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const qs = status === "all" ? "" : `?status=${status}`;
        const res = await fetch(`/api/company/${companyId}/workshop/procurement${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: PurchaseOrder[] = json.data ?? [];
        if (!cancelled) setState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load purchase orders." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, status]);

  // Load vendors for dropdown
  useEffect(() => {
    let cancelled = false;
    async function loadVendors() {
      try {
        const res = await fetch(`/api/company/${companyId}/vendors?includeInactive=true`);
        let list: any[] = [];
        if (res.ok) {
          const json = await res.json();
          const rawVendors = json?.vendors ?? json;
          list =
            (Array.isArray(json?.data) && json.data) ||
            (Array.isArray(rawVendors) && rawVendors) ||
            (Array.isArray(rawVendors?.data) && rawVendors.data) ||
            (Array.isArray(rawVendors?.vendors) && rawVendors.vendors) ||
            (Array.isArray(rawVendors?.vendors?.data) && rawVendors.vendors.data) ||
            (Array.isArray(json) && json) ||
            [];
        }

        // Fallback to master companies vendors API if empty
        if (list.length === 0) {
          try {
            const fallback = await fetch(`/api/master/companies/${companyId}`);
            if (fallback.ok) {
              const masterJson = await fallback.json();
              if (Array.isArray(masterJson?.vendors)) {
                list = masterJson.vendors;
              }
            }
          } catch (_err) {
            // ignore
          }
        }

        const opts = list
          .map((v) => ({
            id: v.id,
            name: v.display_name ?? v.displayName ?? v.legal_name ?? v.name ?? v.code ?? "Vendor",
          }))
          .filter((v) => v.id && v.name);
        if (!cancelled) setVendorOptions(opts);
      } catch (_err) {
        // ignore dropdown load errors
      }
    }
    loadVendors();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const isLoading = state.status === "loading";
  const error = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell title="Procurement" subtitle="Purchase orders (PO / LPO) for vendor parts." scopeLabel="">
      <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50"
              value={status}
              onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | "all")}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="partially_received">Partially received</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/company/${companyId}/inventory/order-requests`}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50"
            >
              Inventory requests
            </a>
            <button
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 dark:border-primary/60 dark:bg-primary/20"
              onClick={() => setShowManualForm((v) => !v)}
            >
              {showManualForm ? "Close manual PO" : "New manual PO / LPO"}
            </button>
          </div>
          </div>

        {showManualForm && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <label className="text-sm font-medium">Type</label>
              <select
                className="rounded-md border px-3 py-2 text-sm"
                value={poType}
                onChange={(e) => setPoType(e.target.value as PurchaseOrderType)}
              >
                <option value="po">PO</option>
                <option value="lpo">LPO</option>
              </select>
              <label className="text-sm font-medium">Currency</label>
              <input
                className="rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. AED"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Vendor *</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50"
                value={vendorSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setVendorSelect(val);
                  if (val === "__custom") {
                    setVendorName("");
                  } else {
                    const found = vendorOptions.find((v) => v.id === val);
                    setVendorName(found?.name ?? "");
                  }
                }}
              >
                <option value="">Select vendor</option>
                {vendorOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                  ))}
                  <option value="__custom">Other (manual entry)</option>
                </select>
                {(vendorSelect === "__custom" || (!vendorSelect && vendorName)) && (
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50"
                    placeholder="Enter vendor name"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Vendor contact</label>
                <input
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-50"
                  placeholder="Contact name / phone / email"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                />
              </div>
            </div>
            {manualError && <div className="text-sm text-destructive">{manualError}</div>}
            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                disabled={saving || !vendorName.trim()}
                onClick={async () => {
                  const vendorId = vendorSelect && vendorSelect !== "__custom" ? vendorSelect : null;
                  const vendorLabel = vendorId
                    ? vendorOptions.find((v) => v.id === vendorId)?.name ?? vendorName
                    : vendorName;
                  if (!vendorLabel?.trim()) {
                    setManualError("Vendor name is required.");
                    return;
                  }
                  setSaving(true);
                  setManualError(null);
                  try {
                    const res = await fetch(`/api/company/${companyId}/workshop/procurement`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        poType,
                        vendorId,
                        vendorName: vendorLabel.trim(),
                        vendorContact: vendorContact.trim() || null,
                        currency: currency.trim() || null,
                        items: [],
                      }),
                    });
                    if (!res.ok) {
                      const txt = await res.text();
                      throw new Error(txt || "Failed to create PO");
                    }
                    const json = await res.json();
                    const id = json?.data?.id;
                    setShowManualForm(false);
                    setVendorName("");
                    setVendorContact("");
                    setCurrency("");
                    setPoType("po");
                    setVendorSelect("");
                    // Refresh list
                    setState((prev) =>
                      prev.status === "loaded"
                        ? { status: "loaded", data: [{ ...(json?.data ?? {}) }, ...prev.data], error: null }
                        : prev
                    );
                    if (id) window.location.href = `/company/${companyId}/workshop/procurement/${id}`;
                    else setStatus((prev) => prev); // triggers reload
                  } catch (err: any) {
                    setManualError(err?.message ?? "Failed to create PO");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Creating..." : "Create manual PO"}
              </button>
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => {
                  setShowManualForm(false);
                  setManualError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading POs…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">PO number</th>
                <th className="py-2 px-4 text-left">Vendor</th>
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Total cost</th>
                <th className="py-2 px-4 text-left">Expected</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-xs text-muted-foreground">
                    No purchase orders.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const href = `/company/${companyId}/workshop/procurement/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <a href={href} className="font-medium text-primary hover:underline">
                          {row.poNumber}
                        </a>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.vendorName ?? "—"}</td>
                      <td className="py-2 px-4 text-xs uppercase">{row.poType}</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status.replace("_", " ")}</td>
                      <td className="py-2 px-4 text-xs">{row.totalCost.toFixed(2)}</td>
                      <td className="py-2 px-4 text-xs">{row.expectedDate ?? "—"}</td>
                      <td className="py-2 px-4 text-xs">
                        <a href={href} className="rounded-md border px-2 py-1">
                          Open
                        </a>
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
