"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppLayout, Card, useTheme, useI18n } from "@repo/ui";
import { DashboardSummary } from "../../../(components)/call-center-dashboard/DashboardSummary";
import { DashboardTable } from "../../../(components)/call-center-dashboard/DashboardTable";
import { formatDateInput, formatHms, formatMmSs, lastNDaysRange } from "../../../(components)/call-center-dashboard/helpers";

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

export default function GlobalCallCenterDashboardPage() {
  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}

function DashboardContent() {
  const defaultRange = lastNDaysRange(7);
  const [from, setFrom] = useState<string>(formatDateInput(defaultRange.from));
  const [to, setTo] = useState<string>(formatDateInput(defaultRange.to));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const { t } = useI18n();

  const fetchData = useMemo(
    () => async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/global/call-center/dashboard?from=${from}&to=${to}`);
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
    [from, to]
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
      <div className="space-y-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-semibold">{t("call.dashboard.title")}</h1>
          <button
            onClick={fetchData}
            className={`text-sm text-white rounded-md px-3 py-2 disabled:opacity-60 bg-gradient-to-r ${theme.accent}`}
            disabled={loading}
          >
            {t("call.dashboard.refresh")}
          </button>
        </div>

        <Card>
          <div className="space-y-3">
            <h2 className="font-semibold">{t("call.dashboard.dateRange")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <label className="text-sm space-y-1">
                <span className="block">{t("call.dashboard.from")}</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className={`${theme.input}`}
                />
              </label>
              <label className="text-sm space-y-1">
                <span className="block">{t("call.dashboard.to")}</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className={`${theme.input}`}
                />
              </label>
              <button
                onClick={fetchData}
                className={`inline-flex justify-center rounded-md px-4 py-2 text-sm text-white disabled:opacity-60 bg-gradient-to-r ${theme.accent}`}
                disabled={loading}
              >
                {t("call.dashboard.apply")}
              </button>
            </div>
            {error && <div className="text-sm text-destructive">{error ?? t("call.dashboard.error")}</div>}
          </div>
        </Card>

        <DashboardSummary {...summary} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DashboardTable
            title={t("call.dashboard.byStatus")}
            headers={[t("call.dashboard.byStatus"), "Count"]}
            rows={(data?.byStatus ?? []).map((s) => ({ label: s.status, count: s.count }))}
          />
          <DashboardTable
            title={t("call.dashboard.byDirection")}
            headers={[t("call.dashboard.byDirection"), "Count"]}
            rows={(data?.byDirection ?? []).map((s) => ({ label: s.direction, count: s.count }))}
          />
        </div>

        <DashboardTable
          title={t("call.dashboard.byUser")}
          headers={["User Id", "Calls", "Total Duration"]}
          rows={(data?.byUser ?? []).map((u) => ({
            label: u.createdByUserId,
            count: u.callCount,
            extra: formatHms(u.totalDurationSeconds),
          }))}
        />

        <DashboardTable
          title={t("call.dashboard.byDay")}
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
