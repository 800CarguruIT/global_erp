"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  PurchaseOrder,
  PurchaseOrderGrnEntry,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrderType,
} from "@repo/ai-core/workshop/procurement/types";
import type {
  InventoryCategory,
  InventoryCarMake,
  InventoryCarModel,
  InventoryModelYear,
  InventorySubcategory,
} from "@repo/ai-core/workshop/inventory/types";

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
  receivedQty?: number;
  status?: PurchaseOrderItem["status"];
  partsCatalogId?: string | null;
  inventoryRequestItemId?: string | null;
  movedToInventory?: boolean;
  inventoryTypeId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  makeId?: string | null;
  modelId?: string | null;
  yearId?: string | null;
  partType?: string | null;
  unit?: string | null;
  partBrand?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

export function ProcurementDetailMain({ companyId, poId }: { companyId: string; poId: string }) {
  const errorMessage = (err: unknown, fallback: string) => {
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  };
  const [state, setState] = useState<
    LoadState<{ po: PurchaseOrder; items: PurchaseOrderItem[]; grns: PurchaseOrderGrnEntry[] }>
  >({
    status: "loading",
    data: null,
    error: null,
  });
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<
    Array<{ id: string; name: string; code: string; isActive: boolean }>
  >([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [inventorySubcategories, setInventorySubcategories] = useState<InventorySubcategory[]>([]);
  const [inventoryMakes, setInventoryMakes] = useState<InventoryCarMake[]>([]);
  const [inventoryModels, setInventoryModels] = useState<InventoryCarModel[]>([]);
  const [inventoryYears, setInventoryYears] = useState<InventoryModelYear[]>([]);
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
  const [receiveStatus, setReceiveStatus] = useState<
    Record<string, { loading: boolean; error?: string | null }>
  >({});
  const [reconcileStatus, setReconcileStatus] = useState<{
    loading: boolean;
    error?: string | null;
    message?: string | null;
  }>({ loading: false, error: null, message: null });
  const [moveStatus, setMoveStatus] = useState<Record<string, { loading: boolean; error?: string | null }>>({});
  const [moveModal, setMoveModal] = useState<{ open: boolean; itemId: string; itemName: string }>({
    open: false,
    itemId: "",
    itemName: "",
  });
  const [moveForm, setMoveForm] = useState({
    type: "OEM",
    partType: "OE",
    categoryId: "",
    categoryCustom: "",
    subcategoryId: "",
    subcategoryCustom: "",
    makeId: "",
    modelId: "",
    yearId: "",
    unit: "EA",
    brand: "",
  });

  const loadPurchaseOrder = useCallback(async (opts?: { keepLoading?: boolean }) => {
    const keepLoading = opts?.keepLoading ?? false;
    if (!keepLoading) {
      setState({ status: "loading", data: null, error: null });
    }
    const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const po: PurchaseOrder =
      json.data?.po ?? json.data?.purchaseOrder ?? json.data?.data ?? json.data?.po ?? json.data;
    const list: PurchaseOrderItem[] = json.data?.items ?? [];
    const grns: PurchaseOrderGrnEntry[] = json.data?.grns ?? [];
    setState({ status: "loaded", data: { po, items: list, grns }, error: null });
    setItems(
      list.map((i) => ({
        id: i.id,
        lineNo: i.lineNo,
        name: i.name ?? "",
        description: i.description ?? "",
        quantity: i.quantity ?? 0,
        unitCost: i.unitCost ?? 0,
        receivedQty: i.receivedQty ?? 0,
        status: i.status,
        partsCatalogId: i.partsCatalogId ?? null,
        inventoryRequestItemId: i.inventoryRequestItemId ?? null,
        movedToInventory: i.movedToInventory ?? false,
        inventoryTypeId: i.inventoryTypeId ?? null,
        categoryId: i.categoryId ?? null,
        subcategoryId: i.subcategoryId ?? null,
        makeId: i.makeId ?? null,
        modelId: i.modelId ?? null,
        yearId: i.yearId ?? null,
        partType: i.partType ?? null,
        unit: i.unit ?? null,
        partBrand: i.partBrand ?? null,
        category: i.category ?? null,
        subcategory: i.subcategory ?? null,
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
  }, [companyId, poId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPurchaseOrder();
      } catch {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load purchase order." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPurchaseOrder]);

  useEffect(() => {
    let active = true;
    async function loadTypes() {
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inventory/types?includeInactive=true`
        );
        if (!res.ok) throw new Error("Failed to load inventory types");
        const json = await res.json();
        if (active) setInventoryTypes(json.data ?? []);
      } catch {
        if (active) setInventoryTypes([]);
      }
    }
    loadTypes();
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    let active = true;
    async function loadMakes() {
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes?includeInactive=true`);
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
  }, [companyId]);

  useEffect(() => {
    let active = true;
    async function loadModels() {
      if (!moveForm.makeId) {
        if (active) setInventoryModels([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inventory/models?makeId=${encodeURIComponent(
            moveForm.makeId
          )}&includeInactive=true`
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
  }, [companyId, moveForm.makeId]);

  useEffect(() => {
    let active = true;
    async function loadYears() {
      if (!moveForm.modelId) {
        if (active) setInventoryYears([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/company/${companyId}/workshop/inventory/years?modelId=${encodeURIComponent(
            moveForm.modelId
          )}&includeInactive=true`
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
  }, [companyId, moveForm.modelId]);

  useEffect(() => {
    let active = true;
    async function loadTaxonomy() {
      try {
        const [categoriesRes, subcategoriesRes] = await Promise.all([
          fetch(`/api/company/${companyId}/workshop/inventory/categories?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/subcategories?includeInactive=true`),
        ]);
        if (!categoriesRes.ok || !subcategoriesRes.ok) {
          throw new Error("Failed to load inventory taxonomy");
        }
        const [categoriesJson, subcategoriesJson] = await Promise.all([
          categoriesRes.json(),
          subcategoriesRes.json(),
        ]);
        if (active) {
          setInventoryCategories(categoriesJson?.data ?? []);
          setInventorySubcategories(subcategoriesJson?.data ?? []);
        }
      } catch {
        if (active) {
          setInventoryCategories([]);
          setInventorySubcategories([]);
        }
      }
    }
    loadTaxonomy();
    return () => {
      active = false;
    };
  }, [companyId]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitCost ?? 0), 0);
    const vatRate = 0.05;
    const vat = subtotal * vatRate;
    const totalWithVat = subtotal + vat;
    return { subtotal, vat, totalWithVat, vatRate };
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
          partsCatalogId: i.partsCatalogId ?? null,
          inventoryRequestItemId: i.inventoryRequestItemId ?? null,
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

  const availableSubcategories = useMemo(() => {
    if (!moveForm.categoryId || moveForm.categoryId === "Custom") return inventorySubcategories;
    return inventorySubcategories.filter((sub) => sub.categoryId === moveForm.categoryId);
  }, [inventorySubcategories, moveForm.categoryId]);

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

  const selectedCategory = inventoryCategories.find((cat) => cat.id === moveForm.categoryId);
  const selectedSubcategory = inventorySubcategories.find((sub) => sub.id === moveForm.subcategoryId);
  const resolvedCategory =
    moveForm.categoryId === "Custom"
      ? moveForm.categoryCustom
      : selectedCategory?.code ?? selectedCategory?.name ?? "";
  const resolvedSubcategory =
    moveForm.subcategoryId === "Custom"
      ? moveForm.subcategoryCustom
      : selectedSubcategory?.code ?? selectedSubcategory?.name ?? "";
  const generatedPartCode = buildPartCode(moveModal.itemId, moveForm.type, resolvedCategory, resolvedSubcategory);

  return (
    <MainPageShell
      title="Procurement"
      subtitle="Purchase order / LPO."
      scopeLabel={`PO ${po.poNumber}`}
      primaryAction={
        <div className="flex items-center gap-2 text-xs text-slate-300">
          {isSaving ? "Saving…" : "Autosaves"} · Total {totals.totalWithVat.toFixed(2)}
        </div>
      }
      contentClassName="rounded-none bg-transparent p-0"
      secondaryActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-slate-800/80 px-3 py-1 text-sm font-medium text-slate-100 hover:bg-slate-700/80"
          >
            Save
          </button>
          {editable ? (
            <button
              type="button"
              onClick={() => setHeader((p) => ({ ...p, status: "issued" as PurchaseOrderStatus }))}
              className="rounded-md bg-emerald-600/80 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Issue PO
            </button>
          ) : null}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        </div>
      }
    >
      <div className="rounded-2xl bg-slate-950/70 p-5 shadow-[0_25px_80px_-50px_rgba(15,23,42,0.9)]">
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-white/5 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Purchase order</div>
              <div className="text-lg font-semibold text-slate-100">{po.poNumber}</div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
              {header.status ?? po.status}
            </span>
          </div>

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

        <section className="space-y-4 rounded-2xl border border-white/5 bg-slate-950/60 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Items</div>
              <div className="text-sm font-semibold text-slate-100">Line items & costs</div>
            </div>
            {editable && (
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { name: "New item", description: "", quantity: 1, unitCost: 0 },
                  ])
                }
                className="rounded-md border border-white/10 bg-slate-900/70 px-3 py-1 text-sm font-medium text-slate-100 hover:bg-slate-800/80"
              >
                Add line
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/70">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-300">
                  <th className="py-1 pl-2 pr-3 text-left">Item</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                  <th className="px-2 py-1 text-left">Unit cost</th>
                  <th className="px-2 py-1 text-right">Line total</th>
                  <th className="px-2 py-1 text-left">VAT (%)</th>
                  <th className="px-2 py-1 text-right">Total (incl. VAT)</th>
                  <th className="px-2 py-1 text-left">Order status</th>
                  <th className="px-2 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                      <td colSpan={8} className="py-2 text-center text-xs text-slate-400">
                        No items.
                      </td>
                    </tr>
                ) : (
                  items.map((item, idx) => {
                    const lineTotal = (item.quantity ?? 0) * (item.unitCost ?? 0);
                    const lineVat = lineTotal * totals.vatRate;
                    const lineWithVat = lineTotal + lineVat;
                    const remainingQty = Math.max(
                      Number(item.quantity ?? 0) - Number(item.receivedQty ?? 0),
                      0
                    );
                    const canReceiveLine =
                      !editable &&
                      remainingQty > 0 &&
                      item.status?.toLowerCase() !== "cancelled" &&
                      item.status?.toLowerCase() !== "received";
                    return (
                      <tr key={item.id ?? idx} className="border-t border-white/5">
                      <td className="py-1 pl-2 pr-3 align-top">
                        <input
                          className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
                          value={item.name}
                          onChange={(e) => updateItem(idx, { name: e.target.value })}
                          readOnly={!editable || item.status?.toLowerCase() === "received"}
                        />
                        <textarea
                          className="mt-1 h-14 w-full resize-none rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
                          value={item.description ?? ""}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          readOnly={!editable || item.status?.toLowerCase() === "received"}
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <input
                          type="number"
                          className="w-20 rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          min={0}
                          readOnly={!editable || item.status?.toLowerCase() === "received"}
                        />
                      </td>
                      <td className="px-2 py-1 align-top">
                        <input
                          type="number"
                          className="w-24 rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-slate-100 focus:border-emerald-400/60 focus:outline-none"
                          value={item.unitCost}
                          onChange={(e) => updateItem(idx, { unitCost: Number(e.target.value) })}
                          min={0}
                          step="0.01"
                          readOnly={!editable || item.status?.toLowerCase() === "received"}
                        />
                      </td>
                      <td className="px-2 py-1 align-top text-right text-slate-100">{lineTotal.toFixed(2)}</td>
                      <td className="px-2 py-1 align-top text-xs text-slate-200">
                        {(totals.vatRate * 100).toFixed(0)}
                      </td>
                      <td className="px-2 py-1 align-top text-right text-slate-100">
                        {lineWithVat.toFixed(2)}
                      </td>
                      <td className="px-2 py-1 align-top">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-200 capitalize">
                          {item.status ?? "pending"}
                        </span>
                        <div className="mt-1 text-[10px] text-slate-400">
                          Received {Number(item.receivedQty ?? 0)} / {Number(item.quantity ?? 0)}
                        </div>
                      </td>
                        <td className="px-2 py-1 align-top">
                          {item.inventoryRequestItemId &&
                          item.status?.toLowerCase() === "received" ? (
                            <div className="flex items-center gap-2">
                              {item.movedToInventory ? (
                                <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[11px] text-sky-200">
                                  Moved to inventory
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openMoveModal(item.id ?? "", item.name ?? "")}
                                  disabled={!item.id || moveStatus[item.id ?? ""]?.loading}
                                  className="rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
                                >
                                  {moveStatus[item.id ?? ""]?.loading ? "Moving…" : "Move to inventory"}
                                </button>
                              )}
                              {moveStatus[item.id ?? ""]?.error && (
                                <span className="text-[11px] text-rose-300">
                                  {moveStatus[item.id ?? ""]?.error}
                                </span>
                              )}
                            </div>
                          ) : canReceiveLine ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => receiveRemaining(item.id ?? "", remainingQty)}
                                disabled={!item.id || receiveStatus[item.id ?? ""]?.loading}
                                className="rounded-md bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-60"
                              >
                                {receiveStatus[item.id ?? ""]?.loading
                                  ? "Receiving..."
                                  : `Receive ${remainingQty}`}
                              </button>
                              {receiveStatus[item.id ?? ""]?.error && (
                                <span className="text-[11px] text-rose-300">
                                  {receiveStatus[item.id ?? ""]?.error}
                                </span>
                              )}
                            </div>
                          ) : editable && item.status?.toLowerCase() !== "received" ? (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="rounded-md bg-rose-500/20 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/30"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {item.status ?? "Pending"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="grid w-full max-w-sm gap-2 rounded-xl border border-white/5 bg-slate-950/80 p-3 text-xs text-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">Subtotal</span>
                <span className="text-sm font-semibold text-slate-100">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">VAT ({(totals.vatRate * 100).toFixed(0)}%)</span>
                <span className="text-sm font-semibold text-amber-200">{totals.vat.toFixed(2)}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-slate-300">Total (incl. VAT)</span>
                <span className="text-base font-semibold text-emerald-200">{totals.totalWithVat.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border border-white/5 bg-slate-950/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">GRN</div>
              <div className="text-sm font-semibold text-slate-100">Goods receipt notes</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <a
                  href={`/company/${companyId}/workshop/procurement/${poId}/grn`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-slate-400/30 bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-500/20"
                >
                  View GRN
                </a>
                <a
                  href={`/api/company/${companyId}/workshop/procurement/${poId}/grn/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
                >
                  GRN PDF
                </a>
                <button
                  type="button"
                  onClick={reconcileGrn}
                  disabled={reconcileStatus.loading}
                  className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-60"
                >
                  {reconcileStatus.loading ? "Reconciling..." : "Reconcile GRN"}
                </button>
              </div>
              {reconcileStatus.error ? (
                <span className="text-[11px] text-rose-300">{reconcileStatus.error}</span>
              ) : reconcileStatus.message ? (
                <span className="text-[11px] text-emerald-300">{reconcileStatus.message}</span>
              ) : null}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/70">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-300">
                  <th className="py-2 pl-3 pr-4 text-left">GRN Number</th>
                  <th className="px-4 py-2 text-left">Part</th>
                  <th className="px-4 py-2 text-left">Qty</th>
                  <th className="px-4 py-2 text-left">Received At</th>
                </tr>
              </thead>
              <tbody>
                {(state.data?.grns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-xs text-slate-400">
                      No GRN entries yet.
                    </td>
                  </tr>
                ) : (
                  (state.data?.grns ?? []).map((grn) => (
                    <tr key={grn.id} className="border-t border-white/5">
                      <td className="py-2 pl-3 pr-4 font-semibold text-emerald-300">{grn.grnNumber}</td>
                      <td className="px-4 py-2 text-slate-100">
                        {grn.partName}
                      </td>
                      <td className="px-4 py-2 text-slate-100">{grn.quantity}</td>
                      <td className="px-4 py-2 text-slate-300">
                        {grn.createdAt ? new Date(grn.createdAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
      {moveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-slate-100 p-6 text-slate-900 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Move to inventory</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">Confirm move</div>
            <p className="mt-2 text-sm text-slate-600">
              Move the received item into inventory and generate a part code.
            </p>
            <div className="mt-3 rounded-lg bg-slate-200/80 p-3 text-sm text-slate-700">
              <div className="text-xs text-slate-500">Item</div>
              <div className="font-semibold text-slate-900">{moveModal.itemName || "Part"}</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
              <label className="space-y-1">
                <div className="text-xs text-slate-500">Type</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.type}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="">Select</option>
                  {inventoryTypes.map((opt) => (
                    <option key={opt.id} value={opt.code}>
                      {opt.code} - {opt.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Part type</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.partType}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, partType: e.target.value }))}
                >
                  <option value="">Select</option>
                  <option value="OE">OE</option>
                  <option value="OEM">OEM</option>
                  <option value="After Market">After Market</option>
                  <option value="Used">Used</option>
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Unit</div>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.unit}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, unit: e.target.value }))}
                  placeholder="EA"
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Category</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.categoryId}
                  onChange={(e) =>
                    setMoveForm((prev) => ({
                      ...prev,
                      categoryId: e.target.value,
                      categoryCustom: "",
                      subcategoryId: "",
                      subcategoryCustom: "",
                    }))
                  }
                >
                  <option value="">Select</option>
                  {inventoryCategories.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Subcategory</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.subcategoryId}
                  onChange={(e) =>
                    setMoveForm((prev) => ({ ...prev, subcategoryId: e.target.value, subcategoryCustom: "" }))
                  }
                >
                  <option value="">Select</option>
                  {availableSubcategories.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Car make</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.makeId}
                  onChange={(e) =>
                    setMoveForm((prev) => ({ ...prev, makeId: e.target.value, modelId: "", yearId: "" }))
                  }
                >
                  <option value="">Select</option>
                  {inventoryMakes.map((make) => (
                    <option key={make.id} value={make.id}>
                      {make.code} - {make.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Car model</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.modelId}
                  onChange={(e) =>
                    setMoveForm((prev) => ({ ...prev, modelId: e.target.value, yearId: "" }))
                  }
                  disabled={!moveForm.makeId}
                >
                  <option value="">Select</option>
                  {inventoryModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.code} - {model.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Year</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.yearId}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, yearId: e.target.value }))}
                  disabled={!moveForm.modelId}
                >
                  <option value="">Select</option>
                  {inventoryYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.year}
                    </option>
                  ))}
                </select>
              </label>

              {moveForm.categoryId === "Custom" && (
                <label className="space-y-1 md:col-span-2">
                  <div className="text-xs text-slate-500">Custom category</div>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={moveForm.categoryCustom}
                    onChange={(e) => setMoveForm((prev) => ({ ...prev, categoryCustom: e.target.value }))}
                    placeholder="Enter category"
                  />
                </label>
              )}

              {moveForm.subcategoryId === "Custom" && (
                <label className="space-y-1 md:col-span-2">
                  <div className="text-xs text-slate-500">Custom subcategory</div>
                  <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={moveForm.subcategoryCustom}
                    onChange={(e) => setMoveForm((prev) => ({ ...prev, subcategoryCustom: e.target.value }))}
                    placeholder="Enter subcategory"
                  />
                </label>
              )}

              <label className="space-y-1">
                <div className="text-xs text-slate-500">Brand (optional)</div>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={moveForm.brand}
                  onChange={(e) => setMoveForm((prev) => ({ ...prev, brand: e.target.value }))}
                  placeholder="Brand"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <div className="text-xs text-slate-500">Part code (auto)</div>
                <input
                  className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  value={generatedPartCode || ""}
                  readOnly
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveModal({ open: false, itemId: "", itemName: "" })}
                className="rounded-md bg-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await moveToInventory(moveModal.itemId, {
                    partNumber: generatedPartCode,
                    partBrand: moveForm.brand || moveForm.type,
                    unit: moveForm.unit,
                    category: resolvedCategory,
                    subcategory: resolvedSubcategory,
                    partType: moveForm.partType || moveForm.type,
                    makeId: moveForm.makeId || null,
                    modelId: moveForm.modelId || null,
                    yearId: moveForm.yearId || null,
                  });
                  setMoveModal({ open: false, itemId: "", itemName: "" });
                }}
                className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Move to inventory
              </button>
            </div>
          </div>
        </div>
      )}
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
      };
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function openMoveModal(itemId: string, itemName: string) {
    if (!itemId) return;
    const selectedItem = items.find((i) => i.id === itemId);
    const typeFromItem = selectedItem?.inventoryTypeId
      ? inventoryTypes.find((t) => t.id === selectedItem.inventoryTypeId)?.code
      : inventoryTypes[0]?.code;
    const resolvedCategoryId =
      selectedItem?.categoryId ??
      (selectedItem?.category
        ? inventoryCategories.find(
            (cat) =>
              cat.code?.toLowerCase() === selectedItem.category?.toLowerCase() ||
              cat.name?.toLowerCase() === selectedItem.category?.toLowerCase()
          )?.id
        : "");
    const resolvedSubcategoryId =
      selectedItem?.subcategoryId ??
      (selectedItem?.subcategory
        ? inventorySubcategories.find(
            (sub) =>
              sub.code?.toLowerCase() === selectedItem.subcategory?.toLowerCase() ||
              sub.name?.toLowerCase() === selectedItem.subcategory?.toLowerCase()
          )?.id
        : "");
    setMoveForm({
      type: typeFromItem ?? "",
      partType: selectedItem?.partType ?? "OE",
      categoryId: resolvedCategoryId ?? "",
      categoryCustom: "",
      subcategoryId: resolvedSubcategoryId ?? "",
      subcategoryCustom: "",
      makeId: selectedItem?.makeId ?? "",
      modelId: selectedItem?.modelId ?? "",
      yearId: selectedItem?.yearId ?? "",
      unit: selectedItem?.unit ?? "EA",
      brand: selectedItem?.partBrand ?? "",
    });
    setMoveModal({ open: true, itemId, itemName });
  }

  async function moveToInventory(
    itemId: string,
    payload?: {
      partNumber?: string;
      partBrand?: string;
      unit?: string;
      category?: string;
      subcategory?: string;
      partType?: string;
      makeId?: string | null;
      modelId?: string | null;
      yearId?: string | null;
    }
  ) {
    if (!itemId) return;
    setMoveStatus((prev) => ({ ...prev, [itemId]: { loading: true } }));
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/procurement/${poId}/move-to-inventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, ...payload }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setMoveStatus((prev) => ({ ...prev, [itemId]: { loading: false, error: null } }));
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, movedToInventory: true } : item))
      );
    } catch (err: unknown) {
      setMoveStatus((prev) => ({
        ...prev,
        [itemId]: { loading: false, error: errorMessage(err, "Failed to move") },
      }));
    }
  }

  async function receiveRemaining(itemId: string, quantity: number) {
    if (!itemId || quantity <= 0) return;
    setReceiveStatus((prev) => ({ ...prev, [itemId]: { loading: true, error: null } }));
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ itemId, quantity }] }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadPurchaseOrder({ keepLoading: true });
      setReceiveStatus((prev) => ({ ...prev, [itemId]: { loading: false, error: null } }));
    } catch (err: unknown) {
      setReceiveStatus((prev) => ({
        ...prev,
        [itemId]: { loading: false, error: errorMessage(err, "Failed to receive parts") },
      }));
    }
  }

  async function reconcileGrn() {
    setReconcileStatus({ loading: true, error: null, message: null });
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/procurement/${poId}/reconcile-grn`, {
        method: "POST",
      });
      const raw = await res.text();
      let json: { error?: string; message?: string; data?: { reconciledItems?: number; reconciledQty?: number } } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        json = {};
      }
      if (!res.ok) {
        throw new Error(json?.error ?? json?.message ?? raw ?? "Failed to reconcile GRN");
      }
      const reconciledItems = Number(json?.data?.reconciledItems ?? 0);
      const reconciledQty = Number(json?.data?.reconciledQty ?? 0);
      setReconcileStatus({
        loading: false,
        error: null,
        message: `Reconciled ${reconciledItems} item(s), qty ${reconciledQty.toFixed(2)}.`,
      });
      await loadPurchaseOrder({ keepLoading: true });
    } catch (err: unknown) {
      setReconcileStatus({
        loading: false,
        error: errorMessage(err, "Failed to reconcile GRN"),
        message: null,
      });
    }
  }

}

function buildPartCode(itemId: string, type?: string, category?: string, subcategory?: string) {
  const clean = (value: string | undefined, length: number) => {
    if (!value) return "NA";
    return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, length) || "NA";
  };
  const suffix = itemId ? itemId.replace(/-/g, "").slice(-4).toUpperCase() : "0000";
  return `${clean(type, 3)}-${clean(category, 3)}-${clean(subcategory, 3)}-${suffix}`;
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
      <label className="text-xs font-medium text-slate-200">{label}</label>
      <select
        className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none"
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
      <label className="text-xs font-medium text-slate-200">{label}</label>
      <input
        className="w-full rounded border border-white/10 bg-slate-900/70 px-2 py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
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
      <label className="text-xs font-medium text-slate-200">{label}</label>
      <textarea
        className="h-24 w-full resize-none rounded border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
