"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Quote, QuoteStatus, QuoteType } from "@repo/ai-core/workshop/quotes/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function QuotesMain({ companyId }: { companyId: string }) {
  const [state, setState] = useState<LoadState<Quote[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [type, setType] = useState<QuoteType | "all">("vendor_part");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const params = new URLSearchParams();
        if (type !== "all") params.set("type", type);
        if (status !== "all") params.set("status", status);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/company/${companyId}/workshop/quotes${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: Quote[] = json.data ?? [];
        if (!cancelled) setState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load quotes." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, type, status]);

  const isLoading = state.status === "loading";
  const error = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell title="Quotes" subtitle="Internal vendor and branch quotes." scopeLabel="">
      <div className="flex flex-wrap items-center gap-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Type</span>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as QuoteType | "all")}
          >
            <option value="vendor_part">Vendor quotes</option>
            <option value="branch_labor">Branch labor quotes</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <select
            className="rounded-md border px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as QuoteStatus | "all")}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading quotes…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">Quote</th>
                <th className="py-2 px-4 text-left">Type</th>
                <th className="py-2 px-4 text-left">Link</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Total</th>
                <th className="py-2 px-4 text-left">Valid until</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-xs text-muted-foreground">
                    No quotes found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const href = `/company/${companyId}/workshop/quotes/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <a href={href} className="font-medium text-primary hover:underline">
                          {row.id.slice(0, 8)}…
                        </a>
                      </td>
                      <td className="py-2 px-4 text-xs capitalize">{row.quoteType.replace("_", " ")}</td>
                      <td className="py-2 px-4 text-xs">
                        {row.quoteType === "vendor_part" && row.estimateId ? (
                          <a
                            className="text-primary hover:underline"
                            href={`/company/${companyId}/workshop/estimates/${row.estimateId}`}
                          >
                            Estimate {row.estimateId.slice(0, 8)}…
                          </a>
                        ) : row.workOrderId ? (
                          <a
                            className="text-primary hover:underline"
                            href={`/company/${companyId}/workshop/workorders/${row.workOrderId}`}
                          >
                            Work order {row.workOrderId.slice(0, 8)}…
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                      <td className="py-2 px-4 text-xs">{row.totalAmount.toFixed(2)}</td>
                      <td className="py-2 px-4 text-xs">{row.validUntil ?? "—"}</td>
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
