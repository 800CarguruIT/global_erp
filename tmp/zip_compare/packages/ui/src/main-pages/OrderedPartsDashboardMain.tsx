"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import { useTheme } from "../theme";

type OrderedPartRow = {
  line_item_id: string;
  product_name: string | null;
  description: string | null;
  quantity: number | null;
  status: string | null;
  part_ordered: number | null;
  order_status: "Ordered" | "Received" | "Returned" | null;
  inspection_id: string;
  lead_id: string | null;
  car_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  plate_number: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  vendorId?: string | null;
  vendorName?: string | null;
  quoteStatus?: string | null;
  created_at?: string | null;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type OrderedPartsDashboardMainProps = {
  companyId: string;
};

export function OrderedPartsDashboardMain({ companyId }: OrderedPartsDashboardMainProps) {
  const { theme } = useTheme();
  const [state, setState] = useState<LoadState<OrderedPartRow[]>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [pendingUpdate, setPendingUpdate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/ordered-parts`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: OrderedPartRow[] = json.data ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: rows, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", data: null, error: "Failed to load ordered parts." });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const orderedRows = state.status === "loaded" ? state.data : [];
  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;

  async function updateOrderStatus(lineItemId: string, orderStatus: OrderedPartRow["order_status"]) {
    if (!orderStatus) return;
    setPendingUpdate(lineItemId);
    const previous = state.status === "loaded" ? state.data : [];
    setState((prev) => {
      if (prev.status !== "loaded") return prev;
      return {
        ...prev,
        data: prev.data.map((row) =>
          row.line_item_id === lineItemId ? { ...row, order_status: orderStatus } : row
        ),
      };
    });
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/ordered-parts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId, orderStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToastMessage({ type: "success", text: "Order status updated." });
    } catch (err) {
      console.error(err);
      setState((prev) => (prev.status === "loaded" ? { ...prev, data: previous } : prev));
      setToastMessage({ type: "error", text: "Failed to update order status." });
    } finally {
      setPendingUpdate(null);
    }
  }

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <MainPageShell
      title="Parts Dashboard"
      subtitle="Ordered spare parts from inspections."
      scopeLabel="Company workspace"
      contentClassName="p-0"
    >
      {toastMessage && (
        <div className="fixed right-6 top-6 z-50">
          <div
            className={`rounded-md px-4 py-2 text-xs font-semibold shadow-lg ${
              toastMessage.type === "success"
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
            }`}
          >
            {toastMessage.text}
          </div>
        </div>
      )}
      {isLoading && <p className="text-sm text-muted-foreground">Loading ordered parts...</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!isLoading && !loadError && (
        <div className={`overflow-x-auto rounded-md border-0 ring-0 outline-none ${theme.cardBg}`}>
          <table className="w-full min-w-[1100px] border text-[11px]">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Car</th>
                <th className="px-3 py-2 text-left">Plate</th>
                <th className="px-3 py-2 text-left">Part</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Vendor</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Quote</th>
                <th className="px-3 py-2 text-left">Ordered On</th>
                <th className="px-3 py-2 text-left">Order Status</th>
              </tr>
            </thead>
            <tbody>
              {orderedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No ordered parts yet.
                  </td>
                </tr>
              ) : (
                orderedRows.map((row) => {
                  const carLabel = [row.make, row.model, row.model_year].filter(Boolean).join(" ") || "Unknown car";
                  const orderedOn = row.created_at ? new Date(row.created_at).toLocaleDateString() : "-";
                  return (
                    <tr key={row.line_item_id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-3 text-sm font-semibold">{row.customer_name ?? "Unknown customer"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{row.customer_phone ?? "N/A"}</td>
                      <td className="px-3 py-3 text-xs">{carLabel}</td>
                      <td className="px-3 py-3 text-xs">{row.plate_number ?? "N/A"}</td>
                      <td className="px-3 py-3 text-sm font-semibold">{row.product_name ?? "Unnamed part"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{row.description ?? "-"}</td>
                      <td className="px-3 py-3 text-xs">{row.quantity ?? 0}</td>
                      <td className="px-3 py-3 text-xs font-medium">{row.vendorName ?? "Unknown vendor"}</td>
                      <td className="px-3 py-3 text-xs uppercase">{row.status ?? "Approved"}</td>
                      <td className="px-3 py-3 text-xs uppercase">{row.quoteStatus ?? "Ordered"}</td>
                      <td className="px-3 py-3 text-xs">{orderedOn}</td>
                      <td className="px-3 py-3 text-xs">
                        <select
                          className={`${theme.input} h-9 text-[12px]`}
                          value={row.order_status ?? "Ordered"}
                          disabled={pendingUpdate === row.line_item_id}
                          onChange={(e) =>
                            updateOrderStatus(row.line_item_id, e.target.value as OrderedPartRow["order_status"])
                          }
                        >
                          <option value="Ordered">Ordered</option>
                          <option value="Received">Received</option>
                          <option value="Returned">Returned</option>
                        </select>
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
