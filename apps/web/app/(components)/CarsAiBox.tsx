"use client";

import React, { useEffect, useState } from "react";

type Totals = {
  cars: number;
  active: number;
  archived: number;
  carsWithCustomers: number;
  carsWithoutCustomers: number;
  linkedCustomers: number;
  avgCustomersPerCar: number;
};

export function CarsAiBox({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [appreciation, setAppreciation] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/cars/ai-summary`);
        if (!res.ok) throw new Error("AI unavailable");
        const json = await res.json();
        if (!cancelled) {
          setActions(Array.isArray(json.suggestions) ? json.suggestions : []);
          setAppreciation(json.appreciation ?? null);
          setTotals(json.totals ?? null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "AI unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const avg = totals ? Number(totals.avgCustomersPerCar ?? 0).toFixed(2) : "0.00";

  return (
    <div className="space-y-3">
      {totals && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-xs sm:text-sm">
          <Kpi label="Cars" value={totals.cars} />
          <Kpi label="Active" value={totals.active} />
          <Kpi label="Archived" value={totals.archived} />
          <Kpi label="Cars with customers" value={totals.carsWithCustomers} />
          <Kpi label="Cars without customers" value={totals.carsWithoutCustomers} />
          <Kpi label="Avg customers / car" value={avg} />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border p-3">
          <div className="text-sm font-semibold">AI suggestions</div>
          {loading && <div className="text-sm text-muted-foreground">Thinking...</div>}
          {error && <div className="text-sm text-destructive">{error}</div>}
          {!loading && !error && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {actions.length === 0 && <li>No suggestions yet.</li>}
              {actions.map((s, idx) => (
                <li key={`ai-s-${idx}`}>{s}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border p-3">
          <div className="text-sm font-semibold">AI appreciation</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {loading ? "Thinking..." : appreciation ?? "No notes yet."}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
