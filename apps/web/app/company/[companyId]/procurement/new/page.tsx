"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@repo/ui";
import { useParams, useRouter } from "next/navigation";

type VendorOption = { id: string; name: string };
type JobCardOption = { id: string; label: string };
type LocationOption = { id: string; code: string; name: string };
type StockPart = { partsCatalogId: string; partName: string; partCode: string };

type LineItemDraft = {
  id: string;
  quoteId?: string | null;
  partId?: string;
  partLabel: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  approvedType?: string | null;
  inventoryRequestItemId?: string | null;
  lineStatus?: "Received" | "Return" | null;
};

type PreselectedLine = {
  quoteId: string;
  partLabel: string;
  quantity?: number;
  unitPrice?: number;
  unit?: string;
  partsCatalogId?: string | null;
  approvedType?: string | null;
  inventoryRequestItemId?: string | null;
  lineStatus?: "Received" | "Return" | null;
};

type PreselectedDraft = {
  vendorId?: string | null;
  vendorName?: string | null;
  lines: PreselectedLine[];
};

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createEmptyItem = (): LineItemDraft => ({
  id: randomId(),
  partLabel: "",
  unit: "EA",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  tax: 5,
});

const formatDate = (value: Date) => value.toISOString().slice(0, 10);
const ORDERED_QUOTE_PO_KEY = "orderedQuotesPoDraft";

export default function CreatePurchaseOrderPage() {
  const params = useParams();
  const companyId =
    typeof params?.companyId === "string" ? params.companyId : params?.companyId?.[0] ?? "";
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [jobCards, setJobCards] = useState<JobCardOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [parts, setParts] = useState<StockPart[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [shipToLocationId, setShipToLocationId] = useState("");
  const [purchasedFor, setPurchasedFor] = useState<"inventory" | "job">("inventory");
  const [jobCode, setJobCode] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>(() => [createEmptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftFromQuotes, setDraftFromQuotes] = useState<PreselectedDraft | null>(null);
  const poDate = useMemo(() => formatDate(new Date()), []);
  const [poNumberPreview, setPoNumberPreview] = useState("Loading...");
  const status = "Draft";

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/vendors?includeInactive=true`)
      .then((res) => res.json())
      .then((json) => {
        const payload = json?.vendors ?? json?.data ?? json;
        const list = Array.isArray(payload) ? payload : [];
        setVendors(
          list
            .map((vendor: any) => ({
              id: vendor.id,
              name:
                vendor.display_name ?? vendor.displayName ?? vendor.name ?? vendor.legal_name ?? vendor.code ?? "Vendor",
            }))
            .filter((vendor) => vendor.id && vendor.name)
        );
      })
      .catch(() => setVendors([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    fetch(`/api/company/${companyId}/workshop/procurement/next-po-number`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (!active) return;
        setPoNumberPreview(json?.data?.poNumber ?? "PO-YYMMDD-0000");
      })
      .catch(() => {
        if (!active) return;
        setPoNumberPreview("PO-YYMMDD-0000");
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/workshop/job-cards`)
      .then((res) => res.json())
      .then((json) => {
        const rows = Array.isArray(json?.data) ? json.data : json;
        setJobCards(
          (rows ?? []).map((row: any) => ({
            id: row.id,
            label: `JC-${String(row.id).slice(0, 8).toUpperCase()}${row.plate_number ? ` • ${row.plate_number}` : ""}`,
          }))
        );
      })
      .catch(() => setJobCards([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/workshop/inventory/locations`)
      .then((res) => res.json())
      .then((json) => {
        const rows = Array.isArray(json?.data) ? json.data : json;
        setLocations(
          (rows ?? []).map((loc: any) => ({
            id: loc.id,
            code: loc.code ?? "?",
            name: loc.name ?? loc.code ?? "Location",
          }))
        );
      })
      .catch(() => setLocations([]));
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/workshop/inventory/stock`)
      .then((res) => res.json())
      .then((json) => {
        const rows = Array.isArray(json?.data) ? json.data : json;
        const map = new Map<string, StockPart>();
        (rows ?? []).forEach((row: any) => {
          if (!row?.partsCatalogId) return;
          if (!map.has(row.partsCatalogId)) {
            map.set(row.partsCatalogId, {
              partsCatalogId: row.partsCatalogId,
              partName: row.partName ?? row.part_code ?? row.partCode ?? "Part",
              partCode: row.partCode ?? row.part_code ?? row.partName ?? "EA",
            });
          }
        });
        setParts([...map.values()]);
      })
      .catch(() => setParts([]));
  }, [companyId]);

  useEffect(() => {
    if (!draftFromQuotes?.lines?.length) return;
    setItems(
      draftFromQuotes.lines.map((line) => ({
        id: randomId(),
        quoteId: line.quoteId ?? null,
        partId: line.partsCatalogId ?? undefined,
        partLabel: line.partLabel ?? "Part",
        unit: line.unit ?? "EA",
        quantity: line.quantity ?? 1,
        unitPrice: line.unitPrice ?? 0,
        discount: 0,
        tax: line.tax ?? 5,
        approvedType: line.approvedType ?? null,
        inventoryRequestItemId: line.inventoryRequestItemId ?? null,
        lineStatus: line.lineStatus ?? null,
      }))
    );
  }, [draftFromQuotes]);

  useEffect(() => {
    if (!draftFromQuotes) return;
    const match = vendors.find(
      (vendor) =>
        vendor.id === draftFromQuotes.vendorId ||
        vendor.name.toLowerCase() === (draftFromQuotes.vendorName ?? "").toLowerCase()
    );
    if (match) {
      setSupplierId(match.id);
    }
  }, [vendors, draftFromQuotes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem(ORDERED_QUOTE_PO_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setDraftFromQuotes(parsed);
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem(ORDERED_QUOTE_PO_KEY);
    }
  }, []);

  useEffect(() => {
    if (purchasedFor !== "job") setJobCode("");
  }, [purchasedFor]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let taxTotal = 0;
    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const line = qty * unitPrice;
      const lineDiscount = line * (Number(item.discount) || 0) * 0.01;
      const taxable = line - lineDiscount;
      const lineTax = taxable * (Number(item.tax) || 0) * 0.01;
      subtotal += line;
      discount += lineDiscount;
      taxTotal += lineTax;
    });
    return {
      subtotal,
      discount,
      taxTotal,
      total: subtotal - discount + taxTotal,
    };
  }, [items]);

  const hasValidItems = items.some(
    (item) =>
      (item.partId || item.inventoryRequestItemId || item.partLabel) &&
      (item.quantity > 0 || item.unitPrice > 0)
  );
  const canSubmit = !!companyId && !!supplierId && hasValidItems && !saving;

  const updateItem = (index: number, patch: Partial<LineItemDraft>) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      next[index] = { ...current, ...patch };
      return next;
    });
  };

  const handlePartChange = (index: number, partId: string) => {
    const selected = parts.find((part) => part.partsCatalogId === partId);
    updateItem(index, {
      partId,
      partLabel: selected ? `${selected.partName} (${selected.partCode})` : "",
      unit: selected ? "EA" : "EA",
    });
  };

  const handleSubmit = async () => {
    if (!companyId) return;
    if (!canSubmit) {
      setError("Please select supplier and add at least one item.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supplier = vendors.find((v) => v.id === supplierId);
      const payloadItems = items
        .filter(
          (item) =>
            (item.partId || item.inventoryRequestItemId || item.partLabel) &&
            (item.quantity > 0 || item.unitPrice > 0)
        )
        .map((item) => ({
          name: item.partLabel || "Part",
          description: [
            `Unit: ${item.unit}`,
            item.approvedType ? `Type: ${item.approvedType}` : null,
          ]
            .filter(Boolean)
            .join(" | "),
          quantity: Number(item.quantity) || 0,
          unitCost: Number(item.unitPrice) || 0,
          partsCatalogId: item.partId ?? null,
          inventoryRequestItemId: item.inventoryRequestItemId ?? null,
          quoteId: item.quoteId ?? null,
        }));
      const notesPieces = [
        notes.trim(),
        paymentTerms.trim() ? `Payment terms: ${paymentTerms.trim()}` : null,
        shipToLocationId
          ? `Ship to: ${
              locations.find((loc) => loc.id === shipToLocationId)?.name ?? shipToLocationId
            }`
          : null,
        purchasedFor === "job"
          ? jobCards.find((job) => job.id === jobCode)?.label ?? (jobCode ? `Job ${jobCode}` : null)
          : null,
      ]
        .filter(Boolean)
        .join(" · ");

      const res = await fetch(`/api/company/${companyId}/workshop/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poType: "po",
          vendorId: supplierId || null,
          vendorName: supplier?.name ?? null,
          vendorContact: null,
          currency: "AED",
          notes: notesPieces || null,
          items: payloadItems,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create PO");
      }
      const json = await res.json();
      const poId = json?.data?.po?.id ?? json?.data?.id ?? null;
      if (poId) {
        router.push(`/company/${companyId}/workshop/procurement/${poId}`);
      } else {
        router.push(`/company/${companyId}/procurement`);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to submit purchase order.");
    } finally {
      setSaving(false);
    }
  };

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Create Purchase Order</h1>
            <p className="text-sm text-muted-foreground">Capture PO details before submitting to suppliers.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              href={`/company/${companyId}/parts-quotes`}
              className="rounded-full border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-300"
            >
              Back to quotes
            </Link>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-slate-400">PO Number</label>
              <input
                className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                readOnly
                value={poNumberPreview}
              />
              <div className="text-[11px] text-slate-400">Auto-assigned on save.</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-slate-400">PO Date</label>
              <input
                className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                readOnly
                value={poDate}
                type="date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase text-slate-400">Status</label>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                {status}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="purchased-for" className="text-xs font-medium text-slate-300">
                Purchased for
              </label>
              <select
                id="purchased-for"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={purchasedFor}
                onChange={(event) => setPurchasedFor(event.target.value as "inventory" | "job")}
              >
                <option value="inventory">Inventory</option>
                <option value="job">Job</option>
              </select>
            </div>
            {purchasedFor === "job" && (
              <div className="space-y-1">
                <label htmlFor="job-code" className="text-xs font-medium text-slate-300">
                  Job code
                </label>
                <select
                  id="job-code"
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={jobCode}
                  onChange={(event) => setJobCode(event.target.value)}
                >
                  <option value="">Select job</option>
                  {jobCards.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="supplier" className="text-xs font-medium text-slate-300">
                Supplier
              </label>
              <select
                id="supplier"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
              >
                <option value="">Select supplier</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="payment-terms" className="text-xs font-medium text-slate-300">
                Payment terms
              </label>
              <input
                id="payment-terms"
                type="text"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                placeholder="e.g. NET 30"
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ship-to" className="text-xs font-medium text-slate-300">
                Ship-to location
              </label>
              <select
                id="ship-to"
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={shipToLocationId}
                onChange={(event) => setShipToLocationId(event.target.value)}
              >
                <option value="">Select location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} – {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="notes" className="text-xs font-medium text-slate-300">
                Notes
              </label>
              <textarea
                id="notes"
                rows={2}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional remarks for the supplier"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Parts</h2>
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, createEmptyItem()])}
              className="rounded-md border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 hover:border-slate-500"
            >
              Add line
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-100">
              <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="py-2 px-3 text-left">Part</th>
              <th className="py-2 px-3 text-left">Qty Ordered</th>
              <th className="py-2 px-3 text-left">Type</th>
              <th className="py-2 px-3 text-left">Unit price</th>
              <th className="py-2 px-3 text-left">Discount %</th>
              <th className="py-2 px-3 text-left">VAT (%)</th>
              <th className="py-2 px-3 text-right">Line total</th>
              <th className="py-2 px-3 text-left">Actions</th>
            </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-xs text-slate-500">
                      No line items yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const qty = Number(item.quantity) || 0;
                    const base = qty * (Number(item.unitPrice) || 0);
                    const discountAmount = base * ((Number(item.discount) || 0) / 100);
                    const taxable = base - discountAmount;
                    const taxAmount = taxable * ((Number(item.tax) || 0) / 100);
                    const lineTotal = taxable + taxAmount;
                    return (
                      <tr key={item.id} className="border-b border-slate-800 last:border-none">
                        <td className="py-2 px-3">
                          <div className="text-xs font-semibold text-slate-100">
                            {item.partLabel || "Part"}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.partLabel ? "" : "Part sourced from quote selection"}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            className="w-20 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs"
                            value={item.quantity}
                            readOnly
                          />
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <div className="text-xs font-semibold text-slate-100">{item.unit}</div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-24 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs"
                            value={item.unitPrice}
                            readOnly
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            className="w-20 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs"
                            value={item.discount}
                            onChange={(event) => updateItem(index, { discount: Number(event.target.value) })}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="w-20 rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs"
                            value={item.tax}
                            onChange={(event) => updateItem(index, { tax: Number(event.target.value) })}
                          >
                            {[0, 5].map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right text-xs">{lineTotal.toFixed(2)}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== index))}
                            className="text-[11px] text-rose-300 hover:underline"
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
          <div className="flex flex-col items-end gap-3 text-xs text-slate-300">
            <div className="grid w-full max-w-md gap-2 rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 sm:grid-cols-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Subtotal</div>
              <div className="text-right text-sm font-semibold text-slate-100">{totals.subtotal.toFixed(2)}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Discount</div>
              <div className="text-right text-sm font-semibold text-rose-200">-{totals.discount.toFixed(2)}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Tax</div>
              <div className="text-right text-sm font-semibold text-amber-200">+{totals.taxTotal.toFixed(2)}</div>
              <div className="col-span-2 mt-1 h-px bg-slate-800/70" />
              <div className="text-[11px] uppercase tracking-wide text-slate-300">Total</div>
              <div className="text-right text-lg font-semibold text-emerald-200">{totals.total.toFixed(2)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
          <div className="text-xs text-slate-400">All POs start as Draft until issued.</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/40 disabled:opacity-60"
            >
              {saving ? "Creating PO…" : "Create Purchase Order"}
            </button>
            <Link
              href={`/company/${companyId}/procurement`}
              className="rounded-md border border-slate-700 px-4 py-2 text-xs uppercase tracking-wide text-slate-200"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
