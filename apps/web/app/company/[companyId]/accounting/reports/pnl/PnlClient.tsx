"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@repo/ui";

type Row = { accountCode?: string; accountName?: string; amount?: number };

export default function PnlClient({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  async function load() {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/pnl?from=${from}&to=${to}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load P&L");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load P&L");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setFrom(today);
    setTo(today);
  }, []);

  useEffect(() => {
    if (from && to) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground">Review income and expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <input type="date" value={from ?? ""} onChange={(e) => setFrom(e.target.value)} className="input" />
          <input type="date" value={to ?? ""} onChange={(e) => setTo(e.target.value)} className="input" />
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
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const code = r.accountCode ?? "";
                  const name = r.accountName ?? "";
                  const amount = Number(r.amount ?? 0);
                  return (
                    <tr key={`${code || "acct"}-${idx}`} className="border-b border-white/5">
                      <td className="px-3 py-2">
                        <div className="font-semibold">{name || code || "-"}</div>
                        <div className="text-xs text-muted-foreground">{code}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{amount.toLocaleString()}</td>
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
