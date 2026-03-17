"use client";

import React, { useEffect, useState } from "react";
import { MainPageShell } from "./MainPageShell";
import type {
  QualityCheck,
  QualityCheckItem,
  QualityCheckItemStatus,
  QualityCheckStatus,
} from "@repo/ai-core/workshop/qualityCheck/types";

type QCDetailProps = {
  companyId: string;
  qcId: string;
};

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type ItemPatch = { id: string; qcStatus?: QualityCheckItemStatus; qcNote?: string };

export function QualityCheckDetailMain({ companyId, qcId }: QCDetailProps) {
  const [state, setState] = useState<LoadState<{ qc: QualityCheck; items: QualityCheckItem[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [headerPatch, setHeaderPatch] = useState<{
    status?: QualityCheckStatus;
    testDriveDone?: boolean;
    washDone?: boolean;
    qcRemarks?: string;
    qcVideoRef?: string;
  }>({});
  const [itemsPatch, setItemsPatch] = useState<ItemPatch[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const res = await fetch(`/api/company/${companyId}/workshop/qc/${qcId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const qc: QualityCheck = json.data?.qc ?? json.data;
        const items: QualityCheckItem[] = json.data?.items ?? [];
        if (!cancelled) {
          setState({ status: "loaded", data: { qc, items }, error: null });
          setHeaderPatch({
            status: qc.status,
            testDriveDone: qc.testDriveDone,
            washDone: qc.washDone,
            qcRemarks: qc.qcRemarks ?? "",
            qcVideoRef: qc.qcVideoRef ?? "",
          });
          setItemsPatch(items.map((i) => ({ id: i.id, qcStatus: i.qcStatus, qcNote: i.qcNote ?? "" })));
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", data: null, error: "Failed to load quality check." });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId, qcId]);

  async function save(complete?: boolean) {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body: any = {
        status: headerPatch.status,
        testDriveDone: headerPatch.testDriveDone,
        washDone: headerPatch.washDone,
        qcRemarks: headerPatch.qcRemarks,
        qcVideoRef: headerPatch.qcVideoRef,
        items: itemsPatch,
        complete: !!complete,
      };
      const res = await fetch(`/api/company/${companyId}/workshop/qc/${qcId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (complete) {
        window.location.href = `/company/${companyId}/workshop/workorders`;
      }
    } catch (err) {
      console.error(err);
      setSaveError("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function createInvoice() {
    setIsCreatingInvoice(true);
    setCreateError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qcId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const invoiceId: string = json.data?.invoice?.id ?? json.data?.invoiceId ?? json.data?.id;
      if (invoiceId) {
        window.location.href = `/company/${companyId}/workshop/invoices/${invoiceId}`;
        return;
      }
    } catch (err) {
      console.error(err);
      setCreateError("Failed to create invoice");
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  if (state.status === "loading") {
    return (
      <MainPageShell title="Quality Check" subtitle="Loading quality check" scopeLabel="">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MainPageShell>
    );
  }
  if (state.status === "error" || !state.data) {
    return (
      <MainPageShell title="Quality Check" subtitle="Unable to load quality check" scopeLabel="">
        <p className="text-sm text-destructive">{state.error}</p>
      </MainPageShell>
    );
  }

  const { qc, items } = state.data;

  function updateItem(id: string, patch: Partial<ItemPatch>) {
    setItemsPatch((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <MainPageShell
      title="Quality Check"
      subtitle="Verify completed work before release."
      scopeLabel={`QC ID: ${qc.id.slice(0, 8)}…`}
      primaryAction={
        <button type="button" onClick={() => save()} className="rounded-md border px-3 py-1 text-sm font-medium">
          {isSaving ? "Saving…" : "Save"}
        </button>
      }
      secondaryActions={
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => save(true)} className="rounded-md border px-3 py-1 text-sm font-medium">
            Complete QC
          </button>
          {qc.status === "completed" && (
            <button
              type="button"
              disabled={isCreatingInvoice}
              onClick={createInvoice}
              className="rounded-md border px-3 py-1 text-sm font-medium"
            >
              {isCreatingInvoice ? "Creating invoice…" : "Create Invoice"}
            </button>
          )}
          {saveError && <span className="text-xs text-destructive">{saveError}</span>}
          {createError && <span className="text-xs text-destructive">{createError}</span>}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Status</div>
              <select
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={headerPatch.status}
                onChange={(e) => setHeaderPatch({ ...headerPatch, status: e.target.value as QualityCheckStatus })}
              >
                <option value="queue">Queue</option>
                <option value="in_process">In process</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="space-y-1 text-sm">
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={!!headerPatch.testDriveDone}
                  onChange={(e) => setHeaderPatch({ ...headerPatch, testDriveDone: e.target.checked })}
                />
                Test drive completed
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={!!headerPatch.washDone}
                  onChange={(e) => setHeaderPatch({ ...headerPatch, washDone: e.target.checked })}
                />
                Wash / cleaning completed
              </label>
            </div>
            <div className="space-y-1 text-sm">
              <div className="text-xs text-muted-foreground">Ready video URL</div>
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={headerPatch.qcVideoRef ?? ""}
                onChange={(e) => setHeaderPatch({ ...headerPatch, qcVideoRef: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Final remarks</div>
            <textarea
              className="h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={headerPatch.qcRemarks ?? ""}
              onChange={(e) => setHeaderPatch({ ...headerPatch, qcRemarks: e.target.value })}
              placeholder="Any final QC notes"
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Line items</h2>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-[11px] text-muted-foreground">
                  <th className="py-1 pl-2 pr-3 text-left">Line</th>
                  <th className="px-2 py-1 text-left">QC status</th>
                  <th className="px-2 py-1 text-left">QC note</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 text-center text-xs text-muted-foreground">
                      No items.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const patch = itemsPatch.find((p) => p.id === item.id) ?? { id: item.id };
                    return (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-1 pl-2 pr-3 align-top">
                          <div className="font-medium">Line {item.lineNo ?? idx + 1}</div>
                          <div className="text-[11px] text-muted-foreground">Item {item.workOrderItemId.slice(0, 8)}…</div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <select
                            className="w-full rounded border bg-background px-2 py-1 text-xs"
                            value={patch.qcStatus ?? item.qcStatus}
                            onChange={(e) => updateItem(item.id, { qcStatus: e.target.value as QualityCheckItemStatus })}
                          >
                            <option value="pending">Pending</option>
                            <option value="ok">OK</option>
                            <option value="issue">Issue</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <textarea
                            className="h-16 w-full resize-none rounded border bg-background px-2 py-1 text-xs"
                            value={patch.qcNote ?? item.qcNote ?? ""}
                            onChange={(e) => updateItem(item.id, { qcNote: e.target.value })}
                            placeholder="QC note"
                          />
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
