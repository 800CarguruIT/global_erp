"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@repo/ui";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type {
  InventoryLocation,
  InventoryTransfer,
} from "@repo/ai-core/workshop/inventory/types";

type Props = { params: { companyId: string } };
type LoadState<T> = { status: "idle" | "loading" | "loaded" | "error"; data: T | null; error: string | null };

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "in_transit", label: "In transit" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InventoryTransfersPage({ params }: Props) {
  const { companyId } = params;
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
      primaryAction={
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="rounded-md border border-border/60 bg-card/80 px-2 py-1 text-xs"
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
        <section className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Process overview</h2>
              <p className="text-xs text-muted-foreground">
                Transfers are always Location → Location. Use draft → dispatch → receive to record every movement.
              </p>
            </div>
            <Link
              href={`/company/${companyId}/inventory`}
              className="text-xs font-semibold text-primary underline"
            >
              Open inventory overview
            </Link>
          </div>
          <ul className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
            <li>Step 1: Stock is available at the source location.</li>
            <li>Step 2: Create a transfer order that lists SKUs and quantities.</li>
            <li>Step 3: Dispatch (stock out) and mark the order in transit.</li>
            <li>Step 4: Receive goods at the destination and close the transfer.</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
          {transferState.status === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading transfers…</p>
          ) : transferState.status === "error" ? (
            <p className="text-sm text-destructive">{transferState.error}</p>
          ) : transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfers recorded yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md bg-slate-900/60">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead>
                  <tr className="bg-muted/10 text-[11px] text-muted-foreground">
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
                      <tr key={transfer.id} className="bg-transparent hover:bg-muted/10">
                        <td className="py-3 px-3">
                          <Link
                            href={`/company/${companyId}/inventory/transfers/${transfer.id}`}
                            className="text-primary hover:underline"
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
                        <td className="py-3 px-3 text-xs capitalize">{transfer.status.replace("_", " ")}</td>
                        <td className="py-3 px-3 text-[11px] text-muted-foreground">
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
