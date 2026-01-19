"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { DashboardSummary } from "../../../../(components)/call-center-dashboard/DashboardSummary";
import { DashboardTable } from "../../../../(components)/call-center-dashboard/DashboardTable";
import {
  formatDateInput,
  formatHms,
  formatMmSs,
  lastNDaysRange,
} from "../../../../(components)/call-center-dashboard/helpers";

type DashboardData = {
  period: { from: string; to: string };
  totals: {
    totalCalls: number;
    totalDurationSeconds: number;
    completedCalls: number;
    failedCalls: number;
    averageDurationSeconds: number | null;
  };
  byStatus: { status: string; count: number }[];
  byDirection: { direction: string; count: number }[];
  byUser: { createdByUserId: string; callCount: number; totalDurationSeconds: number }[];
  byDay: { date: string; callCount: number; totalDurationSeconds: number }[];
};

export default function CompanyCallCenterDashboardPage({ params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const defaultRange = lastNDaysRange(7);
  const [from, setFrom] = useState<string>(formatDateInput(defaultRange.from));
  const [to, setTo] = useState<string>(formatDateInput(defaultRange.to));
  const [branchId, setBranchId] = useState<string>("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useMemo(
    () => async () => {
      setError(null);
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("from", from);
        qs.set("to", to);
        if (branchId) qs.set("branchId", branchId);
        const res = await fetch(
          `/api/company/${companyId}/call-center/dashboard?${qs.toString()}`
        );
        if (!res.ok) throw new Error("Failed to load dashboard");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    },
    [branchId, companyId, from, to]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const summary = data?.totals ?? {
    totalCalls: 0,
    totalDurationSeconds: 0,
    completedCalls: 0,
    failedCalls: 0,
    averageDurationSeconds: null,
  };

  return (
    <AppLayout>
      <div className="space-y-6 py-4 max-w-6xl mx-auto text-gray-100">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">Company Call Center Dashboard</h1>
          <button
            onClick={fetchData}
            className="text-sm text-blue-400 hover:underline disabled:opacity-60"
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-100">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <label className="text-sm text-gray-300 space-y-1">
              <span className="block">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 focus:outline-none focus:ring focus:ring-blue-500/40"
              />
            </label>
            <label className="text-sm text-gray-300 space-y-1">
              <span className="block">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 focus:outline-none focus:ring focus:ring-blue-500/40"
              />
            </label>
            <label className="text-sm text-gray-300 space-y-1">
              <span className="block">Branch (optional)</span>
              <input
                type="text"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="Branch ID"
                className="border border-slate-700 bg-slate-800 rounded px-3 py-2 text-gray-100 focus:outline-none focus:ring focus:ring-blue-500/40 placeholder:text-gray-400"
              />
            </label>
            <button
              onClick={fetchData}
              className="inline-flex justify-center rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              disabled={loading}
            >
              Apply
            </button>
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
        </div>

        <DashboardSummary {...summary} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardTable
            title="By Status"
            headers={["Status", "Count"]}
            rows={(data?.byStatus ?? []).map((s) => ({ label: s.status, count: s.count }))}
          />
          <DashboardTable
            title="By Direction"
            headers={["Direction", "Count"]}
            rows={(data?.byDirection ?? []).map((s) => ({ label: s.direction, count: s.count }))}
          />
        </div>

        <DashboardTable
          title="By User"
          headers={["User Id", "Calls", "Total Duration"]}
          rows={(data?.byUser ?? []).map((u) => ({
            label: u.createdByUserId,
            count: u.callCount,
            extra: formatHms(u.totalDurationSeconds),
          }))}
        />

        <DashboardTable
          title="By Day"
          headers={["Day", "Calls", "Total Duration"]}
          rows={(data?.byDay ?? []).map((d) => ({
            label: d.date,
            count: d.callCount,
            extra: formatMmSs(d.totalDurationSeconds),
          }))}
        />
      </div>
    </AppLayout>
  );
}

