"use client";

import React, { useEffect, useMemo, useState } from "react";
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
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type OrderedPartsGroup = {
  inspectionId: string;
  customerName: string;
  customerPhone: string;
  carLabel: string;
  plateNumber: string;
  items: OrderedPartRow[];
};

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
  const [activeGroup, setActiveGroup] = useState<OrderedPartsGroup | null>(null);
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

  const groups = useMemo<OrderedPartsGroup[]>(() => {
    const rows = state.status === "loaded" ? state.data : [];
    const map = new Map<string, OrderedPartsGroup>();
    rows.forEach((row) => {
      const inspectionId = row.inspection_id;
      if (!map.has(inspectionId)) {
        const carLabel = [row.make, row.model, row.model_year].filter(Boolean).join(" ");
        map.set(inspectionId, {
          inspectionId,
          customerName: row.customer_name ?? "Unknown customer",
          customerPhone: row.customer_phone ?? "N/A",
          carLabel: carLabel || "Unknown car",
          plateNumber: row.plate_number ?? "N/A",
          items: [],
        });
      }
      map.get(inspectionId)?.items.push(row);
    });
    return Array.from(map.values());
  }, [state]);

  const isLoading = state.status === "loading";
  const loadError = state.status === "error" ? state.error : null;

  async function updateOrderStatus(lineItemId: string, orderStatus: OrderedPartRow["order_status"]) {
    if (!orderStatus) return;
    setPendingUpdate(lineItemId);
    const previous = state.status === "loaded" ? state.data : [];
    const previousActive = activeGroup;
    setState((prev) => {
      if (prev.status !== "loaded") return prev;
      return {
        ...prev,
        data: prev.data.map((row) =>
          row.line_item_id === lineItemId ? { ...row, order_status: orderStatus } : row
        ),
      };
    });
    setActiveGroup((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((row) =>
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
      if (previousActive) {
        setActiveGroup(previousActive);
      }
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
      {isLoading && <p className="text-sm text-muted-foreground">Loading ordered parts…</p>}
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {!isLoading && !loadError && (
        <div className={`overflow-x-auto rounded-md border-0 ring-0 outline-none ${theme.cardBg}`}>
          <table className="min-w-full border-0 text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">Car</th>
                <th className="px-3 py-2 text-left">Plate</th>
                <th className="px-3 py-2 text-left">Ordered Parts</th>
                <th className="px-3 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No ordered parts yet.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.inspectionId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-3 text-sm font-semibold">{group.customerName}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{group.customerPhone}</td>
                    <td className="px-3 py-3 text-xs">{group.carLabel}</td>
                    <td className="px-3 py-3 text-xs">{group.plateNumber}</td>
                    <td className="px-3 py-3 text-xs font-semibold">
                      {group.items.length}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setActiveGroup(group)}
                        className="rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900"
                      >
                        View Parts Ordered
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      {activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-3xl overflow-visible rounded-lg ${theme.cardBg} ${theme.cardBorder}`}>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold">{activeGroup.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {activeGroup.carLabel} · Plate {activeGroup.plateNumber}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                className="text-xs text-muted-foreground"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3 text-xs text-muted-foreground">
                Parts ordered: {activeGroup.items.length}
              </div>
              <div className="overflow-x-auto overflow-y-visible">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] text-muted-foreground">
                      <th className="px-2 py-2 text-left">Part</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Qty</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Order Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroup.items.map((item) => (
                      <tr key={item.line_item_id} className="border-b border-border/60 last:border-0 align-middle">
                        <td className="px-3 py-4 font-semibold">{item.product_name ?? "Unnamed part"}</td>
                        <td className="px-3 py-4 text-muted-foreground">
                          {item.description ?? "-"}
                        </td>
                        <td className="px-3 py-4">{item.quantity ?? 0}</td>
                        <td className="px-3 py-4 uppercase">{item.status ?? "Approved"}</td>
                        <td className="px-3 py-5">
                          <select
                            className={`${theme.input} relative z-10 h-10 min-w-[140px] text-[12px] leading-6`}
                            value={item.order_status ?? "Ordered"}
                            disabled={pendingUpdate === item.line_item_id}
                            onChange={(e) =>
                              updateOrderStatus(
                                item.line_item_id,
                                e.target.value as OrderedPartRow["order_status"]
                              )
                            }
                          >
                            <option value="Ordered">Ordered</option>
                            <option value="Received">Received</option>
                            <option value="Returned">Returned</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainPageShell>
  );
}
