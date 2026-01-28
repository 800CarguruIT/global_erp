"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";

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
};

const pickQuote = (row: QuoteRow) => {
  if (row.oem != null) return { type: "OEM", amount: row.oem, qty: row.oemQty, etd: row.oemEtd };
  if (row.oe != null) return { type: "OE", amount: row.oe, qty: row.oeQty, etd: row.oeEtd };
  if (row.aftm != null)
    return { type: "AFTM", amount: row.aftm, qty: row.aftmQty, etd: row.aftmEtd };
  if (row.used != null) return { type: "USED", amount: row.used, qty: row.usedQty, etd: row.usedEtd };
  return { type: "-", amount: null, qty: null, etd: null };
};

const ORDERED_QUOTE_PO_KEY = "orderedQuotesPoDraft";

export default function PartsQuotesPage() {
  const params = useParams();
  const router = useRouter();
  const companyId =
    typeof params?.companyId === "string" ? params.companyId : params?.companyId?.[0] ?? "";
  const [activeTab, setActiveTab] = useState<TabId>("quoted");
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [orderingQuoteId, setOrderingQuoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrderedIds, setSelectedOrderedIds] = useState<string[]>([]);

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

  const handleCreatePurchaseOrder = () => {
    if (!selectedOrderedIds.length) return;
    const rowsToSend = rows.filter((row) => selectedOrderedIds.includes(row.id));
    if (!rowsToSend.length) return;
    const firstRow = rowsToSend[0];
    const payload = {
      vendorId: firstRow.vendorId ?? null,
      vendorName: firstRow.vendorName ?? null,
      lines: rowsToSend.map((row) => {
        const quoteInfo = pickQuote(row);
        return {
          quoteId: row.id,
          partLabel: row.partName ?? "Part",
          quantity: quoteInfo.qty ?? 1,
          unitPrice: quoteInfo.amount ?? 0,
          unit: quoteInfo.type ?? "EA",
          partsCatalogId: (row as any).partsCatalogId ?? null,
          approvedType: row.approvedType ?? null,
        };
      }),
    };
    try {
      sessionStorage.setItem(ORDERED_QUOTE_PO_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
    router.push(`/company/${companyId}/procurement/new`);
  };

  const orderQuote = async (row: QuoteRow) => {
    if (!companyId) return;
    setOrderingQuoteId(row.id);
    try {
      const res = await fetch(`/api/company/${companyId}/part-quotes/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: row.id }),
      });
      if (!res.ok) throw new Error(`Failed to order quote (${res.status})`);
      toast.success("Quote marked as ordered");
      setRefreshKey((prev) => prev + 1);
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
      const derivedStatus = statusLabel.toLowerCase();
      const isApproved = derivedStatus === "approved";
      const types = [
        { name: "OEM", value: row.oem, etd: row.oemEtd },
        { name: "OE", value: row.oe, etd: row.oeEtd },
        { name: "AFTM", value: row.aftm, etd: row.aftmEtd },
        { name: "Used", value: row.used, etd: row.usedEtd },
      ];
      const approvedTypeKey = row.approvedType?.toLowerCase() ?? "";
      const approvedTypeEntry = types.find((type) => type.name.toLowerCase() === approvedTypeKey);
      const canOrder = Boolean(isApproved && approvedTypeEntry && approvedTypeEntry.value != null);
      const isOrderingThis = orderingQuoteId === row.id;
      const carLabel = [row.carMake, row.carModel].filter(Boolean).join(" ") || "Unknown car";
      const partName = row.partName || "Unnamed part";
      const quoteInfo = pickQuote(row);
      const quoteAmount = quoteInfo.amount != null ? `${quoteInfo.amount.toFixed(2)} AED` : "-";
      const orderedOn = row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-";
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
          </td>
          <td className="px-3 py-3 text-xs uppercase">{statusLabel}</td>
          <td className="px-3 py-3 text-xs uppercase">{row.status ?? "Requested"}</td>
          <td className="px-3 py-3 text-xs">{orderedOn}</td>
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
              {canOrder ? (
                <button
                  type="button"
                  onClick={() => orderQuote(row)}
                  disabled={isOrderingThis}
                  className="rounded-md border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10 disabled:opacity-70"
                >
                  {isOrderingThis ? "Ordering..." : "Order part"}
                </button>
              ) : (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-300">
                  Approval pending
                </span>
              )}
            </td>
          )}
        </tr>
      );
    });
  };

  return (
    <AppLayout>
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
                  className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
                >
                  Create Purchase Order
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
                  <th className="px-3 py-2 text-left">Ordered On</th>
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
