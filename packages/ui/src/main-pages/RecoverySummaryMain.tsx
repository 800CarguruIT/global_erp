"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RecoveryRequestsTable } from "../components/recovery/RecoveryRequestsTable";
import type { RecoveryRequestRow } from "../components/recovery/RecoveryRequestsTable";
import { MainPageShell } from "./MainPageShell";
import { Card } from "../components/Card";

export type RecoverySummaryMainProps = {
  companyId: string;
};

function formatDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function RecoverySummaryMain({ companyId }: RecoverySummaryMainProps) {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(formatDateInput(today));
  const [to, setTo] = useState(formatDateInput(today));
  const [rows, setRows] = useState<RecoveryRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        includeVerified: "true",
        from,
        to,
      });
      const res = await fetch(`/api/company/${companyId}/recovery-requests?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load recovery summary");
      const data = await res.json();
      setRows(data.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load recovery summary");
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MainPageShell
      title="Recovery Summary"
      subtitle="View recovery requests by date range."
      scopeLabel="Company workspace"
      contentClassName="p-0 bg-transparent"
    >
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        <Card className="border-0 p-4 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">From</label>
                <input
                  type="date"
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">To</label>
                <input
                  type="date"
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </Card>

        {loading && !error ? (
          <p className="text-sm text-muted-foreground">Loading recovery summary...</p>
        ) : (
          <Card className="border-0 p-0 shadow-sm">
            <RecoveryRequestsTable
              companyId={companyId}
              rows={rows}
              onVerified={refresh}
              showVerifiedDetails
            />
          </Card>
        )}
      </div>
    </MainPageShell>
  );
}
