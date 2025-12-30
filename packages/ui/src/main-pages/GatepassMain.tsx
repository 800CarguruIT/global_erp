"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Gatepass, GatepassStatus } from "@repo/ai-core/workshop/gatepass/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function GatepassMain({ companyId }: { companyId: string }) {
  const [state, setState] = useState<LoadState<Gatepass[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [status, setStatus] = useState<GatepassStatus | "all">("pending");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const qs = status === "all" ? "" : `?status=${status}`;
        const res = await fetch(`/api/company/${companyId}/workshop/gatepass${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: Gatepass[] = json.data ?? [];
        if (!cancelled) setState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load gatepasses." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, status]);

  const isLoading = state.status === "loading";
  const error = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell title="Gatepass" subtitle="Handover queue and release." scopeLabel="">
      <div className="flex items-center gap-3 py-2">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value as GatepassStatus | "all")}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="released">Released</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading gatepasses…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">Gatepass</th>
                <th className="py-2 px-4 text-left">Invoice</th>
                <th className="py-2 px-4 text-left">Handover</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Amount due</th>
                <th className="py-2 px-4 text-left">Payment OK</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-xs text-muted-foreground">
                    No gatepasses.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const href = `/company/${companyId}/workshop/gatepass/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <a href={href} className="font-medium text-primary hover:underline">
                          {row.id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.invoiceId.slice(0, 8)}…</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.handoverType.replace("_", " ")}</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                      <td className="py-2 px-4 text-xs">{row.amountDue.toFixed(2)}</td>
                      <td className="py-2 px-4 text-xs">{row.paymentOk ? "Yes" : "No"}</td>
                      <td className="py-2 px-4 text-xs">
                        <a href={href} className="rounded-md border px-2 py-1">
                          Open
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </MainPageShell>
  );
}
