"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type {
  InventoryCategory,
  InventoryCarMake,
  InventoryCarModel,
  InventoryLocation,
  InventoryModelYear,
  InventoryStockRow,
  InventorySubcategory,
  InventoryType,
} from "@repo/ai-core/workshop/inventory/types";

type Props = { params: Promise<{ companyId: string }> };

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export default function InventoryStockPage({ params }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(params)
      .then((resolved) => {
        if (!cancelled) setCompanyId(resolved.companyId);
      })
      .catch(() => {
        if (!cancelled) setCompanyId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <InventoryStockPanel companyId={companyId} />
    </AppLayout>
  );
}

function InventoryStockPanel({ companyId }: { companyId: string }) {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [stockState, setStockState] = useState<LoadState<InventoryStockRow[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [inventorySubcategories, setInventorySubcategories] = useState<InventorySubcategory[]>([]);
  const [inventoryMakes, setInventoryMakes] = useState<InventoryCarMake[]>([]);
  const [inventoryModels, setInventoryModels] = useState<InventoryCarModel[]>([]);
  const [inventoryYears, setInventoryYears] = useState<InventoryModelYear[]>([]);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string | "all">("all");
  const [makeFilter, setMakeFilter] = useState<string | "all">("all");
  const [modelFilter, setModelFilter] = useState<string | "all">("all");
  const [yearFilter, setYearFilter] = useState<string | "all">("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [transferModal, setTransferModal] = useState<{ open: boolean; row: InventoryStockRow | null }>({
    open: false,
    row: null,
  });
  const [transferForm, setTransferForm] = useState<{ toLocationId: string; quantity: string }>({
    toLocationId: "",
    quantity: "",
  });
  const [transferStatus, setTransferStatus] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      setLocationsError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations?includeInactive=false`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setLocations(json.data ?? []);
      } catch {
        if (!cancelled) setLocationsError("Failed to load locations.");
      }
    }
    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    let active = true;
    async function loadTaxonomyBase() {
      try {
        const [typesRes, categoriesRes, subcategoriesRes] = await Promise.all([
          fetch(`/api/company/${companyId}/workshop/inventory/types?includeInactive=false`),
          fetch(`/api/company/${companyId}/workshop/inventory/categories?includeInactive=false`),
          fetch(`/api/company/${companyId}/workshop/inventory/subcategories?includeInactive=false`),
        ]);
        if (!typesRes.ok || !categoriesRes.ok || !subcategoriesRes.ok) {
          throw new Error("Failed to load inventory taxonomy");
        }
        const [typesJson, categoriesJson, subcategoriesJson] = await Promise.all([
          typesRes.json(),
          categoriesRes.json(),
          subcategoriesRes.json(),
        ]);
        if (active) {
          setInventoryTypes(typesJson?.data ?? []);
          setInventoryCategories(categoriesJson?.data ?? []);
          setInventorySubcategories(subcategoriesJson?.data ?? []);
        }
      } catch {
        if (active) {
          setInventoryTypes([]);
          setInventoryCategories([]);
          setInventorySubcategories([]);
        }
      }
    }
    loadTaxonomyBase();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    let active = true;
    async function loadMakes() {
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes?includeInactive=false`);
        if (!res.ok) throw new Error("Failed to load makes");
        const json = await res.json();
        if (active) setInventoryMakes(json.data ?? []);
      } catch {
        if (active) setInventoryMakes([]);
      }
    }
    loadMakes();
    return () => {
      active = false;
    };
  }, [companyId, subcategoryFilter]);

  useEffect(() => {
    let active = true;
    async function loadModels() {
      if (!makeFilter || makeFilter === "all") {
        if (active) setInventoryModels([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inventory/models?makeId=${encodeURIComponent(
            makeFilter
          )}&includeInactive=false`
        );
        if (!res.ok) throw new Error("Failed to load models");
        const json = await res.json();
        if (active) setInventoryModels(json.data ?? []);
      } catch {
        if (active) setInventoryModels([]);
      }
    }
    loadModels();
    return () => {
      active = false;
    };
  }, [companyId, makeFilter]);

  useEffect(() => {
    let active = true;
    async function loadYears() {
      if (!modelFilter || modelFilter === "all") {
        if (active) setInventoryYears([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inventory/years?modelId=${encodeURIComponent(
            modelFilter
          )}&includeInactive=false`
        );
        if (!res.ok) throw new Error("Failed to load years");
        const json = await res.json();
        if (active) setInventoryYears(json.data ?? []);
      } catch {
        if (active) setInventoryYears([]);
      }
    }
    loadYears();
    return () => {
      active = false;
    };
  }, [companyId, modelFilter]);

  useEffect(() => {
    let cancelled = false;
    async function loadStock() {
      setStockState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (locationFilter !== "all") params.set("locationId", locationFilter);
        if (search.trim()) params.set("q", search.trim());
        if (typeFilter !== "all") params.set("typeId", typeFilter);
        if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
        if (subcategoryFilter !== "all") params.set("subcategoryId", subcategoryFilter);
        if (makeFilter !== "all") params.set("makeId", makeFilter);
        if (modelFilter !== "all") params.set("modelId", modelFilter);
        if (yearFilter !== "all") params.set("yearId", yearFilter);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/stock${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setStockState({ status: "loaded", data: json.data ?? [], error: null });
      } catch {
        if (!cancelled) setStockState({ status: "error", data: null, error: "Failed to load stock." });
      }
    }
    loadStock();
    return () => {
      cancelled = true;
    };
  }, [
    companyId,
    locationFilter,
    search,
    typeFilter,
    categoryFilter,
    subcategoryFilter,
    makeFilter,
    modelFilter,
    yearFilter,
    reloadKey,
  ]);

  const stockRows = stockState.status === "loaded" ? stockState.data : [];
  const stockError = stockState.status === "error" ? stockState.error : null;
  const isLoading = stockState.status === "loading";

  const locationLabel = (loc: InventoryLocation) => {
    const code = loc.code ?? "";
    const name = loc.name ?? "";
    if (code && name && code !== name) return `${code} - ${name}`;
    return code || name || "Location";
  };

  const summary = useMemo(() => {
    const onHandTotal = stockRows.reduce((sum, row) => sum + Number(row.onHand ?? 0), 0);
    return {
      lines: stockRows.length,
      onHandTotal,
    };
  }, [stockRows]);

  const filteredCategories =
    typeFilter === "all"
      ? inventoryCategories
      : inventoryCategories.filter((cat) => cat.inventoryTypeId === typeFilter);
  const filteredSubcategories =
    categoryFilter === "all"
      ? inventorySubcategories
      : inventorySubcategories.filter((sub) => sub.categoryId === categoryFilter);

  const openTransferModal = (row: InventoryStockRow) => {
    setTransferModal({ open: true, row });
    setTransferForm({
      toLocationId: "",
      quantity: "1",
    });
    setTransferStatus({ loading: false, error: null });
  };

  const closeTransferModal = () => {
    setTransferModal({ open: false, row: null });
    setTransferForm({ toLocationId: "", quantity: "" });
    setTransferStatus({ loading: false, error: null });
  };

  const submitTransfer = async () => {
    const row = transferModal.row;
    if (!row) return;
    if (!row.locationId) {
      setTransferStatus({ loading: false, error: "Source location is required." });
      return;
    }
    if (!transferForm.toLocationId) {
      setTransferStatus({ loading: false, error: "Select a destination location." });
      return;
    }
    if (transferForm.toLocationId === row.locationId) {
      setTransferStatus({ loading: false, error: "Destination must be different from source." });
      return;
    }
    const quantity = Number(transferForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTransferStatus({ loading: false, error: "Enter a valid quantity." });
      return;
    }
    if (row.onHand > 0 && quantity > row.onHand) {
      setTransferStatus({ loading: false, error: "Quantity exceeds available stock." });
      return;
    }
    setTransferStatus({ loading: true, error: null });
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocationId: row.locationId,
          toLocationId: transferForm.toLocationId,
          items: [{ partsCatalogId: row.partsCatalogId, quantity }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const transferId = json?.data?.transfer?.id;
      if (transferId) {
        window.location.href = `/company/${companyId}/inventory/transfers/${transferId}`;
        return;
      }
      setTransferStatus({ loading: false, error: "Transfer created but no ID returned." });
    } catch {
      setTransferStatus({ loading: false, error: "Failed to create transfer." });
    }
  };

  return (
    <MainPageShell
      title="Inventory Stock"
      subtitle="On-hand stock by location."
      scopeLabel={`Company: ${companyId}`}
      primaryAction={<span className="text-xs text-muted-foreground">{isLoading ? "Refreshing..." : "Up to date"}</span>}
      contentClassName="rounded-2xl border-0 bg-transparent p-0"
      secondaryActions={
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="rounded-md border px-3 py-1 text-xs hover:bg-muted"
        >
          Reload data
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-950/70 p-4 shadow-xl">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">SKU lines</div>
            <div className="text-2xl font-semibold text-slate-100">{summary.lines}</div>
          </div>
          <div className="rounded-2xl bg-slate-950/70 p-4 shadow-xl">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">On hand</div>
            <div className="text-2xl font-semibold text-slate-100">{summary.onHandTotal}</div>
          </div>
        </div>

        <section className="space-y-4 rounded-2xl bg-slate-950/70 p-4 shadow-xl">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Location</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="all">All</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {locationLabel(loc)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Type</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={typeFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setTypeFilter(next);
                  setCategoryFilter("all");
                  setSubcategoryFilter("all");
                  setMakeFilter("all");
                  setModelFilter("all");
                  setYearFilter("all");
                }}
              >
                <option value="all">All</option>
                {inventoryTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.code} - {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={categoryFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setCategoryFilter(next);
                  setSubcategoryFilter("all");
                  setMakeFilter("all");
                  setModelFilter("all");
                  setYearFilter("all");
                }}
              >
                <option value="all">All</option>
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.code} - {cat.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Subcategory</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={subcategoryFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setSubcategoryFilter(next);
                  setMakeFilter("all");
                  setModelFilter("all");
                  setYearFilter("all");
                }}
              >
                <option value="all">All</option>
                {filteredSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Make</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={makeFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setMakeFilter(next);
                  setModelFilter("all");
                  setYearFilter("all");
                }}
              >
                <option value="all">All</option>
                {inventoryMakes.map((make) => (
                  <option key={make.id} value={make.id}>
                    {make.code} - {make.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Model</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={modelFilter}
                onChange={(e) => {
                  const next = e.target.value;
                  setModelFilter(next);
                  setYearFilter("all");
                }}
                disabled={makeFilter === "all"}
              >
                <option value="all">All</option>
                {inventoryModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.code} - {model.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Year</span>
              <select
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                disabled={modelFilter === "all"}
              >
                <option value="all">All</option>
                {inventoryYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Search</span>
              <input
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                placeholder="Part code or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setLocationFilter("all");
                setTypeFilter("all");
                setCategoryFilter("all");
                setSubcategoryFilter("all");
                setMakeFilter("all");
                setModelFilter("all");
                setYearFilter("all");
              }}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
            >
              Reset filters
            </button>
            {locationsError && <span className="text-xs text-destructive">{locationsError}</span>}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Loading stock...</p>}
          {stockError && <p className="text-sm text-destructive">{stockError}</p>}
          {!isLoading && !stockError && (
            <div className="rounded-xl bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.12)]">
              <div className="overflow-x-auto rounded-md bg-slate-950/60">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="py-3 px-4 text-left">Part</th>
                    <th className="py-3 px-4 text-left">Type</th>
                    <th className="py-3 px-4 text-left">Category</th>
                    <th className="py-3 px-4 text-left">Subcategory</th>
                    <th className="py-3 px-4 text-left">Location</th>
                    <th className="py-3 px-4 text-right">On hand</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                        No stock found.
                      </td>
                    </tr>
                  ) : (
                    stockRows.map((row, idx) => (
                      <tr key={`${row.partsCatalogId}-${row.locationId ?? idx}`}>
                          <td className="py-3 px-4 text-sm">
                            <div className="font-semibold text-slate-100">{row.partName || "-"}</div>
                            <div className="text-[11px] text-slate-400">{row.partCode || "PART"}</div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-200">{row.partType || "-"}</td>
                        <td className="py-3 px-4 text-xs text-slate-200">
                          {row.category
                            ? `${row.category}${row.categoryCode ? ` (${row.categoryCode})` : ""}`
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-200">
                          {row.subcategory
                            ? `${row.subcategory}${row.subcategoryCode ? ` (${row.subcategoryCode})` : ""}`
                            : "-"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-200">
                          {row.locationCode ? `${row.locationCode} - ${row.locationName ?? ""}` : "Unassigned"}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-100">{row.onHand}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openTransferModal(row)}
                            disabled={!row.locationId}
                            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                          >
                            Request transfer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {transferModal.open && transferModal.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Request transfer</div>
                <div className="text-lg font-semibold">Move stock between locations</div>
              </div>
              <button
                type="button"
                onClick={closeTransferModal}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl bg-slate-900/60 p-3 text-sm">
                <div className="font-semibold">{transferModal.row.partName || "Part"}</div>
                <div className="text-xs text-slate-400">{transferModal.row.partCode || "-"}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Source</span>
                  <input
                    readOnly
                    value={
                      transferModal.row.locationCode
                        ? `${transferModal.row.locationCode} - ${transferModal.row.locationName ?? ""}`
                        : "Unassigned"
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-300">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Destination</span>
                  <select
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={transferForm.toLocationId}
                    onChange={(e) => setTransferForm((prev) => ({ ...prev, toLocationId: e.target.value }))}
                  >
                    <option value="">Select location</option>
                    {locations
                      .filter((loc) => loc.id !== transferModal.row?.locationId)
                      .map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {locationLabel(loc)}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="space-y-1 text-xs text-slate-300">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Quantity (Available: {transferModal.row.onHand})
                </span>
                <input
                  type="number"
                  min={1}
                  max={transferModal.row.onHand > 0 ? transferModal.row.onHand : undefined}
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              {transferStatus.error && <div className="text-xs text-destructive">{transferStatus.error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
              <button
                type="button"
                onClick={closeTransferModal}
                className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitTransfer}
                disabled={transferStatus.loading || !transferModal.row.locationId}
                className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900"
              >
                {transferStatus.loading ? "Creating..." : "Create transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
