"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card } from "@repo/ui";

type Params = { companyId: string; branchId: string };

type Entry = {
  id: string;
  category: "receivable" | "payable";
  type: "inspection" | "job" | "stock" | "fine" | "other";
  description: string;
  amount: number;
  status: "open" | "partial" | "paid" | "disputed";
  dueDate?: string | null;
};

type Summary = {
  receivables: number;
  payables: number;
  net: number;
};

function currency(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusPill({ status }: { status: Entry["status"] }) {
  const map: Record<Entry["status"], string> = {
    open: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100",
    partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100",
    paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
    disputed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status]}`}>{status}</span>;
}

export default function BranchAccountingPage({
  params,
}: { params: Params } | { params: Promise<Params> }) {
  const [ids, setIds] = useState<Params | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds(p));
  }, [params]);

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/company/${ids.companyId}/branches/${ids.branchId}/accounting/summary`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: Entry[] = json?.data ?? json?.entries ?? [];
        if (!cancelled && Array.isArray(rows)) {
          setEntries(rows);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load balances.");
          setEntries([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const summary: Summary = useMemo(() => {
    const receivables = entries
      .filter((e) => e.category === "receivable")
      .reduce((sum, e) => sum + e.amount, 0);
    const payables = entries
      .filter((e) => e.category === "payable")
      .reduce((sum, e) => sum + e.amount, 0);
    return { receivables, payables, net: receivables - payables };
  }, [entries]);

  const receivables = entries.filter((e) => e.category === "receivable");
  const payables = entries.filter((e) => e.category === "payable");

  return (
    <AppLayout>
      <div className="space-y-4 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Branch Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Track receivables from completed work and payables owed to company (stock, penalties, services).
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Receivables from company</div>
            <div className="text-2xl font-semibold mt-1">AED {currency(summary.receivables)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Payables to company</div>
            <div className="text-2xl font-semibold mt-1">AED {currency(summary.payables)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Net position</div>
            <div className={`text-2xl font-semibold mt-1 ${summary.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              AED {currency(summary.net)}
            </div>
          </Card>
        </div>

        {error && <div className="text-sm text-amber-600">{error}</div>}
        {loading && <div className="text-sm text-muted-foreground">Loading balances…</div>}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Receivables</div>
                <p className="text-xs text-muted-foreground">Inspections and jobs completed, waiting settlement.</p>
              </div>
              <span className="text-xs text-muted-foreground">Count: {receivables.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-[11px] text-muted-foreground">
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-left">Amount</th>
                    <th className="py-2 text-left">Due</th>
                    <th className="py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted-foreground">
                        No receivables yet.
                      </td>
                    </tr>
                  ) : (
                    receivables.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{e.description}</div>
                          <div className="text-[11px] uppercase text-muted-foreground">{e.type}</div>
                        </td>
                        <td className="py-2 pr-3">AED {currency(e.amount)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{e.dueDate ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <StatusPill status={e.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Payables</div>
                <p className="text-xs text-muted-foreground">
                  Stock received from company, penalties, and other charges.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">Count: {payables.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b text-[11px] text-muted-foreground">
                    <th className="py-2 text-left">Description</th>
                    <th className="py-2 text-left">Amount</th>
                    <th className="py-2 text-left">Due</th>
                    <th className="py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted-foreground">
                        No payables yet.
                      </td>
                    </tr>
                  ) : (
                    payables.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{e.description}</div>
                          <div className="text-[11px] uppercase text-muted-foreground">{e.type}</div>
                        </td>
                        <td className="py-2 pr-3">AED {currency(e.amount)}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{e.dueDate ?? "—"}</td>
                        <td className="py-2 pr-3">
                          <StatusPill status={e.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
