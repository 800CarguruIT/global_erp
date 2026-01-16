"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MainPageShell } from "./MainPageShell";
import type { Quote } from "@repo/ai-core/workshop/quotes/types";
import type { WorkOrder } from "@repo/ai-core/workshop/workorders/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "loaded"; data: T; error: null }
  | { status: "error"; data: null; error: string };

type BranchQuoteStage = "open" | "quoted" | "approved" | "accepted" | "completed" | "verified";

type BranchQuoteRow = {
  key: string;
  workOrderId?: string;
  quoteId?: string;
  stage: BranchQuoteStage;
  quoteAmount?: number;
  negotiatedAmount?: number;
  updatedAt: string;
  workOrderStatus?: string;
};

const STAGE_LABEL: Record<BranchQuoteStage, string> = {
  open: "Open",
  quoted: "Quoted",
  approved: "Approved",
  accepted: "Accepted",
  completed: "Completed",
  verified: "Verified",
};

const STAGE_ORDER: BranchQuoteStage[] = ["open", "quoted", "approved", "accepted", "completed", "verified"];

export function BranchQuotesMain({ companyId, branchId }: { companyId?: string | null; branchId?: string | null }) {
  const [state, setState] = useState<LoadState<{ quotes: Quote[]; workOrders: WorkOrder[] }>>({
    status: "loading",
    data: null,
    error: null,
  });
  const [stageFilter, setStageFilter] = useState<BranchQuoteStage | "all">("all");
  const [editing, setEditing] = useState<{
    workOrderId?: string;
    quoteId?: string;
    quotedAmount: string;
    negotiatedAmount: string;
  } | null>(null);
  const [actioningKey, setActioningKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pathname = usePathname();
  const { effectiveCompanyId, effectiveBranchId } = useMemo(() => {
    const normalize = (val?: string | null) => {
      if (!val) return null;
      const trimmed = `${val}`.trim();
      if (!trimmed || trimmed === "undefined" || trimmed === "null") return null;
      return trimmed;
    };
    const parsed = pathname?.match(/\/company\/([^/]+)\/branches\/([^/]+)/);
    const shortParsed = pathname?.match(/\/branches\/([^/]+)/);
    return {
      effectiveCompanyId: normalize(companyId) ?? normalize(parsed?.[1]),
      effectiveBranchId: normalize(branchId) ?? normalize(parsed?.[2] ?? shortParsed?.[1]),
    };
  }, [companyId, branchId, pathname]);

  async function fetchData(): Promise<{ quotes: Quote[]; workOrders: WorkOrder[] }> {
    if (!effectiveCompanyId || !effectiveBranchId) throw new Error("companyId and branchId are required");
    const [quotesRes, workOrdersRes] = await Promise.all([
      fetch(`/api/company/${effectiveCompanyId}/workshop/quotes?type=branch_labor`),
      fetch(`/api/company/${effectiveCompanyId}/workshop/workorders?branchId=${encodeURIComponent(effectiveBranchId)}`),
    ]);
    if (!quotesRes.ok) throw new Error(`Quotes HTTP ${quotesRes.status}`);
    if (!workOrdersRes.ok) throw new Error(`Work orders HTTP ${workOrdersRes.status}`);
    const quotesJson = await quotesRes.json();
    const workOrdersJson = await workOrdersRes.json();
    return {
      quotes: (quotesJson.data ?? []) as Quote[],
      workOrders: (workOrdersJson.data ?? []) as WorkOrder[],
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ status: "loading", data: null, error: null });
      try {
        const data = await fetchData();
        if (!cancelled) setState({ status: "loaded", data, error: null });
      } catch (err) {
        console.error(err);
        if (!cancelled)
          setState({
            status: "error",
            data: null,
            error: !effectiveCompanyId || !effectiveBranchId ? "Branch and company are required to load quotes." : "Failed to load branch quotes.",
          });
      }
    }
    if (!effectiveCompanyId || !effectiveBranchId) {
      setState({
        status: "error",
        data: null,
        error: "Branch and company are required to load quotes.",
      });
      return;
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveCompanyId, effectiveBranchId]);

  const rows: BranchQuoteRow[] = useMemo(() => {
    if (state.status !== "loaded") return [];
    const branchQuotes = (state.data.quotes ?? []).filter((q) => q.branchId === effectiveBranchId);
    const workOrders = state.data.workOrders ?? [];

    const quoteByWo = new Map<string, Quote>();
    for (const q of branchQuotes) {
      if (q.workOrderId && !quoteByWo.has(q.workOrderId)) quoteByWo.set(q.workOrderId, q);
    }

    const usedQuotes = new Set<string>();
    const compiled: BranchQuoteRow[] = [];

    for (const wo of workOrders) {
      const quote = quoteByWo.get(wo.id);
      if (quote) usedQuotes.add(quote.id);
      compiled.push({
        key: wo.id,
        workOrderId: wo.id,
        quoteId: quote?.id,
        stage: deriveStage(wo, quote),
        quoteAmount: quote?.totalAmount,
        negotiatedAmount: typeof quote?.meta?.negotiatedAmount === "number" ? quote.meta.negotiatedAmount : undefined,
        updatedAt: quote?.updatedAt ?? wo.updatedAt,
        workOrderStatus: wo.status,
      });
    }

    for (const quote of branchQuotes) {
      if (usedQuotes.has(quote.id)) continue;
      compiled.push({
        key: quote.id,
        workOrderId: quote.workOrderId ?? undefined,
        quoteId: quote.id,
        stage: deriveStage(undefined, quote),
        quoteAmount: quote.totalAmount,
        negotiatedAmount: typeof quote?.meta?.negotiatedAmount === "number" ? quote.meta.negotiatedAmount : undefined,
        updatedAt: quote.updatedAt,
      });
    }

    return compiled.sort((a, b) => {
      const orderDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [state, effectiveBranchId]);

  const filteredRows = stageFilter === "all" ? rows : rows.filter((r) => r.stage === stageFilter);

  const stageCounts = useMemo(() => {
    const counts: Record<BranchQuoteStage, number> = {
      open: 0,
      quoted: 0,
      approved: 0,
      accepted: 0,
      completed: 0,
      verified: 0,
    };
    for (const r of rows) counts[r.stage] += 1;
    return counts;
  }, [rows]);

  async function ensureQuote(workOrderId?: string, quoteId?: string): Promise<Quote> {
    if (state.status === "loaded") {
      if (quoteId) {
        const existing = state.data.quotes.find((q) => q.id === quoteId);
        if (existing) return existing;
      }
      if (workOrderId) {
        const existing = state.data.quotes.find((q) => q.workOrderId === workOrderId && q.branchId === effectiveBranchId);
        if (existing) return existing;
      }
    }
    if (!workOrderId) throw new Error("workOrderId required to create quote");
    if (!effectiveCompanyId || !effectiveBranchId) throw new Error("companyId and branchId are required");
    const res = await fetch(`/api/company/${effectiveCompanyId}/workshop/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "branch_labor", workOrderId, branchId: effectiveBranchId }),
    });
    if (!res.ok) throw new Error(`Failed to create quote (HTTP ${res.status})`);
    const json = await res.json();
    const created: Quote = json.data?.quote ?? json.data;
    return created;
  }

  async function saveQuote(action: "quoted" | "approved") {
    if (!editing) return;
    const amount = Number(editing.quotedAmount);
    if (!amount || amount < 0) {
      setActionError("Enter a valid quoted amount.");
      return;
    }
    setActionError(null);
    setActioningKey(`${editing.workOrderId ?? editing.quoteId ?? "row"}-${action}`);
    try {
      const quote = await ensureQuote(editing.workOrderId, editing.quoteId);
      const body: Record<string, unknown> = {
        header: { status: action === "approved" ? "approved" : "quoted" },
        items: [
          {
            laborHours: 1,
            laborRate: amount,
            unitPrice: amount,
            quantity: 1,
          },
        ],
      };
      const negotiated = Number(editing.negotiatedAmount);
      if (!Number.isNaN(negotiated) && negotiated > 0) {
        (body as any).meta = { negotiatedAmount: negotiated };
      }
      if (action === "approved") (body as any).approve = true;

      const res = await fetch(`/api/company/${effectiveCompanyId}/workshop/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await fetchData();
      setState({ status: "loaded", data, error: null });
      setEditing(null);
    } catch (err) {
      console.error(err);
      setActionError("Unable to save quote.");
    } finally {
      setActioningKey(null);
    }
  }

  async function handleStatusUpdate(row: BranchQuoteRow, next: BranchQuoteStage) {
    setActionError(null);
    setActioningKey(`${row.key}-${next}`);
    try {
      const quote = await ensureQuote(row.workOrderId, row.quoteId);
      const meta: Record<string, unknown> = {};
      const now = new Date().toISOString();
      if (next === "accepted") meta.acceptedAt = now;
      if (next === "completed") meta.completedAt = now;
      if (next === "verified") meta.verifiedAt = now;

      await fetch(`/api/company/${effectiveCompanyId}/workshop/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header: { status: next }, meta }),
      });

      if (row.workOrderId && next === "completed") {
        await fetch(`/api/company/${effectiveCompanyId}/workshop/workorders/${row.workOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ header: { status: "completed" } }),
        });
      }
      if (row.workOrderId && next === "verified") {
        await fetch(`/api/company/${effectiveCompanyId}/workshop/workorders/${row.workOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ header: { status: "closed" } }),
        });
      }

      const data = await fetchData();
      setState({ status: "loaded", data, error: null });
    } catch (err) {
      console.error(err);
      setActionError("Unable to update status.");
    } finally {
      setActioningKey(null);
    }
  }

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  return (
    <MainPageShell
      title="Branch Quotes"
      subtitle="Track work orders approved by the company, capture branch quotes, and move them through acceptance, completion, and verification."
      scopeLabel={`Branch: ${effectiveBranchId ?? "-"}`}
    >
      <div className="space-y-3 py-2">
        <div className="rounded-lg border bg-card/60 p-3 text-sm text-muted-foreground">
          <div>Approved work orders assigned to this branch appear in <span className="font-semibold text-foreground">Open</span>. Submit your quote to move to <span className="font-semibold text-foreground">Quoted</span>, companies can negotiate or approve amounts, and branches can accept, complete, and verify jobs.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...STAGE_ORDER] as const).map((stage) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stage === "all" ? "all" : (stage as BranchQuoteStage))}
              className={`rounded-full border px-3 py-1 text-xs ${
                stageFilter === stage ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {stage === "all" ? "All" : STAGE_LABEL[stage as BranchQuoteStage]}
              {stage === "all" ? ` - ${rows.length}` : ` - ${stageCounts[stage as BranchQuoteStage]}`}
            </button>
          ))}
        </div>
      </div>

      {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading quotes...</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.error}</p>}

      {state.status === "loaded" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 text-left">Work order</th>
                <th className="px-3 py-3 text-left">Quote</th>
                <th className="px-3 py-3 text-left">Stage</th>
                <th className="px-3 py-3 text-left">Amounts</th>
                <th className="px-3 py-3 text-left">Updated</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No records yet. Approved work orders will appear here automatically.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isEditing =
                    editing &&
                    editing.workOrderId === row.workOrderId &&
                    (editing.quoteId ? editing.quoteId === row.quoteId : true);
                  return (
                    <tr key={row.key} className="border-b last:border-0">
                      <td className="px-3 py-3">
                        {row.workOrderId ? (
                          <a
                            className="font-semibold text-primary hover:underline"
                            href={`/company/${effectiveCompanyId}/workshop/workorders/${row.workOrderId}`}
                          >
                            WO-{row.workOrderId.slice(0, 8)}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        <div className="text-[11px] text-muted-foreground">{row.workOrderStatus ?? ""}</div>
                      </td>
                      <td className="px-3 py-3">
                        {row.quoteId ? (
                          <a
                            className="text-primary hover:underline"
                            href={`/company/${effectiveCompanyId}/quotes/branch/${row.quoteId}`}
                          >
                            Q-{row.quoteId.slice(0, 8)}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not created</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border px-2 py-1 text-xs font-medium">
                          {STAGE_LABEL[row.stage]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs">
                          <div className="text-muted-foreground">Quoted</div>
                          <div className="font-semibold">{row.quoteAmount != null ? formatter.format(row.quoteAmount) : "-"}</div>
                        </div>
                        <div className="text-xs pt-1">
                          <div className="text-muted-foreground">Negotiated</div>
                          <div className="font-semibold">
                            {row.negotiatedAmount != null ? formatter.format(row.negotiatedAmount) : "Pending"}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {new Date(row.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <input
                                className="rounded border px-2 py-1 text-sm"
                                placeholder="Quoted amount"
                                value={editing.quotedAmount}
                                onChange={(e) => setEditing({ ...editing, quotedAmount: e.target.value })}
                              />
                              <input
                                className="rounded border px-2 py-1 text-sm"
                                placeholder="Negotiated amount (optional)"
                                value={editing.negotiatedAmount}
                                onChange={(e) => setEditing({ ...editing, negotiatedAmount: e.target.value })}
                              />
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 text-xs font-medium"
                                onClick={() => saveQuote("quoted")}
                                disabled={actioningKey !== null}
                              >
                                Save quote
                              </button>
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 text-xs font-medium"
                                onClick={() => saveQuote("approved")}
                                disabled={actioningKey !== null}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 text-xs font-medium"
                                onClick={() => setEditing(null)}
                                disabled={actioningKey !== null}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                            {(row.stage === "open" || row.stage === "quoted") && (
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 font-medium"
                                onClick={() =>
                                  setEditing({
                                    workOrderId: row.workOrderId,
                                    quoteId: row.quoteId,
                                    quotedAmount: row.quoteAmount != null ? row.quoteAmount.toString() : "",
                                    negotiatedAmount: row.negotiatedAmount != null ? row.negotiatedAmount.toString() : "",
                                  })
                                }
                              >
                                Provide quote
                              </button>
                            )}
                            {row.stage === "approved" && (
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 font-medium"
                                onClick={() => handleStatusUpdate(row, "accepted")}
                                disabled={actioningKey !== null}
                              >
                                Accept
                              </button>
                            )}
                            {row.stage === "accepted" && (
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 font-medium"
                                onClick={() => handleStatusUpdate(row, "completed")}
                                disabled={actioningKey !== null}
                              >
                                Mark completed
                              </button>
                            )}
                            {row.stage === "completed" && (
                              <button
                                type="button"
                                className="rounded-md border px-3 py-1 font-medium"
                                onClick={() => handleStatusUpdate(row, "verified")}
                                disabled={actioningKey !== null}
                              >
                                Verify
                              </button>
                            )}
                            {row.stage === "verified" && (
                              <span className="text-muted-foreground">Receivable ready</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {actionError && <p className="pt-3 text-xs text-destructive">{actionError}</p>}
    </MainPageShell>
  );
}

function deriveStage(workOrder?: WorkOrder, quote?: Quote): BranchQuoteStage {
  if (quote) {
    switch (quote.status) {
      case "open":
      case "draft":
      case "submitted":
        return "open";
      case "quoted":
        return "quoted";
      case "approved":
        return "approved";
      case "accepted":
        return "accepted";
      case "completed":
        return "completed";
      case "verified":
        return "verified";
      default:
        break;
    }
  }

  if (workOrder) {
    if (workOrder.status === "completed" || workOrder.status === "closed") return "completed";
    if (["queue", "waiting_parts", "ready", "in_progress"].includes(workOrder.status)) return "accepted";
    return "open";
  }

  return "open";
}


