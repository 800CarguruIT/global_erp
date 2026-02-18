"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { toast } from "sonner";
import { useParams } from "next/navigation";

type TabId = "quoted" | "ordered" | "rejected" | "received" | "returns";

const TABS: Array<{ id: TabId; label: string; status: string }> = [
  { id: "quoted", label: "Quoted Parts", status: "quoted" },
  { id: "ordered", label: "Ordered Parts", status: "Ordered" },
  { id: "rejected", label: "Rejected Parts", status: "Rejected" },
  { id: "received", label: "Received Parts", status: "Received" },
  { id: "returns", label: "Return Parts", status: "returns" },
];

type QuoteRow = {
  id: string;
  status?: string | null;
  vendorName?: string | null;
  partName: string;
  carMake?: string | null;
  carModel?: string | null;
  carPlate?: string | null;
  carVin?: string | null;
  requestNumber?: string | null;
  sourceType?: "inventory" | "line_item";
  lineItemId?: string | null;
  inventoryRequestItemId?: string | null;
  oem?: number | null;
  oe?: number | null;
  aftm?: number | null;
  used?: number | null;
  oemQty?: number | null;
  oeQty?: number | null;
  aftmQty?: number | null;
  usedQty?: number | null;
  oemEtd?: string | null;
  oeEtd?: string | null;
  aftmEtd?: string | null;
  usedEtd?: string | null;
  remarks?: string | null;
  estimateItemStatus?: string | null;
  approvedType?: string | null;
  updatedAt?: string | null;
  vendorId?: string | null;
  estimateItemId?: string | null;
  grnNumber?: string | null;
};

const pickQuote = (row: QuoteRow) => {
  if (row.oem != null) return { type: "OEM", amount: row.oem, qty: row.oemQty, etd: row.oemEtd };
  if (row.oe != null) return { type: "OE", amount: row.oe, qty: row.oeQty, etd: row.oeEtd };
  if (row.aftm != null)
    return { type: "AFTM", amount: row.aftm, qty: row.aftmQty, etd: row.aftmEtd };
  if (row.used != null) return { type: "USED", amount: row.used, qty: row.usedQty, etd: row.usedEtd };
  return { type: "-", amount: null, qty: null, etd: null };
};
const isApprovedType = (row: QuoteRow, type: "oem" | "oe" | "aftm" | "used") =>
  String(row.approvedType ?? "").trim().toLowerCase() === type;
const normalizeApprovedType = (value?: string | null): "oem" | "oe" | "aftm" | "used" | null => {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "oem" || v === "oe" || v === "aftm" || v === "used") return v;
  return null;
};

export default function PartsQuotesPage() {
  const params = useParams();
  const companyId =
    typeof params?.companyId === "string" ? params.companyId : params?.companyId?.[0] ?? "";
  const [activeTab, setActiveTab] = useState<TabId>("quoted");
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [orderingQuoteId, setOrderingQuoteId] = useState<string | null>(null);
  const [creatingPo, setCreatingPo] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderedIds, setSelectedOrderedIds] = useState<string[]>([]);
  const [quotesModalOpen, setQuotesModalOpen] = useState(false);
  const [quotesModalTitle, setQuotesModalTitle] = useState("");
  const [quotesModalRows, setQuotesModalRows] = useState<QuoteRow[]>([]);
  const [quotesModalApprovedType, setQuotesModalApprovedType] = useState<"oem" | "oe" | "aftm" | "used" | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<
    Record<string, { oemQty: string; oeQty: string; aftmQty: string; usedQty: string }>
  >({});

  const isOrderedTab = activeTab === "ordered";
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const normalized = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const plate = row.carPlate?.toLowerCase() ?? "";
      const part = row.partName?.toLowerCase() ?? "";
      return plate.includes(normalized) || part.includes(normalized);
    });
  }, [rows, searchTerm]);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/part-quotes?status=${tab.status}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to load parts quotes (${res.status})`);
        const json = await res.json();
        setRows(Array.isArray(json?.data) ? json.data : []);
      } catch (err: any) {
        if (err?.name !== "AbortError") setError(err?.message ?? "Failed to load parts quotes");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [companyId, activeTab, refreshKey]);

  useEffect(() => {
    if (!isOrderedTab && selectedOrderedIds.length) setSelectedOrderedIds([]);
  }, [isOrderedTab, selectedOrderedIds.length]);

  const toggleSelection = (id: string) => {
    setSelectedOrderedIds((prev) =>
      prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]
    );
  };

  const handleCreatePurchaseOrder = async () => {
    if (!selectedOrderedIds.length || !companyId || creatingPo) return;
    const rowsToSend = rows.filter((row) => selectedOrderedIds.includes(row.id));
    if (!rowsToSend.length) return;
    const firstRow = rowsToSend[0];
    const mixedVendors = rowsToSend.some((row) => (row.vendorId ?? "") !== (firstRow.vendorId ?? ""));
    if (mixedVendors) {
      toast.error("Please create purchase orders per vendor.");
      return;
    }
    setCreatingPo(true);
    try {
      const payloadItems = rowsToSend.map((row) => {
        const quoteInfo = pickQuote(row);
        return {
          quoteId: row.id,
          estimateItemId: row.estimateItemId ?? null,
          inventoryRequestItemId: row.inventoryRequestItemId ?? null,
          name: row.partName ?? "Part",
          description: row.remarks ?? null,
          quantity: Number(quoteInfo.qty ?? 1) || 1,
          unitCost: Number(quoteInfo.amount ?? 0) || 0,
          unit: quoteInfo.type ?? "EA",
        };
      });
      const res = await fetch(`/api/company/${companyId}/workshop/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poType: "po",
          vendorId: firstRow.vendorId ?? null,
          vendorName: firstRow.vendorName ?? null,
          items: payloadItems,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to create PO (${res.status})`);
      }
      const json = await res.json();
      const poId = json?.data?.po?.id ?? json?.data?.id;
      if (!poId) throw new Error("PO created but id is missing");
      toast.success("Purchase order created");
      window.location.href = `/company/${companyId}/workshop/procurement/${poId}`;
    } catch (err: any) {
      toast.error(err?.message ?? "Unable to create purchase order");
    } finally {
      setCreatingPo(false);
    }
  };

  const openQuotesModal = (row: QuoteRow) => {
    const key = row.sourceType === "inventory" ? row.inventoryRequestItemId : row.lineItemId;
    const related = key
      ? rows.filter((r) =>
          (row.sourceType === "inventory"
            ? r.inventoryRequestItemId === key
            : r.lineItemId === key)
        )
      : [row];
    setQuotesModalTitle(row.partName ?? "Quotes");
    setQuotesModalRows(related);
    const resolvedApprovedType =
      related
        .map((r) => normalizeApprovedType(r.approvedType))
        .find((v): v is "oem" | "oe" | "aftm" | "used" => Boolean(v)) ??
      normalizeApprovedType(row.approvedType);
    setQuotesModalApprovedType(resolvedApprovedType);
    setQuotesModalOpen(true);
    setOrderDrafts((prev) => {
      const next = { ...prev };
      related.forEach((r) => {
        if (!next[r.id]) {
          next[r.id] = { oemQty: "", oeQty: "", aftmQty: "", usedQty: "" };
        }
      });
      return next;
    });
  };

  const orderQuote = async (row: QuoteRow) => {
    if (!companyId) return;
    const draft = orderDrafts[row.id] ?? { oemQty: "", oeQty: "", aftmQty: "", usedQty: "" };
    const toNum = (val: string) => {
      if (!val) return 0;
      const num = Number(val);
      return Number.isNaN(num) ? 0 : num;
    };
    const oemQty = toNum(draft.oemQty) || Number(row.oemQty ?? 0);
    const oeQty = toNum(draft.oeQty) || Number(row.oeQty ?? 0);
    const aftmQty = toNum(draft.aftmQty) || Number(row.aftmQty ?? 0);
    const usedQty = toNum(draft.usedQty) || Number(row.usedQty ?? 0);
    if (oemQty + oeQty + aftmQty + usedQty <= 0) {
      toast.error("No quoted quantity available to order.");
      return;
    }
    setOrderingQuoteId(row.id);
    try {
      const res = await fetch(`/api/company/${companyId}/part-quotes/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: row.id,
          ordered: { oemQty, oeQty, aftmQty, usedQty },
        }),
      });
      if (!res.ok) throw new Error(`Failed to order quote (${res.status})`);
      toast.success("Quote marked as ordered");
      setRefreshKey((prev) => prev + 1);
      setQuotesModalRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: "Ordered" } : r))
      );
    } catch (err) {
      console.error(err);
      toast.error("Unable to order this quote");
    } finally {
      setOrderingQuoteId(null);
    }
  };

  const renderTableBody = () => {
    if (loading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            Loading part quotes...
          </td>
        </tr>
      );
    }
    if (error) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={11}>
            {error}
          </td>
        </tr>
      );
    }
    if (!filteredRows.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            No parts found for this tab.
          </td>
        </tr>
      );
    }
    return filteredRows.map((row, index) => {
      const statusLabel = row.estimateItemStatus ?? row.status ?? "pending";
      const carLabel =
        row.sourceType === "inventory"
          ? row.requestNumber
            ? `Inventory ${row.requestNumber}`
            : "Inventory request"
          : [row.carMake, row.carModel].filter(Boolean).join(" ") || "Unknown car";
      const partName = row.partName || "Unnamed part";
      const quoteInfo = pickQuote(row);
      const quoteAmount = quoteInfo.amount != null ? `${quoteInfo.amount.toFixed(2)} AED` : "-";
      const qtySummary = [
        row.oemQty != null ? `OEM: ${row.oemQty}` : null,
        row.oeQty != null ? `OE: ${row.oeQty}` : null,
        row.aftmQty != null ? `AFTM: ${row.aftmQty}` : null,
        row.usedQty != null ? `USED: ${row.usedQty}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const orderedOn = row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-";
      const showGrn = activeTab === "received" && row.grnNumber;
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3 text-xs text-slate-200">{row.vendorName ?? "Unknown vendor"}</td>
          <td className="px-3 py-3 text-xs">{carLabel}</td>
          <td className="px-3 py-3 text-xs">{row.carPlate ?? "-"}</td>
          <td className="px-3 py-3 text-xs">{row.carVin ?? "-"}</td>
          <td className="px-3 py-3 text-sm font-semibold">
            <div>{partName}</div>
            <div className="text-[11px] text-slate-400">{row.remarks ?? ""}</div>
          </td>
          <td className="px-3 py-3 text-xs">
            <div className="font-semibold">{quoteInfo.type}</div>
            <div>{quoteAmount}</div>
            <div className="text-[10px] uppercase text-slate-400">{quoteInfo.etd ?? ""}</div>
            {qtySummary && <div className="text-[10px] text-slate-500">{qtySummary}</div>}
          </td>
          <td className="px-3 py-3 text-xs uppercase">{statusLabel}</td>
          <td className="px-3 py-3 text-xs uppercase">{row.status ?? "Requested"}</td>
          <td className="px-3 py-3 text-xs">
            <div>{orderedOn}</div>
            {showGrn ? <div className="text-[10px] font-semibold text-emerald-300">{row.grnNumber}</div> : null}
          </td>
          {isOrderedTab ? (
            <td className="px-3 py-3 text-center">
              <input
                type="checkbox"
                checked={selectedOrderedIds.includes(row.id)}
                onChange={() => toggleSelection(row.id)}
                className="h-4 w-4 rounded border border-slate-600 bg-slate-900/70 text-emerald-500"
                aria-label="Select ordered part"
              />
            </td>
          ) : (
            <td className="px-3 py-3 text-right">
              <button
                type="button"
                onClick={() => openQuotesModal(row)}
                className="rounded-md border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-70"
              >
                View Quotes
              </button>
            </td>
          )}
        </tr>
      );
    });
  };

  return (
    <AppLayout>
      {quotesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/98 via-slate-950/95 to-slate-900/95 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/50">Quotes</div>
                <div className="text-base font-semibold text-slate-100">{quotesModalTitle}</div>
                <div className="text-[11px] text-slate-400">
                  Compare vendor pricing and submit the exact quantities to order.
                </div>
                {quotesModalApprovedType ? (
                  <div className="mt-2 inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                    Approved Type: {quotesModalApprovedType.toUpperCase()}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setQuotesModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-4">
              <table className="min-w-full text-xs text-slate-100">
                <thead className="sticky top-0 z-10 bg-slate-900/90 text-[11px] uppercase tracking-wide text-slate-300 backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 text-left">Vendor</th>
                    <th className="px-3 py-2 text-left">OEM</th>
                    <th className="px-3 py-2 text-left">OE</th>
                    <th className="px-3 py-2 text-left">AFTM</th>
                    <th className="px-3 py-2 text-left">Used</th>
                    <th className="px-3 py-2 text-left">Remarks</th>
                    <th className="px-3 py-2 text-left">Quoted Qty</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotesModalRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-xs text-slate-400" colSpan={8}>
                        No quotes available.
                      </td>
                    </tr>
                  ) : (
                    quotesModalRows.map((r) => (
                      <tr key={r.id} className="border-t border-white/5">
                        <td className="px-3 py-3">
                          <div className="text-sm font-semibold text-slate-100">{r.vendorName ?? "—"}</div>
                          <div className="text-[10px] text-slate-500">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}</div>
                        </td>
                        <td className="px-3 py-2">
                          {r.oem != null ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">{r.oem} AED</div>
                                {(isApprovedType(r, "oem") || quotesModalApprovedType === "oem") && (
                                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                    Approved
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">QTY: {r.oemQty ?? "—"}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.oe != null ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">{r.oe} AED</div>
                                {(isApprovedType(r, "oe") || quotesModalApprovedType === "oe") && (
                                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                    Approved
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">QTY: {r.oeQty ?? "—"}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.aftm != null ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">{r.aftm} AED</div>
                                {(isApprovedType(r, "aftm") || quotesModalApprovedType === "aftm") && (
                                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                    Approved
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">QTY: {r.aftmQty ?? "—"}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.used != null ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold">{r.used} AED</div>
                                {(isApprovedType(r, "used") || quotesModalApprovedType === "used") && (
                                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                    Approved
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">QTY: {r.usedQty ?? "—"}</div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">{r.remarks ?? "—"}</td>
                        <td className="px-3 py-2 text-[11px] text-slate-300/80">
                          {[
                            r.oemQty != null ? `OEM: ${r.oemQty}` : null,
                            r.oeQty != null ? `OE: ${r.oeQty}` : null,
                            r.aftmQty != null ? `AFTM: ${r.aftmQty}` : null,
                            r.usedQty != null ? `USED: ${r.usedQty}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => orderQuote(r)}
                            disabled={orderingQuoteId === r.id}
                            className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-70"
                          >
                            {orderingQuoteId === r.id ? "Ordering..." : "Order"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Part Quotes</h1>
          <p className="text-sm text-muted-foreground">List of vendor quotes across cars and statuses.</p>
        </div>

        <div className="rounded-2xl bg-slate-950/80 p-2">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-900/60 text-slate-200 hover:bg-slate-900/80"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950/80 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.9)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-semibold text-slate-100">
              {TABS.find((t) => t.id === activeTab)?.label}
            </div>
            <span className="text-xs text-slate-400">Updated just now</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by plate or part"
              className="flex-1 min-w-[220px] rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/70"
            />
            {isOrderedTab && selectedOrderedIds.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleCreatePurchaseOrder()}
                  disabled={creatingPo}
                  className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
                >
                  {creatingPo ? "Creating..." : "Create Purchase Order"}
                </button>
                <div className="text-[11px] font-semibold uppercase text-slate-300">Selected parts</div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-200">
                  {rows
                    .filter((row) => selectedOrderedIds.includes(row.id))
                    .map((row) => (
                      <span
                        key={`chip-${row.id}`}
                        className="rounded-full border border-emerald-500/40 bg-emerald-500/5 px-2 py-1"
                      >
                        {row.partName ?? "Part"}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm text-slate-100">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Car</th>
                  <th className="px-3 py-2 text-left">Plate</th>
                  <th className="px-3 py-2 text-left">VIN</th>
                  <th className="px-3 py-2 text-left">Part</th>
                  <th className="px-3 py-2 text-left">Quote</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Quote status</th>
                  <th className="px-3 py-2 text-left">Date / GRN</th>
                  {isOrderedTab ? (
                    <th className="px-3 py-2 text-center">Select</th>
                  ) : (
                    <th className="px-3 py-2 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
