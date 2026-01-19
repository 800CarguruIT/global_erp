"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
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
  updatedAt?: string | null;
};

export default function PartsQuotesPage() {
  const params = useParams();
  const companyId = typeof params?.companyId === "string" ? params.companyId : params?.companyId?.[0] ?? "";
  const [activeTab, setActiveTab] = useState<TabId>("quoted");
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!res.ok) {
          throw new Error(`Failed to load parts quotes (${res.status})`);
        }
        const data = await res.json();
        setRows(Array.isArray(data?.data) ? data.data : []);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError(err?.message ?? "Failed to load parts quotes");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [companyId, activeTab]);

  const body = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            Loading parts quotes...
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
    if (!rows.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={11}>
            No parts quotes found.
          </td>
        </tr>
      );
    }
    const pickQuote = (row: QuoteRow) => {
      if (row.oem != null) return { type: "OEM", amount: row.oem, qty: row.oemQty, etd: row.oemEtd };
      if (row.oe != null) return { type: "OE", amount: row.oe, qty: row.oeQty, etd: row.oeEtd };
      if (row.aftm != null) return { type: "AFTM", amount: row.aftm, qty: row.aftmQty, etd: row.aftmEtd };
      if (row.used != null) return { type: "USED", amount: row.used, qty: row.usedQty, etd: row.usedEtd };
      return { type: "—", amount: null, qty: null, etd: null };
    };
    return rows.map((row, index) => {
      const quote = pickQuote(row);
      return (
        <tr key={row.id} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3">{row.vendorName ?? "—"}</td>
          <td className="px-3 py-3">
            <div className="text-sm font-semibold text-slate-100">{row.partName}</div>
            <div className="text-[11px] text-slate-400">{row.remarks ?? ""}</div>
          </td>
          <td className="px-3 py-3">
            {row.carMake ?? "—"} {row.carModel ?? ""}
          </td>
          <td className="px-3 py-3">{row.carPlate ?? "—"}</td>
          <td className="px-3 py-3">{row.carVin ?? "—"}</td>
          <td className="px-3 py-3">{quote.type}</td>
          <td className="px-3 py-3">{quote.qty ?? "—"}</td>
          <td className="px-3 py-3">{quote.etd ?? "—"}</td>
          <td className="px-3 py-3">{quote.amount != null ? `${quote.amount} AED` : "—"}</td>
          <td className="px-3 py-3 text-xs text-slate-300/80">
            {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
          </td>
        </tr>
      );
    });
  }, [rows, loading, error]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Parts Quotes</h1>
          <p className="text-sm text-muted-foreground">Company-wide vendor parts quotations.</p>
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
                    isActive ? "bg-emerald-500 text-white" : "bg-slate-900/60 text-slate-200 hover:bg-slate-900/80"
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
            <div className="text-sm font-semibold text-slate-100">{TABS.find((t) => t.id === activeTab)?.label}</div>
            <span className="text-xs text-slate-400">Updated just now</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] text-sm text-slate-100">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Part</th>
                  <th className="px-3 py-2 text-left">Car</th>
                  <th className="px-3 py-2 text-left">Plate</th>
                  <th className="px-3 py-2 text-left">Vin</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Estimated Time</th>
                  <th className="px-3 py-2 text-left">Unit Price</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>{body}</tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
