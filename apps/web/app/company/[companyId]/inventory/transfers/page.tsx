"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@repo/ui";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type {
  InventoryLocation,
  InventoryTransfer,
} from "@repo/ai-core/workshop/inventory/types";

type Props = { params: Promise<{ companyId: string }> };
type LoadState<T> = { status: "idle" | "loading" | "loaded" | "error"; data: T | null; error: string | null };

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InventoryTransfersPage({ params }: Props) {
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
      <InventoryTransfersPanel companyId={companyId} />
    </AppLayout>
  );
}

function InventoryTransfersPanel({ companyId }: { companyId: string }) {
  const [transferState, setTransferState] = useState<LoadState<InventoryTransfer[]>>({
    status: "idle",
    data: null,
    error: null,
  });
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function loadTransfers() {
      setTransferState({ status: "loading", data: null, error: null });
      try {
        const base = `/api/company/${companyId}/workshop/inventory/transfers`;
        const suffix = filter && filter !== "all" ? `?status=${encodeURIComponent(filter)}` : "";
        const res = await fetch(`${base}${suffix}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setTransferState({ status: "loaded", data: json.data ?? [], error: null });
      } catch (err) {
        if (!cancelled) setTransferState({ status: "error", data: null, error: "Unable to load transfers." });
      }
    }
    loadTransfers();
    return () => {
      cancelled = true;
    };
  }, [companyId, filter]);

  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/inventory/locations`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setLocations(json.data ?? []);
      } catch {
        // keep empty list, locations are optional
      }
    }
    loadLocations();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const locationMap = useMemo(() => {
    const map = new Map<string, InventoryLocation>();
    locations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [locations]);

  const transfers = transferState.data ?? [];

  return (
    <MainPageShell
      title="Inventory Transfers"
      subtitle="Track every location-to-location movement."
      scopeLabel={`Company ${companyId}`}
      contentClassName="rounded-2xl border-0 bg-transparent p-0"
      primaryAction={
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/5 bg-slate-950/80 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Transfer playbook</div>
              <h2 className="text-lg font-semibold text-slate-100">Process overview</h2>
              <p className="text-xs text-slate-300">
                Transfers are always Location → Location. Use draft → dispatch → receive to record every movement.
              </p>
            </div>
            <Link
              href={`/company/${companyId}/inventory`}
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200"
            >
              Open inventory overview
            </Link>
          </div>
          <ul className="mt-4 grid gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
            <li className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2">Step 1: Stock is available at the source location.</li>
            <li className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2">Step 2: Create a transfer order that lists SKUs and quantities.</li>
            <li className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2">Step 3: Dispatch (stock out) and mark the order in transit.</li>
            <li className="rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2">Step 4: Receive goods at the destination and close the transfer.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/5 bg-slate-950/80 p-5 shadow-xl">
          {transferState.status === "loading" ? (
            <p className="text-sm text-slate-300">Loading transfers…</p>
          ) : transferState.status === "error" ? (
            <p className="text-sm text-destructive">{transferState.error}</p>
          ) : transfers.length === 0 ? (
            <p className="text-sm text-slate-300">No transfers recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/70">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/70 text-[11px] uppercase tracking-wide text-slate-300">
                    <th className="py-2 px-3 text-left">Transfer</th>
                    <th className="py-2 px-3 text-left">From</th>
                    <th className="py-2 px-3 text-left">To</th>
                    <th className="py-2 px-3 text-left">Status</th>
                    <th className="py-2 px-3 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => {
                    const from = locationMap.get(transfer.fromLocationId);
                    const to = locationMap.get(transfer.toLocationId);
                    return (
                      <tr key={transfer.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="py-3 px-3">
                          <Link
                            href={`/company/${companyId}/inventory/transfers/${transfer.id}`}
                            className="text-emerald-200 hover:underline"
                          >
                            {transfer.transferNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {from ? `${from.code} — ${from.name}` : transfer.fromLocationId.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-[11px]">
                          {to ? `${to.code} — ${to.name}` : transfer.toLocationId.slice(0, 8)}
                        </td>
                        <td className="py-3 px-3 text-xs capitalize">
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-200">
                            {transfer.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400">
                          {new Date(transfer.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainPageShell>
  );
}
