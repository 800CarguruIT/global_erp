"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@repo/ui";

type Row = { accountCode?: string; accountName?: string; debit?: number; credit?: number; balance?: number | null };

export default function TrialBalanceClient({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/trial-balance?date=${asOf}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load trial balance");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asOf]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trial Balance</h1>
          <p className="text-sm text-muted-foreground">Check balances across accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <input type="date" value={asOf ?? ""} onChange={(e) => setAsOf(e.target.value)} className="input" />
          <button
            onClick={load}
            className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const debitNum = Number(r.debit ?? 0);
                  const creditNum = Number(r.credit ?? 0);
                  const balanceNum = Number(r.balance ?? debitNum - creditNum);
                  const code = r.accountCode ?? "";
                  const name = r.accountName ?? "";
                  return (
                    <tr key={`${code || "acct"}-${idx}`} className="border-b border-white/5">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{name || code || "-"}</div>
                        <div className="text-xs text-muted-foreground">{code}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{debitNum.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{creditNum.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{balanceNum.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
