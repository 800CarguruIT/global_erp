"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@repo/ui";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type {
  InventoryOrderRequest,
  InventoryOrderRequestItem,
  InventoryOrderRequestType,
} from "@repo/ai-core/workshop/inventory-requests/types";
import type {
  InventoryCategory,
  InventoryCarMake,
  InventoryCarModel,
  InventoryModelYear,
  InventorySubcategory,
  InventoryType,
} from "@repo/ai-core/workshop/inventory/types";

type Props = { params: Promise<{ companyId: string }> };

type RequestWithItems = InventoryOrderRequest & { items: InventoryOrderRequestItem[] };

type ItemDraft = {
  id: string;
  partName: string;
  partNumber: string;
  partBrand: string;
  partType: string;
  quantity: number;
  unit: string;
  category: string;
  subcategory: string;
  inventoryTypeId: string;
  categoryId: string;
  subcategoryId: string;
  makeId: string;
  modelId: string;
  yearId: string;
  description: string;
};

const randomId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const createEmptyItem = (): ItemDraft => ({
  id: randomId(),
  partName: "",
  partNumber: "",
  partBrand: "",
  partType: "",
  quantity: 1,
  unit: "EA",
  category: "",
  subcategory: "",
  inventoryTypeId: "",
  categoryId: "",
  subcategoryId: "",
  makeId: "",
  modelId: "",
  yearId: "",
  description: "",
});

export default function InventoryOrderRequestsPage({ params }: Props) {
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
      <InventoryOrderRequestsPanel companyId={companyId} />
    </AppLayout>
  );
}

function InventoryOrderRequestsPanel({ companyId }: { companyId: string }) {
  const [requests, setRequests] = useState<RequestWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<InventoryOrderRequestType>("inventory");
  const [estimateId, setEstimateId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>(() => [createEmptyItem()]);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [quoteStatusByItem, setQuoteStatusByItem] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Array<{ id: number; name: string; type?: string | null }>>([]);
  const [productResults, setProductResults] = useState<Array<{ id: number; name: string; type?: string | null }>>([]);
  const [productOpenIndex, setProductOpenIndex] = useState<number | null>(null);
  const [inventoryTypes, setInventoryTypes] = useState<InventoryType[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [inventorySubcategories, setInventorySubcategories] = useState<InventorySubcategory[]>([]);
  const [inventoryMakes, setInventoryMakes] = useState<InventoryCarMake[]>([]);
  const [modelsByMake, setModelsByMake] = useState<Record<string, InventoryCarModel[]>>({});
  const [yearsByModel, setYearsByModel] = useState<Record<string, InventoryModelYear[]>>({});

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/order-requests`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRequests(Array.isArray(json?.data) ? json.data : []);
      const quotesRes = await fetch(`/api/company/${companyId}/part-quotes`);
      if (quotesRes.ok) {
        const quotesJson = await quotesRes.json();
        const rows = Array.isArray(quotesJson?.data) ? quotesJson.data : [];
        const map: Record<string, string> = {};
        rows.forEach((row: any) => {
          const key = row.inventoryRequestItemId;
          if (!key) return;
          const status = (row.status ?? "").toString();
          map[key] = status;
        });
        setQuoteStatusByItem(map);
      } else {
        setQuoteStatusByItem({});
      }
    } catch (err) {
      setError("Failed to load order requests.");
      setQuoteStatusByItem({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [companyId]);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProducts(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTaxonomy() {
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
        if (!active) return;
        setInventoryTypes(typesJson?.data ?? []);
        setInventoryCategories(categoriesJson?.data ?? []);
        setInventorySubcategories(subcategoriesJson?.data ?? []);
      } catch {
        if (!active) return;
        setInventoryTypes([]);
        setInventoryCategories([]);
        setInventorySubcategories([]);
      }
    }
    loadTaxonomy();
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
    if (productOpenIndex === null) {
      setProductResults([]);
      return;
    }
    const query = items[productOpenIndex]?.partName?.trim() ?? "";
    let active = true;
    const timer = setTimeout(() => {
      const url = query ? `/api/products?search=${encodeURIComponent(query)}` : "/api/products";
      fetch(url)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setProductResults(Array.isArray(data?.data) ? data.data : []);
        })
        .catch(() => {
          if (!active) return;
          setProductResults([]);
        });
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [productOpenIndex, items]);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return next;
    });
  };

  const canSubmit =
    items.some((i) => i.partName.trim()) &&
    (requestType !== "job" || !!estimateId.trim()) &&
    !saving;

  const getCategoryOptions = (item: ItemDraft) =>
    item.inventoryTypeId
      ? inventoryCategories.filter((cat) => cat.inventoryTypeId === item.inventoryTypeId)
      : inventoryCategories;

  const getSubcategoryOptions = (item: ItemDraft) =>
    item.categoryId
      ? inventorySubcategories.filter((sub) => sub.categoryId === item.categoryId)
      : inventorySubcategories;
  const getMakeOptions = (item: ItemDraft) =>
    item.subcategoryId
      ? inventoryMakes.filter((make) => !make.subcategoryId || make.subcategoryId === item.subcategoryId)
      : inventoryMakes;

  const ensureModels = useCallback(async (makeId: string) => {
    if (!makeId || modelsByMake[makeId]) return;
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inventory/models?makeId=${encodeURIComponent(
          makeId
        )}&includeInactive=false`
      );
      if (!res.ok) throw new Error("Failed to load models");
      const json = await res.json();
      setModelsByMake((prev) => ({ ...prev, [makeId]: json.data ?? [] }));
    } catch {
      setModelsByMake((prev) => ({ ...prev, [makeId]: [] }));
    }
  }, [companyId, modelsByMake]);

  const ensureYears = useCallback(async (modelId: string) => {
    if (!modelId || yearsByModel[modelId]) return;
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inventory/years?modelId=${encodeURIComponent(
          modelId
        )}&includeInactive=false`
      );
      if (!res.ok) throw new Error("Failed to load years");
      const json = await res.json();
      setYearsByModel((prev) => ({ ...prev, [modelId]: json.data ?? [] }));
    } catch {
      setYearsByModel((prev) => ({ ...prev, [modelId]: [] }));
    }
  }, [companyId, yearsByModel]);

  useEffect(() => {
    if (!createOpen) return;
    items.forEach((item) => {
      if (item.makeId) void ensureModels(item.makeId);
      if (item.modelId) void ensureYears(item.modelId);
    });
  }, [createOpen, items, ensureModels, ensureYears]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setStatus("Add at least one part.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const payloadItems = items
        .filter((i) => i.partName.trim())
        .map((item) => {
          const category = inventoryCategories.find((cat) => cat.id === item.categoryId);
          const subcategory = inventorySubcategories.find((sub) => sub.id === item.subcategoryId);
          return {
            partName: item.partName.trim(),
            partNumber: item.partNumber.trim() || null,
            partBrand: item.partBrand.trim() || null,
            partType: item.partType || null,
            quantity: Number(item.quantity) || 0,
            unit: item.unit.trim() || null,
            category: (category?.code || category?.name || item.category || "").trim() || null,
            subcategory: (subcategory?.code || subcategory?.name || item.subcategory || "").trim() || null,
            description: item.description.trim() || null,
            inventoryTypeId: item.inventoryTypeId || null,
            categoryId: item.categoryId || null,
            subcategoryId: item.subcategoryId || null,
            makeId: item.makeId || null,
            modelId: item.modelId || null,
            yearId: item.yearId || null,
          };
        });
      const isEditing = Boolean(editingRequestId);
      const res = await fetch(
        isEditing
          ? `/api/company/${companyId}/workshop/inventory/order-requests/${editingRequestId}`
          : `/api/company/${companyId}/workshop/inventory/order-requests`,
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType,
            estimateId: requestType === "job" ? estimateId.trim() || null : null,
            notes: notes.trim() || null,
            items: payloadItems,
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create request");
      }
      setStatus(isEditing ? "Request updated." : "Request submitted.");
      setItems([createEmptyItem()]);
      setNotes("");
      setEstimateId("");
      setEditingRequestId(null);
      setCreateOpen(false);
      await loadRequests();
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to submit request.");
    } finally {
      setSaving(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    setStatus(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inventory/order-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadRequests();
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to approve request.");
    }
  };

  const editRequest = (req: RequestWithItems) => {
    if (req.status !== "pending") {
      setStatus("Only pending requests can be edited.");
      return;
    }
    setEditingRequestId(req.id);
    setRequestType(req.requestType);
    setEstimateId(req.estimateId ?? "");
    setNotes(req.notes ?? "");
    setItems(
      req.items.map((item) => ({
        id: randomId(),
        partName: item.partName ?? "",
        partNumber: item.partNumber ?? "",
        partBrand: item.partBrand ?? "",
        partType: item.partType ?? "",
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "EA",
        category: item.category ?? "",
        subcategory: item.subcategory ?? "",
        inventoryTypeId: item.inventoryTypeId ?? "",
        categoryId: item.categoryId ?? "",
        subcategoryId: item.subcategoryId ?? "",
        makeId: item.makeId ?? "",
        modelId: item.modelId ?? "",
        yearId: item.yearId ?? "",
        description: item.description ?? "",
      }))
    );
    setCreateOpen(true);
  };

  const cancelEdit = () => {
    setEditingRequestId(null);
    setRequestType("inventory");
    setEstimateId("");
    setNotes("");
    setItems([createEmptyItem()]);
    setCreateOpen(false);
  };

  const deleteRequest = async (requestId: string) => {
    if (!confirm("Delete this request?")) return;
    setStatus(null);
    try {
      const res = await fetch(
        `/api/company/${companyId}/workshop/inventory/order-requests/${requestId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (editingRequestId === requestId) cancelEdit();
      await loadRequests();
    } catch (err: any) {
      setStatus(err?.message ?? "Failed to delete request.");
    }
  };

  const quoteStatusPriority = (value?: string | null) => {
    const v = (value ?? "").toLowerCase();
    if (v.includes("received")) return 4;
    if (v.includes("ordered")) return 3;
    if (v.includes("approved")) return 2;
    if (v.includes("pending") || v.includes("inquiry") || v.includes("quoted")) return 1;
    return 0;
  };

  const requestQuoteStatus = (req: RequestWithItems) => {
    let best: string | null = null;
    let bestScore = 0;
    req.items.forEach((item) => {
      const status = quoteStatusByItem[item.id];
      const score = quoteStatusPriority(status);
      if (score > bestScore) {
        bestScore = score;
        best = status ?? null;
      }
    });
    return best ?? "Pending";
  };

  return (
    <MainPageShell
      title="Inventory Order Requests"
      subtitle="Create and approve inventory requests before vendor inquiries."
      scopeLabel={`Company ${companyId}`}
      contentClassName="space-y-6 rounded-2xl border-none bg-slate-950/70 p-0"
    >
      <div className="space-y-6">
        <section className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Requests</h2>
              <p className="text-xs text-muted-foreground">Approve inventory requests to push vendor inquiries.</p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
            >
              Create request
            </button>
          </div>
          {loading ? (
            <p className="mt-3 text-xs text-muted-foreground">Loading requests...</p>
          ) : error ? (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3 text-left">Request</th>
                    <th className="py-2 px-3 text-left">Type</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Estimate</th>
                    <th className="py-2 px-3 text-left">Items</th>
                    <th className="py-2 px-3 text-left">Qty</th>
                    <th className="py-2 px-3 text-left">Quote Status</th>
                    <th className="py-2 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} className="border-t border-white/5">
                      <td className="py-2 px-3 font-semibold">{req.requestNumber}</td>
                      <td className="py-2 px-3 capitalize">{req.requestType}</td>
                      <td className="py-2 px-3 capitalize">{req.status}</td>
                      <td className="py-2 px-3 text-[11px] text-muted-foreground">
                        {req.estimateId ? `${req.estimateId.slice(0, 8)}…` : "—"}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-muted-foreground">
                        {req.items.map((item) => item.partName).join(", ")}
                      </td>
                      <td className="py-2 px-3 text-[11px] text-muted-foreground">
                        {req.items.map((item) => item.quantity).join(", ")}
                      </td>
                      <td className="py-2 px-3 text-[11px] capitalize text-muted-foreground">
                        {requestQuoteStatus(req)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => approveRequest(req.id)}
                                className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => editRequest(req)}
                                className="rounded-md border border-white/10 px-2 py-1 text-xs text-white"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRequest(req.id)}
                                className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-300"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-6xl rounded-2xl bg-slate-950 p-6 text-slate-100 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.7)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{editingRequestId ? "Edit request" : "Create request"}</h2>
                <p className="text-xs text-muted-foreground">Submit parts for approval and vendor inquiry.</p>
              </div>
              <span className="rounded-full bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {pendingRequests.length} pending approval
              </span>
            </div>
            {status && <p className="mt-2 text-[11px] text-muted-foreground">{status}</p>}
            <form className="mt-4 space-y-4 text-sm" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Request type</span>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value as InventoryOrderRequestType)}
                  >
                    <option value="inventory">Inventory</option>
                    <option value="job">Job</option>
                  </select>
                </label>
                {requestType === "job" && (
                  <label className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">Estimate ID</span>
                    <input
                      className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white"
                      value={estimateId}
                      onChange={(e) => setEstimateId(e.target.value)}
                      placeholder="Estimate UUID"
                    />
                  </label>
                )}
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[11px] text-muted-foreground">Notes</span>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </label>
              </div>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                    <div className="grid gap-3 md:grid-cols-12">
                      <label className="md:col-span-4 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Part</span>
                        <div className="relative z-20">
                          <input
                            className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                            value={item.partName}
                            onChange={(e) => updateItem(index, { partName: e.target.value })}
                            placeholder="Search products"
                            onFocus={() => setProductOpenIndex(index)}
                            onBlur={() => {
                              setTimeout(
                                () => setProductOpenIndex((current) => (current === index ? null : current)),
                                150
                              );
                            }}
                          />
                          {productOpenIndex === index && (
                            <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-white/10 bg-slate-950 text-xs shadow-lg">
                              {(productResults.length ? productResults : products).map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updateItem(index, {
                                      partName: product.name,
                                      description: product.type ?? item.description,
                                    });
                                    setProductOpenIndex(null);
                                  }}
                                >
                                  <span className="font-semibold">{product.name}</span>
                                  {product.type ? (
                                    <span className="text-[10px] text-white/50">{product.type}</span>
                                  ) : null}
                                </button>
                              ))}
                              {productResults.length === 0 && products.length === 0 && (
                                <div className="px-3 py-2 text-white/50">No products found.</div>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Part #</span>
                        <input
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.partNumber}
                          onChange={(e) => updateItem(index, { partNumber: e.target.value })}
                          placeholder="Part #"
                        />
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Brand</span>
                        <input
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.partBrand}
                          onChange={(e) => updateItem(index, { partBrand: e.target.value })}
                          placeholder="Brand"
                        />
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Part type</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.partType}
                          onChange={(e) => updateItem(index, { partType: e.target.value })}
                        >
                          <option value="">Select</option>
                          <option value="OE">OE</option>
                          <option value="OEM">OEM</option>
                          <option value="After Market">After Market</option>
                          <option value="Used">Used</option>
                        </select>
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Qty</span>
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                        />
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Unit</span>
                        <input
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.unit}
                          onChange={(e) => updateItem(index, { unit: e.target.value })}
                        />
                      </label>
                      <label className="md:col-span-3 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Type</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.inventoryTypeId}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateItem(index, {
                              inventoryTypeId: next,
                              categoryId: "",
                              subcategoryId: "",
                              makeId: "",
                              modelId: "",
                              yearId: "",
                            });
                          }}
                        >
                          <option value="">Select</option>
                          {inventoryTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.code} - {type.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-3 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Category</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.categoryId}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateItem(index, {
                              categoryId: next,
                              subcategoryId: "",
                              makeId: "",
                              modelId: "",
                              yearId: "",
                            });
                          }}
                        >
                          <option value="">Select</option>
                          {getCategoryOptions(item).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.code} - {cat.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-3 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Subcategory</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.subcategoryId}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateItem(index, {
                              subcategoryId: next,
                              makeId: "",
                              modelId: "",
                              yearId: "",
                            });
                          }}
                        >
                          <option value="">Select</option>
                          {getSubcategoryOptions(item).map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.code} - {sub.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-3 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Make</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.makeId}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateItem(index, { makeId: next, modelId: "", yearId: "" });
                            if (next) void ensureModels(next);
                          }}
                        >
                          <option value="">Select</option>
                          {getMakeOptions(item).map((make) => (
                            <option key={make.id} value={make.id}>
                              {make.code} - {make.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-3 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Model</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.modelId}
                          onChange={(e) => {
                            const next = e.target.value;
                            updateItem(index, { modelId: next, yearId: "" });
                            if (next) void ensureYears(next);
                          }}
                          disabled={!item.makeId}
                        >
                          <option value="">Select</option>
                          {(modelsByMake[item.makeId] ?? []).map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.code} - {model.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-2 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Year</span>
                        <select
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.yearId}
                          onChange={(e) => updateItem(index, { yearId: e.target.value })}
                          disabled={!item.modelId}
                        >
                          <option value="">Select</option>
                          {(yearsByModel[item.modelId] ?? []).map((year) => (
                            <option key={year.id} value={year.id}>
                              {year.year}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="md:col-span-4 space-y-1">
                        <span className="text-[11px] text-muted-foreground">Notes</span>
                        <input
                          className="w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white"
                          value={item.description}
                          onChange={(e) => updateItem(index, { description: e.target.value })}
                          placeholder="Notes"
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== index))}
                        className="text-[11px] text-rose-300 hover:underline"
                      >
                        Remove line
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, createEmptyItem()])}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                >
                  Add line
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (editingRequestId ? cancelEdit() : setCreateOpen(false))}
                    className="rounded-md border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editingRequestId ? "Update request" : "Submit request"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
