"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type { Invoice, InvoiceStatus } from "@repo/ai-core/workshop/invoices/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function InvoicesMain({ companyId }: { companyId: string }) {
  const [state, setState] = useState<LoadState<Invoice[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const qs = statusFilter === "all" ? "" : `?status=${statusFilter}`;
        const res = await fetch(`/api/company/${companyId}/workshop/invoices${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: Invoice[] = json.data ?? [];
        if (!cancelled) setState({ status: "loaded", data: rows, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load invoices." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, statusFilter]);

  const isLoading = state.status === "loading";
  const error = state.status === "error" ? state.error : null;
  const rows = state.status === "loaded" ? state.data : [];

  return (
    <MainPageShell title="Invoices" subtitle="Invoice list for workshop jobs." scopeLabel="">
      <div className="flex items-center gap-3 py-2">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "all")}
        >
          <option value="all">All</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!isLoading && !error && (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="py-2 pl-3 pr-4 text-left">Invoice</th>
                <th className="py-2 px-4 text-left">Work Order</th>
                <th className="py-2 px-4 text-left">Date</th>
                <th className="py-2 px-4 text-left">Status</th>
                <th className="py-2 px-4 text-left">Grand total</th>
                <th className="py-2 px-4 text-left">Payment</th>
                <th className="py-2 px-4 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-center text-xs text-muted-foreground">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const href = `/company/${companyId}/workshop/invoices/${row.id}`;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2 pl-3 pr-4">
                        <a href={href} className="font-medium text-primary hover:underline">
                          {row.invoiceNumber}
                        </a>
                      </td>
                      <td className="py-2 px-4 text-xs">{row.workOrderId.slice(0, 8)}…</td>
                      <td className="py-2 px-4 text-xs">{row.invoiceDate}</td>
                      <td className="py-2 px-4 text-xs capitalize">{row.status}</td>
                      <td className="py-2 px-4 text-xs">{row.grandTotal.toFixed(2)}</td>
                      <td className="py-2 px-4 text-xs">{row.paymentMethod ?? "—"}</td>
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
