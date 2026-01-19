"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  WorkOrder,
  WorkOrderItem,
  WorkOrderStatus,
  WorkLineStatus,
} from "@repo/ai-core/workshop/workorders/types";

type WorkOrderDetailMainProps = {
  companyId: string;
  workOrderId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemPatch = {
  id: string;
  workStatus?: WorkLineStatus;
  issuedQty?: number;
};

export function WorkOrderDetailMain({ companyId, workOrderId }: WorkOrderDetailMainProps) {
  const [state, setState] = useState<LoadState<{ workOrder: WorkOrder; items: WorkOrderItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [headerPatch, setHeaderPatch] = useState<{
    status?: WorkOrderStatus;
    branchId?: string | null;
    queueReason?: string | null;
  }>({});
  const [itemsPatch, setItemsPatch] = useState<ItemPatch[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/workorders/${workOrderId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const workOrder: WorkOrder = json.data?.workOrder ?? json.data;
        const items: WorkOrderItem[] = json.data?.items ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: { workOrder, items }, error: null });
          setHeaderPatch({
            status: workOrder.status,
            branchId: workOrder.branchId ?? null,
            queueReason: workOrder.queueReason ?? "",
          });
          setItemsPatch(items.map((i) => ({ id: i.id, workStatus: i.workStatus, issuedQty: i.issuedQty })));
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load work order." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, workOrderId]);

  async function save() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body: any = {
        status: headerPatch.status,
        branchId: headerPatch.branchId,
        queueReason: headerPatch.queueReason,
        items: itemsPatch,
      };
      const res = await fetch(`/api/company/${companyId}/workshop/workorders/${workOrderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function attachMedia(itemId: string, kind: string, fileRef: string, note?: string) {
    await fetch(`/api/company/${companyId}/workshop/workorders/${workOrderId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workOrderItemId: itemId, kind, fileRef, note }),
    });
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Work Order" subtitle="Loading work order…" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading work order…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Work Order" subtitle="Unable to load work order" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const { workOrder, items } = state.data;

  function updateItem(id: string, patch: Partial<ItemPatch>) {
    setItemsPatch((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <MainPageShell
      title="Work Order"
      subtitle="Manage execution, parts issue, and media attachments."
      scopeLabel={`Work Order ID: ${workOrder.id.slice(0, 8)}…`}
      primaryAction={
        <button type="button" onClick={save} className="rounded-md border px-3 py-1 text-sm font-medium">
          {isSaving ? "Saving…" : "Save"}
        </button>
      }
      secondaryActions={saveError ? <span className="text-xs text-destructive">{saveError}</span> : null}
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Status</div>
              <select
                className="rounded-md border px-2 py-1 text-sm"
                value={headerPatch.status}
                onChange={(e) => setHeaderPatch({ ...headerPatch, status: e.target.value as WorkOrderStatus })}
              >
                <option value="draft">Draft</option>
                <option value="quoting">Quoting</option>
                <option value="queue">Queue</option>
                <option value="waiting_parts">Waiting parts</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Branch</div>
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={headerPatch.branchId ?? ""}
                onChange={(e) => setHeaderPatch({ ...headerPatch, branchId: e.target.value })}
                placeholder="Branch ID"
              />
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Queue reason</div>
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={headerPatch.queueReason ?? ""}
                onChange={(e) => setHeaderPatch({ ...headerPatch, queueReason: e.target.value })}
                placeholder="Waiting parts / bay not available"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Line items</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Part / task</th>
                  <th className="px-2 py-1 text-left">Required</th>
                  <th className="px-2 py-1 text-left">Issued</th>
                  <th className="px-2 py-1 text-left">Work status</th>
                  <th className="px-2 py-1 text-left">Media</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const patch = itemsPatch.find((p) => p.id === item.id) ?? { id: item.id };
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <div className="font-medium">{item.partName}</div>
                          {item.description && <div className="text-[11px] text-muted-foreground">{item.description}</div>}
                        </td>
                        <td className="px-2 py-1 align-top text-xs">{item.requiredQty}</td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 rounded border bg-background px-2 py-1 text-xs"
                            value={patch.issuedQty ?? item.issuedQty}
                            onChange={(e) => updateItem(item.id, { issuedQty: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={patch.workStatus ?? item.workStatus}
                            onChange={(e) => updateItem(item.id, { workStatus: e.target.value as WorkLineStatus })}
                          >
                            <option value="pending">Pending</option>
                            <option value="waiting_parts">Waiting parts</option>
                            <option value="ready">Ready</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <MediaForm onSubmit={(kind, fileRef, note) => attachMedia(item.id, kind, fileRef, note)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </MainPageShell>
  );
}

function MediaForm({ onSubmit }: { onSubmit: (kind: string, fileRef: string, note?: string) => void }) {
  const [kind, setKind] = useState("new_part_photo");
  const [fileRef, setFileRef] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-1 text-[11px]">
      <select className="w-full rounded border bg-background px-2 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="new_part_photo">New part photo</option>
        <option value="old_part_photo">Old part photo</option>
        <option value="completion_video">Completion video</option>
      </select>
      <input
        className="w-full rounded border bg-background px-2 py-1"
        placeholder="File URL / ref"
        value={fileRef}
        onChange={(e) => setFileRef(e.target.value)}
      />
      <input
        className="w-full rounded border bg-background px-2 py-1"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        type="button"
        className="w-full rounded-md border px-2 py-1 text-[11px]"
        onClick={() => {
          if (!fileRef) return;
          onSubmit(kind, fileRef, note || undefined);
          setFileRef("");
          setNote("");
        }}
      >
        Attach
      </button>
    </div>
  );
}
