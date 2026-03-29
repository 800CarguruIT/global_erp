"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@repo/ui";
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

function badgeStyle(badge: string): { border: string; bg: string; text: string; dot: string } {
  switch (badge) {
    case "Excellent":
      return { border: "border-emerald-500/30", bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" };
    case "Good":
      return { border: "border-cyan-500/30", bg: "bg-cyan-500/10", text: "text-cyan-400", dot: "bg-cyan-400" };
    case "Average":
      return { border: "border-amber-500/30", bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" };
    default:
      return { border: "border-rose-500/30", bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" };
  }
}

function scoreBarWidth(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`;
}

function scoreBarColor(score: number, t: E8Thresholds): string {
  if (score >= t.badge_excellent_min) return "bg-emerald-500";
  if (score >= t.badge_good_min) return "bg-cyan-500";
  if (score >= t.badge_average_min) return "bg-amber-500";
  return "bg-rose-500";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CallCenterPerformancePage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [userResolved, setUserResolved] = useState(false);
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<E8Thresholds>(DEFAULT_THRESHOLDS);
  const [showAI, setShowAI] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 16));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setUserId(json?.userId ?? null);
        }
      } catch { /* ignore */ }
      if (!cancelled) setUserResolved(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchData = useCallback(async () => {
    if (!userResolved) return;
    setLoading(true);
    const headers: HeadersInit = {};
    if (userId) headers["x-user-id"] = userId;
    try {
      const [summaryRes, configRes] = await Promise.all([
        fetch(`/api/company/${companyId}/call-center/agent-summary?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`),
        fetch(`/api/company/${companyId}/intelligence/config`, { headers }),
      ]);
      if (summaryRes.ok) setData(await summaryRes.json());
      if (configRes.ok) {
        const configData = await configRes.json();
        const e8Config = configData.configs?.find((c: { engine_key: string }) => c.engine_key === "e8");
        if (e8Config?.thresholds) setThresholds({ ...DEFAULT_THRESHOLDS, ...e8Config.thresholds });
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [companyId, fromDate, toDate, userId, userResolved]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setFromDate(d.toISOString().slice(0, 16));
    setToDate(new Date().toISOString().slice(0, 16));
  };

  const t = thresholds;
  const totals = data?.totals;
  const yesterday = data?.yesterday;
  const agentCount = data?.agents.length ?? 0;

  return (
    <AppLayout>
      <div className={`p-4 md:p-6 transition-all duration-300 ${showAI ? "xl:pr-[440px]" : ""}`}>
        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Call Center Performance</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {agentCount > 0 ? `${agentCount} agents` : "Agent performance summary"} &middot; AI-powered insights
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-blue-500/50 focus:outline-none"
            />
            <span className="text-zinc-600 text-xs">to</span>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-blue-500/50 focus:outline-none"
            />
            <button onClick={resetToToday} className="rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:border-zinc-600 transition">
              Today
            </button>
            <button onClick={fetchData} className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition">
              Refresh
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                showAI
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-400"
                  : "border-zinc-700/50 bg-zinc-900/80 text-zinc-400 hover:text-purple-400 hover:border-purple-500/30"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              AI Insights
            </button>
          </div>
        </div>

        {/* ── Main layout: content + AI sidebar ── */}
        <div className={`flex gap-5 ${showAI ? "" : ""}`}>
          {/* Left: KPIs + Table */}
          <div className="space-y-5 min-w-0 w-full">

        {/* ── KPI Cards ── */}
        {totals && yesterday && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              label="Total Calls"
              value={String(totals.totalCalls)}
              icon="phone"
              delta={deltaPct(totals.totalCalls, yesterday.totalCalls)}
            />
            <KpiCard
              label="Answer Rate"
              value={`${totals.heldRatePct}%`}
              icon="check"
              valueClass={heldRateColor(totals.heldRatePct, t)}
              delta={deltaPct(totals.heldRatePct, yesterday.heldRatePct)}
            />
            <KpiCard
              label="Avg Duration"
              value={formatDuration(totals.avgDurationSeconds)}
              icon="clock"
              delta={deltaPct(totals.avgDurationSeconds, yesterday.avgDurationSeconds)}
            />
            <KpiCard
              label="Collection"
              value={formatCurrency(totals.totalCollection)}
              icon="currency"
              delta={deltaPct(totals.totalCollection, yesterday.totalCollection)}
            />
            <KpiCard
              label="Appointments"
              value={String(totals.totalAppts)}
              icon="calendar"
              delta={deltaPct(totals.totalAppts, yesterday.totalAppts)}
            />
            <KpiCard
              label="CHSC Conv."
              value={`${totals.chscConversionPct}%`}
              icon="target"
              valueClass={totals.chscConversionPct >= t.target_chsc_loyalty_pct ? "text-emerald-400" : "text-amber-400"}
              subLabel={`Target: ${t.target_chsc_loyalty_pct}%`}
            />
          </div>
        )}

        {/* ── Agent Table ── */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-200">Agent Rankings</h2>
            <span className="text-xs text-zinc-500">
              Sorted by performance score
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/40 text-[11px] uppercase tracking-wider text-zinc-600">
                  <th className="px-3 py-2.5 text-left w-8">#</th>
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-center">Score</th>
                  <th className="px-3 py-2.5 text-right">Calls</th>
                  <th className="px-3 py-2.5 text-right">Held</th>
                  <th className="px-3 py-2.5 text-right">Held%</th>
                  <th className="px-3 py-2.5 text-right">Miss%</th>
                  <th className="px-3 py-2.5 text-right">Avg Dur</th>
                  <th className="px-3 py-2.5 text-right">CHSC Sold</th>
                  <th className="px-3 py-2.5 text-right">CHSC In</th>
                  <th className="px-3 py-2.5 text-right">Conv%</th>
                  <th className="px-3 py-2.5 text-right">Non-CHSC</th>
                  <th className="px-3 py-2.5 text-right">Appt Today</th>
                  <th className="px-3 py-2.5 text-right">Appt Tmrw</th>
                  <th className="px-3 py-2.5 text-right">Collection</th>
                  <th className="px-3 py-2.5 text-right">Rev/Call</th>
                  <th className="px-3 py-2.5 text-left">Badge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {loading && (
                  <tr><td colSpan={17} className="px-4 py-10 text-center text-zinc-600">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
                      Loading performance data...
                    </div>
                  </td></tr>
                )}
                {!loading && (!data || agentCount === 0) && (
                  <tr><td colSpan={17} className="px-4 py-10 text-center text-zinc-600">No agent data for selected period</td></tr>
                )}
                {data?.agents.map((agent, idx) => {
                  const bs = badgeStyle(agent.performanceBadge);
                  return (
                    <tr key={agent.userId} className="group hover:bg-zinc-800/20 transition-colors">
                      <td className="px-3 py-2.5 text-zinc-600 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-zinc-200 group-hover:text-white transition-colors">{agent.agentName || "Unknown"}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${scoreBarColor(agent.performanceScore, t)}`}
                              style={{ width: scoreBarWidth(agent.performanceScore) }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400 font-mono w-7 text-right">{agent.performanceScore}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono">{agent.totalCalls}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono">{agent.heldCalls}</td>
                      <td className={`px-3 py-2.5 text-right font-mono font-medium ${agent.totalCalls > 0 ? heldRateColor(agent.heldRatePct, t) : "text-zinc-700"}`}>
                        {agent.totalCalls > 0 ? `${agent.heldRatePct}%` : "-"}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono ${agent.totalCalls > 0 ? missRateColor(agent.missRatePct, t) : "text-zinc-700"}`}>
                        {agent.totalCalls > 0 ? `${agent.missRatePct}%` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-400 font-mono">
                        {agent.heldCalls > 0 ? formatDuration(agent.avgDurationSeconds) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono">{agent.chscSold}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono">{agent.chscCarIn}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-300">
                        {agent.chscCarIn > 0 ? `${agent.chscConversionPct}%` : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-zinc-400 font-mono">{agent.nonChscCarIn}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono">{agent.todayAppts}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-400 font-mono">{agent.tomorrowAppts}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-300 font-mono text-xs">{formatCurrency(agent.totalCollection)}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-400 font-mono text-xs">{formatCurrency(agent.revenuePerCall)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${bs.border} ${bs.bg} ${bs.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${bs.dot}`} />
                          {agent.performanceBadge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

          </div>

          {/* Right: AI Sidebar — fixed to viewport on desktop */}
          {showAI && (
            <div className="hidden xl:block fixed top-[100px] right-0 h-[calc(100vh-100px)] w-[420px] z-30 border-l border-purple-500/10 bg-zinc-950/98 backdrop-blur-xl shadow-2xl shadow-purple-950/20 rounded-tl-xl">
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/5 to-transparent border-b border-zinc-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                    <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">AI Insights</div>
                    <div className="text-[10px] text-zinc-500">Call Center Performance Engine</div>
                  </div>
                </div>
                <button onClick={() => setShowAI(false)} className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* Sidebar content — force single column for signal cards */}
              <div className="overflow-y-auto h-[calc(100vh-100px-57px)] px-3 py-3 ai-sidebar-panel [&_.grid]:!grid-cols-1 [&_.sm\:grid-cols-2]:!grid-cols-1">
                <AIPanel companyId={companyId} engines={["e8"] as any} from={new Date(fromDate)} to={new Date(toDate)} />
              </div>
            </div>
          )}

          {/* AI Sidebar mobile/tablet: bottom sheet */}
          {showAI && (
            <div className="xl:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAI(false)}>
              <div
                className="w-full max-h-[85vh] rounded-t-2xl border-t border-purple-500/20 bg-zinc-950 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/5 to-transparent border-b border-zinc-800/40">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                      <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                    </div>
                    <div className="text-sm font-semibold text-zinc-100">AI Insights</div>
                  </div>
                  <button onClick={() => setShowAI(false)} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-3 overflow-y-auto max-h-[calc(85vh-56px)] [&_.grid]:!grid-cols-1 [&_.sm\:grid-cols-2]:!grid-cols-1">
                  <AIPanel companyId={companyId} engines={["e8"] as any} from={new Date(fromDate)} to={new Date(toDate)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

const ICONS: Record<string, JSX.Element> = {
  phone: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  check: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  clock: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  currency: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  calendar: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  target: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
};

function KpiCard({
  label,
  value,
  icon,
  valueClass = "text-white",
  delta,
  subLabel,
}: {
  label: string;
  value: string;
  icon: string;
  valueClass?: string;
  delta?: string | null;
  subLabel?: string;
}) {
  const isPositive = delta?.startsWith("+");
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-3.5 hover:border-zinc-700/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-zinc-600">{ICONS[icon]}</span>
        <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="mt-1 flex items-center gap-1.5">
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            <svg className={`h-3 w-3 ${isPositive ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {delta}
          </span>
        )}
        {subLabel && <span className="text-[11px] text-zinc-600">{subLabel}</span>}
      </div>
    </div>
  );
}
