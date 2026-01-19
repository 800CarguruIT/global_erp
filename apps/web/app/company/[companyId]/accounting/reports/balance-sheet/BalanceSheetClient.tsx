"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@repo/ui";

type Row = { accountCode: string; accountName: string; amount: number; group: string };

export default function BalanceSheetClient({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/balance-sheet?date=${asOf}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load balance sheet");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load balance sheet");
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
          <h1 className="text-2xl font-semibold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">Review assets, liabilities, and equity.</p>
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
          <div className="space-y-2 text-sm">
            {rows.length === 0 && <div className="text-muted-foreground">No data.</div>}
            {rows.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">{r.group}</div>
                  <div className="font-semibold">{`${r.accountCode} — ${r.accountName}`}</div>
                </div>
                <div>{r.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
