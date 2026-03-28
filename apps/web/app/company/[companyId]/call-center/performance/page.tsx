"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AIPanel } from "@/app/(components)/intelligence/AIPanel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentRow {
  userId: string;
  agentName: string;
  totalCalls: number;
  heldCalls: number;
  heldRatePct: number;
  missRatePct: number;
  avgDurationSeconds: number;
  chscSold: number;
  chscCarIn: number;
  chscConversionPct: number;
  nonChscCarIn: number;
  todayAppts: number;
  tomorrowAppts: number;
  totalCollection: number;
  revenuePerCall: number;
  performanceScore: number;
  performanceBadge: string;
}

interface Totals {
  totalCalls: number;
  heldCalls: number;
  heldRatePct: number;
  avgDurationSeconds: number;
  totalCollection: number;
  totalAppts: number;
  chscConversionPct: number;
}

interface SummaryData {
  from: string;
  to: string;
  agents: AgentRow[];
  totals: Totals;
  yesterday: Totals;
}

interface E8Thresholds {
  badge_excellent_min: number;
  badge_good_min: number;
  badge_average_min: number;
  held_rate_green_min: number;
  held_rate_amber_min: number;
  target_chsc_loyalty_pct: number;
}

const DEFAULT_THRESHOLDS: E8Thresholds = {
  badge_excellent_min: 85,
  badge_good_min: 70,
  badge_average_min: 50,
  held_rate_green_min: 80,
  held_rate_amber_min: 50,
  target_chsc_loyalty_pct: 40,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(amount);
}

function deltaPct(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "+100%" : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function heldRateColor(pct: number, t: E8Thresholds): string {
  if (pct >= t.held_rate_green_min) return "text-emerald-400";
  if (pct >= t.held_rate_amber_min) return "text-amber-400";
  return "text-red-400";
}

function missRateColor(pct: number, t: E8Thresholds): string {
  const heldPct = 100 - pct;
  if (heldPct >= t.held_rate_green_min) return "text-emerald-400";
  if (heldPct >= t.held_rate_amber_min) return "text-amber-400";
  return "text-red-400";
}

function badgeClasses(badge: string): string {
  switch (badge) {
    case "Excellent":
      return "border-emerald-700/60 bg-emerald-950/40 text-emerald-300";
    case "Good":
      return "border-cyan-700/60 bg-cyan-950/40 text-cyan-300";
    case "Average":
      return "border-amber-700/60 bg-amber-950/40 text-amber-300";
    default:
      return "border-rose-700/60 bg-rose-950/40 text-rose-300";
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CallCenterPerformancePage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<E8Thresholds>(DEFAULT_THRESHOLDS);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 16));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, configRes] = await Promise.all([
        fetch(`/api/company/${companyId}/call-center/agent-summary?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`),
        fetch(`/api/company/${companyId}/intelligence/config`),
      ]);
      if (summaryRes.ok) setData(await summaryRes.json());

      if (configRes.ok) {
        const configData = await configRes.json();
        const e8Config = configData.configs?.find((c: { engine_key: string }) => c.engine_key === "e8");
        if (e8Config?.thresholds) {
          setThresholds({ ...DEFAULT_THRESHOLDS, ...e8Config.thresholds });
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [companyId, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const t = thresholds;
  const totals = data?.totals;
  const yesterday = data?.yesterday;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Call Center Performance</h1>
          <p className="text-sm text-zinc-400">Agent performance summary with AI insights</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300"
          />
          <span className="text-zinc-500">to</span>
          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-300"
          />
          <button onClick={fetchData} className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500">
            Refresh
          </button>
        </div>
      </div>

      {/* AI Panel */}
      <AIPanel companyId={companyId} engines={["e8"] as any} from={new Date(fromDate)} to={new Date(toDate)} />

      {/* KPI Cards */}
      {totals && yesterday && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {/* Total Calls */}
          <KpiCard
            label="Total Calls"
            value={String(totals.totalCalls)}
            delta={deltaPct(totals.totalCalls, yesterday.totalCalls)}
          />
          {/* Answer Rate */}
          <KpiCard
            label="Answer Rate"
            value={`${totals.heldRatePct}%`}
            valueClass={heldRateColor(totals.heldRatePct, t)}
            delta={deltaPct(totals.heldRatePct, yesterday.heldRatePct)}
          />
          {/* Avg Duration */}
          <KpiCard
            label="Avg Call Duration"
            value={formatDuration(totals.avgDurationSeconds)}
            delta={deltaPct(totals.avgDurationSeconds, yesterday.avgDurationSeconds)}
          />
          {/* Total Collection */}
          <KpiCard
            label="Total Collection"
            value={formatCurrency(totals.totalCollection)}
            delta={deltaPct(totals.totalCollection, yesterday.totalCollection)}
          />
          {/* Appointments */}
          <KpiCard
            label="Appointments"
            value={String(totals.totalAppts)}
            delta={deltaPct(totals.totalAppts, yesterday.totalAppts)}
          />
          {/* CHSC Conversion */}
          <KpiCard
            label="CHSC Conversion"
            value={`${totals.chscConversionPct}%`}
            valueClass={totals.chscConversionPct >= t.target_chsc_loyalty_pct ? "text-emerald-400" : "text-amber-400"}
            subLabel={`Target: ${t.target_chsc_loyalty_pct}%`}
          />
        </div>
      )}

      {/* Agent Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-sm text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs uppercase text-zinc-500">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2 text-right">Calls</th>
              <th className="px-3 py-2 text-right">Held</th>
              <th className="px-3 py-2 text-right">Held%</th>
              <th className="px-3 py-2 text-right">Miss%</th>
              <th className="px-3 py-2 text-right">Avg Dur</th>
              <th className="px-3 py-2 text-right">CHSC Sold</th>
              <th className="px-3 py-2 text-right">CHSC In</th>
              <th className="px-3 py-2 text-right">CHSC%</th>
              <th className="px-3 py-2 text-right">Non-CHSC</th>
              <th className="px-3 py-2 text-right">Today Appt</th>
              <th className="px-3 py-2 text-right">Tmrw Appt</th>
              <th className="px-3 py-2 text-right">Collection</th>
              <th className="px-3 py-2 text-right">Rev/Call</th>
              <th className="px-3 py-2">Badge</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-zinc-500">Loading...</td></tr>
            )}
            {!loading && (!data || data.agents.length === 0) && (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-zinc-500">No data for selected period</td></tr>
            )}
            {data?.agents.map((agent, idx) => (
              <tr key={agent.userId} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                <td className="px-3 py-2 font-medium text-white">{agent.agentName}</td>
                <td className="px-3 py-2 text-right">{agent.totalCalls}</td>
                <td className="px-3 py-2 text-right">{agent.heldCalls}</td>
                <td className={`px-3 py-2 text-right font-medium ${agent.totalCalls > 0 ? heldRateColor(agent.heldRatePct, t) : "text-zinc-600"}`}>
                  {agent.totalCalls > 0 ? `${agent.heldRatePct}%` : "-"}
                </td>
                <td className={`px-3 py-2 text-right ${agent.totalCalls > 0 ? missRateColor(agent.missRatePct, t) : "text-zinc-600"}`}>
                  {agent.totalCalls > 0 ? `${agent.missRatePct}%` : "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  {agent.heldCalls > 0 ? formatDuration(agent.avgDurationSeconds) : "-"}
                </td>
                <td className="px-3 py-2 text-right">{agent.chscSold}</td>
                <td className="px-3 py-2 text-right">{agent.chscCarIn}</td>
                <td className="px-3 py-2 text-right">
                  {agent.chscCarIn > 0 ? `${agent.chscConversionPct}%` : "-"}
                </td>
                <td className="px-3 py-2 text-right">{agent.nonChscCarIn}</td>
                <td className="px-3 py-2 text-right">{agent.todayAppts}</td>
                <td className="px-3 py-2 text-right">{agent.tomorrowAppts}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(agent.totalCollection)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(agent.revenuePerCall)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${badgeClasses(agent.performanceBadge)}`}>
                    {agent.performanceBadge}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── KPI Card Component ──────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  valueClass = "text-white",
  delta,
  subLabel,
}: {
  label: string;
  value: string;
  valueClass?: string;
  delta?: string | null;
  subLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</div>
      {delta && (
        <div className={`mt-1 text-xs ${delta.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
          {delta} vs yesterday
        </div>
      )}
      {subLabel && <div className="mt-1 text-xs text-zinc-500">{subLabel}</div>}
    </div>
  );
}
