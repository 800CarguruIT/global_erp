"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@repo/ui";

type Row = { section: string; amount: number | null };

export default function CashflowClient({ companyId }: { companyId: string }) {
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
      const res = await fetch(`/api/company/${companyId}/accounting/cashflow?from=${from}&to=${to}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load cash flow");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load cash flow");
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
          <h1 className="text-2xl font-semibold">Cash Flow</h1>
          <p className="text-sm text-muted-foreground">Track operating, investing, and financing cash.</p>
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
          <div className="space-y-2 text-sm">
            {rows.length === 0 && <div className="text-muted-foreground">No data.</div>}
            {rows.map((r, idx) => {
              const amountVal = Number(r.amount ?? 0);
              return (
              <div key={idx} className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <div className="font-semibold">{r.section}</div>
                <div>{amountVal.toLocaleString()}</div>
              </div>
            );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
