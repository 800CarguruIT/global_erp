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
  carId?: string | null;
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
};

type CarGroup = {
  key: string;
  carId?: string | null;
  carMake?: string | null;
  carModel?: string | null;
  carPlate?: string | null;
  carVin?: string | null;
  quotes: QuoteRow[];
  statusCounts: Record<string, number>;
};

const pickQuote = (row: QuoteRow) => {
  if (row.oem != null) return { type: "OEM", amount: row.oem, qty: row.oemQty, etd: row.oemEtd };
  if (row.oe != null) return { type: "OE", amount: row.oe, qty: row.oeQty, etd: row.oeEtd };
  if (row.aftm != null)
    return { type: "AFTM", amount: row.aftm, qty: row.aftmQty, etd: row.aftmEtd };
  if (row.used != null) return { type: "USED", amount: row.used, qty: row.usedQty, etd: row.usedEtd };
  return { type: "-", amount: null, qty: null, etd: null };
};

const formatStatusSummary = (counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([status, count]) => `${status} (${count})`)
    .join(" • ");

export default function PartsQuotesPage() {
  const params = useParams();
  const companyId =
    typeof params?.companyId === "string" ? params.companyId : params?.companyId?.[0] ?? "";
  const [activeTab, setActiveTab] = useState<TabId>("quoted");
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCar, setSelectedCar] = useState<CarGroup | null>(null);

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

  const carGroups = useMemo(() => {
    const map = new Map<string, CarGroup>();
    rows.forEach((row) => {
      const candidateName = [row.carMake, row.carModel].filter(Boolean).join(" ").trim();
      const fallbackKey = `car-${map.size + 1}`;
      const key =
        row.carId ??
        row.carPlate ??
        row.carVin ??
        (candidateName.length ? candidateName : fallbackKey);
      const status = row.status ?? "unknown";
      const existing = map.get(key);
      if (existing) {
        existing.quotes.push(row);
        existing.statusCounts[status] = (existing.statusCounts[status] ?? 0) + 1;
      } else {
        map.set(key, {
          key,
          carId: row.carId,
          carMake: row.carMake,
          carModel: row.carModel,
          carPlate: row.carPlate,
          carVin: row.carVin,
          quotes: [row],
          statusCounts: { [status]: 1 },
        });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const carTableBody = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={7}>
            Loading cars with part quotes...
          </td>
        </tr>
      );
    }
    if (error) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-rose-300" colSpan={7}>
            {error}
          </td>
        </tr>
      );
    }
    if (!carGroups.length) {
      return (
        <tr>
          <td className="px-3 py-8 text-center text-sm text-slate-300/80" colSpan={7}>
            No cars with part quotes found.
          </td>
        </tr>
      );
    }
    return carGroups.map((car, index) => {
      const carLabel = [car.carMake, car.carModel].filter(Boolean).join(" ").trim() || "Unknown car";
      const statusSummary = formatStatusSummary(car.statusCounts) || "No status";
      return (
        <tr key={car.key} className="border-t border-white/5">
          <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
          <td className="px-3 py-3 text-sm">{carLabel}</td>
          <td className="px-3 py-3">{car.carPlate ?? "-"}</td>
          <td className="px-3 py-3">{car.carVin ?? "-"}</td>
          <td className="px-3 py-3 text-xs text-muted-foreground">{statusSummary}</td>
          <td className="px-3 py-3 text-sm">{car.quotes.length}</td>
          <td className="px-3 py-3 text-right">
            <button
              type="button"
              onClick={() => setSelectedCar(car)}
              className="rounded-md border border-border px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-500 hover:text-emerald-500"
            >
              View quotes
            </button>
          </td>
        </tr>
      );
    });
  }, [carGroups, loading, error]);

  const selectedCarQuotes = selectedCar?.quotes ?? [];

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Part Quotes by Car</h1>
          <p className="text-sm text-muted-foreground">Grouped view of cars that have received vendor quotes.</p>
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
          <div className="overflow-x-auto">
            <table className="min-w-[800px] text-sm text-slate-100">
              <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Car</th>
                  <th className="px-3 py-2 text-left">Plate</th>
                  <th className="px-3 py-2 text-left">VIN</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Quotes</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>{carTableBody}</tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelectedCar(null)}
          />
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-white">
                  Quotes for{" "}
                  {[selectedCar.carMake, selectedCar.carModel].filter(Boolean).join(" ") ||
                    "Unknown car"}
                </div>
                <div className="text-xs text-slate-400">
                  Plate: {selectedCar.carPlate ?? "-"} • VIN: {selectedCar.carVin ?? "-"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCar(null)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:border-rose-400 hover:text-rose-400"
              >
                Close
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm text-slate-100">
                <thead className="bg-slate-900 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Vendor</th>
                  <th className="px-3 py-2 text-left">Part</th>
                  <th className="px-3 py-2 text-left">OEM</th>
                  <th className="px-3 py-2 text-left">OE</th>
                  <th className="px-3 py-2 text-left">AFTM</th>
                  <th className="px-3 py-2 text-left">Used</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
                </thead>
            <tbody>
              {selectedCarQuotes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-xs text-slate-400">
                    No quotes for this vehicle.
                  </td>
                </tr>
              ) : (
                selectedCarQuotes.map((row, index) => {
                  const statusLabel = row.estimateItemStatus ?? row.status ?? "pending";
                  const isApproved = statusLabel.toLowerCase() === "approved";
                  const normalizedApprovedType = row.approvedType?.toLowerCase() ?? "";
                  const types = [
                    { name: "OEM", value: row.oem, etd: row.oemEtd },
                    { name: "OE", value: row.oe, etd: row.oeEtd },
                    { name: "AFTM", value: row.aftm, etd: row.aftmEtd },
                    { name: "Used", value: row.used, etd: row.usedEtd },
                  ];
                  return (
                    <tr key={row.id} className="border-t border-white/5">
                      <td className="px-3 py-3 text-xs text-slate-300/80">{index + 1}</td>
                      <td className="px-3 py-3 text-sm font-semibold">{row.vendorName ?? "-"}</td>
                      <td className="px-3 py-3 text-sm">
                        <div>{row.partName}</div>
                        <div className="text-[11px] text-slate-500">{row.remarks ?? ""}</div>
                      </td>
                      {types.map((type) => {
                        const typeKey = type.name.toLowerCase();
                        const isTypeApproved = isApproved && normalizedApprovedType === typeKey;
                        return (
                          <td key={`${row.id}-${type.name}`} className="px-3 py-3 align-top">
                            <div className="flex items-center justify-between gap-1 text-xs">
                              <span className="font-semibold">
                                {type.value != null ? `${type.value.toFixed(2)} AED` : "-"}
                              </span>
                              {isTypeApproved && (
                                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  Approved
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{type.etd ?? "-"}</div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-xs text-slate-400">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase text-slate-200">
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isApproved ? (
                          <button
                            type="button"
                            className="rounded-md border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/10"
                          >
                            Accept quote
                          </button>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-300">
                            Approval pending
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
          </div>
        </div>
      )}
    </AppLayout>
  );
}
