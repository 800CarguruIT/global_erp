"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "@/app/(components)/intelligence/AIPanel";
import type { MasterDashboardData } from "@repo/ai-core";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctChange(current: number, prev: number | null): { sign: string; value: string; up: boolean } | null {
  if (prev === null || prev === 0) return null;
  const change = ((current - prev) / prev) * 100;
  return {
    sign: change >= 0 ? "+" : "",
    value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs prev period`,
    up: change >= 0,
  };
}

function fmtCurrency(val: number): string {
  if (val >= 1_000_000) return `AED ${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `AED ${(val / 1_000).toFixed(1)}K`;
  return `AED ${val.toFixed(0)}`;
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

function lastNDays(n: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - n * 24 * 60 * 60 * 1000);
  return { from, to };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "EXCELLENT" | "GOOD" | "WARNING" | "POOR" }) {
  const styles: Record<string, string> = {
    EXCELLENT: "bg-green-500/20 text-green-400",
    GOOD: "bg-blue-500/20 text-blue-400",
    WARNING: "bg-yellow-500/20 text-yellow-400",
    POOR: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${styles[status] ?? styles.GOOD}`}>
      {status === "EXCELLENT" || status === "GOOD" ? "✓" : "⚠"} {status}
    </span>
  );
}

function kpiStatus(val: number, target: number, higherIsBetter = true): "EXCELLENT" | "GOOD" | "WARNING" | "POOR" {
  const ratio = higherIsBetter ? val / target : target / val;
  if (ratio >= 1.1) return "EXCELLENT";
  if (ratio >= 1.0) return "GOOD";
  if (ratio >= 0.85) return "WARNING";
  return "POOR";
}

function KpiBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-20 h-2 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const allZero = data.every((v) => v === 0);
  if (data.length < 2 || allZero) {
    return (
      <div className="h-10 w-full flex items-center justify-center rounded bg-card/40">
        <span className="text-[10px] text-slate-600">No data for period</span>
      </div>
    );
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300;
  const h = 60;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return { x, y };
  });
  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [
    `0,${h}`,
    ...pts.map((p) => `${p.x},${p.y}`),
    `${w},${h}`,
  ].join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace("#", "")})`} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SectionHeader({ icon, title, subtitle, rightLabel }: { icon: string; title: string; subtitle: string; rightLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <span className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</span>
          <span className="text-xs text-slate-400 ml-2">· {subtitle}</span>
        </div>
      </div>
      {rightLabel && (
        <span className="text-[10px] text-slate-400 border border-border rounded px-2 py-0.5">{rightLabel}</span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MasterDashboardPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(formatDateInput(lastNDays(7).from));
  const [to, setTo] = useState<string>(formatDateInput(lastNDays(7).to));
  const [data, setData] = useState<MasterDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  const fetchData = useMemo(
    () => async (cid: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ from, to });
        const res = await fetch(`/api/company/${cid}/master-dashboard?${qs}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e: any) {
        setError(e.message ?? "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    },
    [from, to]
  );

  useEffect(() => {
    if (companyId) fetchData(companyId);
  }, [companyId, fetchData]);

  const d = data;
  const ib = d?.inbound;
  const ob = d?.outbound;
  const ih = d?.inhouse;
  const rm = d?.remote;
  const pf = d?.portfolio;
  const fn = d?.funnel;
  const kpis = d?.topKpis;

  return (
    <AppLayout>
      <div className={`space-y-5 py-4 transition-all duration-300 ${showAI ? "xl:pr-[440px]" : ""}`}>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground uppercase tracking-wide">Master Performance Dashboard</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-9">All Teams · Daily / Weekly / Monthly · Real-Time Performance Overview</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-border bg-card text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-blue-500"
            />
            <span className="text-slate-500 text-xs">→</span>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-border bg-card text-xs text-slate-300 px-2 py-1.5 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => companyId && fetchData(companyId)}
              disabled={loading}
              className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1.5 text-xs text-white font-medium transition-colors"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 ${
                showAI ? "border-purple-500/50 bg-purple-500/10 text-purple-400" : "border-border bg-card text-slate-400 hover:text-purple-400"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              AI
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            ⚠ {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="ml-3 text-sm text-slate-400">Loading dashboard…</span>
          </div>
        )}

        {/* ── Top 5 KPI Cards ── */}
        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "Total Revenue", value: fmtCurrency(kpis.totalRevenue), icon: "💰",
                color: "bg-green-500/20 border-green-500/30",
                change: pctChange(kpis.totalRevenue, kpis.prevTotalRevenue),
              },
              {
                label: "Total Bookings", value: kpis.totalBookings.toLocaleString(), icon: "✅",
                color: "bg-blue-500/20 border-blue-500/30",
                change: pctChange(kpis.totalBookings, kpis.prevTotalBookings),
              },
              {
                label: "Total Calls Handled", value: kpis.totalCallsHandled.toLocaleString(), icon: "📞",
                color: "bg-purple-500/20 border-purple-500/30",
                change: pctChange(kpis.totalCallsHandled, kpis.prevTotalCalls),
              },
              {
                label: "Show-Up Rate", value: kpis.totalBookings === 0 ? "N/A" : `${kpis.showUpRate.toFixed(1)}%`, icon: "🚗",
                color: "bg-orange-500/20 border-orange-500/30",
                change: null,
              },
              {
                label: "Total Cancellations", value: kpis.totalCancellations.toLocaleString(), icon: "❌",
                color: "bg-red-500/20 border-red-500/30",
                change: null,
              },
            ].map((k) => (
              <div key={k.label} className={`rounded-xl border p-4 ${k.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400">{k.label}</span>
                  <span className="text-lg">{k.icon}</span>
                </div>
                <div className="text-xl font-bold text-foreground">{k.value}</div>
                {k.change && (
                  <div className={`text-[11px] mt-1 ${k.change.up ? "text-green-400" : "text-red-400"}`}>
                    {k.change.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Team Performance Summary + Conversion Funnel ── */}
        {d && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Team Table */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-popover/60 p-4">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-xs font-bold text-foreground uppercase tracking-widest">Team Performance Summary</span>
                <div className="flex gap-4 ml-auto text-center">
                  {[
                    { icon: "📞", label: "INBOUND" },
                    { icon: "📤", label: "OUTBOUND" },
                    { icon: "👥", label: "PORTFOLIO" },
                  ].map((t) => (
                    <div key={t.label}>
                      <div className="text-[10px] font-bold text-slate-300">{t.icon} {t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase border-b border-border/40">
                      <th className="text-left py-2">Team</th>
                      <th className="text-right py-2">Total Calls</th>
                      <th className="text-right py-2">Answer Rate</th>
                      <th className="text-right py-2">Bookings</th>
                      <th className="text-right py-2">Conversion</th>
                      <th className="text-right py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Inhouse Team", desc: `${ih?.agentCount ?? 0} agents · Office-based`, stats: ih?.teamStats, gradeColor: "text-blue-400 bg-blue-500/10" },
                      { name: "Remote Team", desc: `${rm?.agentCount ?? 0} agents · Remote work`, stats: rm?.teamStats, gradeColor: "text-yellow-400 bg-yellow-500/10" },
                      { name: "Portfolio Team", desc: "Account Mgmt · Upsell · Retention", stats: pf?.teamStats, gradeColor: "text-green-400 bg-green-500/10" },
                    ].map((row) => (
                      <tr key={row.name} className="border-b border-border/40 hover:bg-muted/40 transition-colors">
                        <td className="py-3">
                          <div className="font-medium text-slate-200">{row.name}</div>
                          <div className="text-[10px] text-slate-500">{row.desc}</div>
                        </td>
                        <td className="text-right text-slate-200">{(row.stats?.totalCalls ?? 0).toLocaleString()}</td>
                        <td className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-slate-200">{row.stats?.answerRate.toFixed(1)}%</span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                              <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.stats?.answerRate ?? 0}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="text-right text-slate-200">{(row.stats?.bookings ?? 0).toLocaleString()}</td>
                        <td className="text-right text-slate-200">{row.stats?.conversionRate.toFixed(1)}%</td>
                        <td className="text-right">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${row.gradeColor}`}>
                            {row.stats?.grade} {row.stats?.score}/100
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold text-slate-200">
                      <td className="py-2 text-xs">TOTAL</td>
                      <td className="text-right text-xs">{(kpis?.totalCallsHandled ?? 0).toLocaleString()}</td>
                      <td className="text-right text-xs">
                        {fn ? `${pctChange(fn.connected, fn.totalCalls) ? ((fn.connected / (fn.totalCalls || 1)) * 100).toFixed(1) : "—"}%` : "—"}
                      </td>
                      <td className="text-right text-xs">{(kpis?.totalBookings ?? 0).toLocaleString()}</td>
                      <td className="text-right text-xs">{fn ? `${fn.overallConversionRate.toFixed(1)}%` : "—"}</td>
                      <td className="text-right">
                        <span className="text-xs font-bold px-2 py-0.5 rounded text-blue-400 bg-blue-500/10">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conversion Funnel */}
            {fn && (
              <div className="rounded-xl border border-border bg-popover/60 p-4">
                <div className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-4">
                  Conversion Funnel <span className="text-slate-500 font-normal">(All Teams)</span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Leads / Calls", value: fn.totalCalls, pct: null },
                    { label: "Connected", value: fn.connected, pct: fn.totalCalls ? `${((fn.connected / fn.totalCalls) * 100).toFixed(0)}%` : null },
                    { label: "Leads Created", value: fn.leadsCreated, pct: fn.connected ? `${((fn.leadsCreated / fn.connected) * 100).toFixed(0)}%` : null },
                    { label: "Bookings", value: fn.bookings, pct: fn.leadsCreated ? `${((fn.bookings / fn.leadsCreated) * 100).toFixed(0)}%` : null },
                    { label: "Show-Ups", value: fn.showUps, pct: fn.bookings ? `${((fn.showUps / fn.bookings) * 100).toFixed(0)}%` : null },
                    { label: "Revenue", value: null, displayValue: fmtCurrency(fn.revenue), pct: null },
                  ].map((step, i) => {
                    const widths = [100, 80, 62, 52, 44, 36];
                    return (
                      <div key={step.label} className="flex items-center gap-2">
                        <div style={{ width: `${widths[i]}%` }} className="flex-shrink-0">
                          <div className="h-7 rounded bg-blue-600/80 flex items-center px-2">
                            <span className="text-xs font-bold text-foreground">
                              {step.value !== null ? step.value.toLocaleString() : step.displayValue}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-slate-400 leading-tight">{step.label}</div>
                          {step.pct && <div className="text-[10px] text-green-400">{step.pct}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-2 text-center">
                  <span className="text-xs font-bold text-blue-300">
                    FUNNEL CONVERSION: {fn.overallConversionRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Inhouse vs Remote Team Dashboard ── */}
        {(ih || rm) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inhouse */}
            <div className="rounded-xl border border-blue-500/20 bg-popover/60 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏢</span>
                <div>
                  <div className="text-sm font-bold text-foreground">Inhouse Team</div>
                  <div className="text-[10px] text-slate-500">{ih?.agentCount ?? 0} agents</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Calls", value: (ih?.totalCalls ?? 0).toLocaleString() },
                  { label: "Answer Rate", value: `${(ih?.answerRate ?? 0).toFixed(1)}%` },
                  { label: "Avg Duration", value: fmtDuration(ih?.avgHandlingTimeSecs ?? 0) },
                  { label: "Abandonment", value: `${(ih?.abandonmentRate ?? 0).toFixed(1)}%` },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-2.5">
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">{m.label}</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
              {ih && ih.trend.length > 0 && (
                <div className="rounded-lg border border-border/40 bg-card/40 p-2.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Call Trend</div>
                  <SparkLine data={ih.trend.map((t) => t.calls)} color="#60a5fa" />
                  <div className="flex justify-between text-[8px] text-slate-600 mt-1">
                    {ih.trend.map((t) => <span key={t.date}>{t.date.slice(5)}</span>)}
                  </div>
                </div>
              )}
              {ih && (
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { m: "Answer Rate", v: ih.answerRate, t: 80, h: true, c: "bg-blue-500" },
                      { m: "Abandonment", v: ih.abandonmentRate, t: 10, h: false, c: "bg-orange-500" },
                      { m: "Score", v: ih.teamStats.score, t: 70, h: true, c: "bg-green-500" },
                    ].map((k) => (
                      <tr key={k.m} className="border-b border-border/40">
                        <td className="py-1.5"><div className="flex items-center gap-2"><KpiBar pct={Math.min(k.v, 100)} color={k.c} /><span className="text-slate-400">{k.m}</span></div></td>
                        <td className="text-right text-slate-300">{k.v.toFixed(1)}%</td>
                        <td className="text-right"><StatusBadge status={kpiStatus(k.v, k.t, k.h)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Remote */}
            <div className="rounded-xl border border-green-500/20 bg-popover/60 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <div>
                  <div className="text-sm font-bold text-foreground">Remote Team</div>
                  <div className="text-[10px] text-slate-500">{rm?.agentCount ?? 0} agents</div>
                </div>
              </div>
              {(rm?.totalCalls ?? 0) === 0 && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-[11px] text-yellow-300">
                  No remote calls found. Set agents to &quot;remote&quot; in User Extensions.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Calls", value: (rm?.totalCalls ?? 0).toLocaleString() },
                  { label: "Answer Rate", value: `${(rm?.answerRate ?? 0).toFixed(1)}%` },
                  { label: "Avg Duration", value: fmtDuration(rm?.avgHandlingTimeSecs ?? 0) },
                  { label: "Abandonment", value: `${(rm?.abandonmentRate ?? 0).toFixed(1)}%` },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-green-500/10 bg-green-500/5 p-2.5">
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">{m.label}</div>
                    <div className="text-base font-bold text-foreground mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
              {rm && rm.trend.length > 0 && (
                <div className="rounded-lg border border-border/40 bg-card/40 p-2.5">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Call Trend</div>
                  <SparkLine data={rm.trend.map((t) => t.calls)} color="#34d399" />
                  <div className="flex justify-between text-[8px] text-slate-600 mt-1">
                    {rm.trend.map((t) => <span key={t.date}>{t.date.slice(5)}</span>)}
                  </div>
                </div>
              )}
              {rm && (
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { m: "Answer Rate", v: rm.answerRate, t: 80, h: true, c: "bg-blue-500" },
                      { m: "Abandonment", v: rm.abandonmentRate, t: 10, h: false, c: "bg-orange-500" },
                      { m: "Score", v: rm.teamStats.score, t: 70, h: true, c: "bg-green-500" },
                    ].map((k) => (
                      <tr key={k.m} className="border-b border-border/40">
                        <td className="py-1.5"><div className="flex items-center gap-2"><KpiBar pct={Math.min(k.v, 100)} color={k.c} /><span className="text-slate-400">{k.m}</span></div></td>
                        <td className="text-right text-slate-300">{k.v.toFixed(1)}%</td>
                        <td className="text-right"><StatusBadge status={kpiStatus(k.v, k.t, k.h)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Portfolio Team ── */}
        {pf && (
          <div className="rounded-xl border border-purple-500/20 bg-popover/60 p-4">
            <SectionHeader icon="👥" title="Portfolio Team" subtitle="Account Management | Upsell | Retention" rightLabel="Period" />
            {pf.customersManaged === 0 && (
              <div className="mb-4 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2 text-xs text-purple-300 flex items-center gap-2">
                <span>ℹ</span>
                <span>No returning customer activity found for this period. Portfolio metrics require customers with prior history — try extending to 30+ days to capture returning visits.</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {[
                { label: "Active Accounts", value: pf.customersManaged.toLocaleString(), color: "bg-blue-500/20 border-blue-500/30" },
                { label: "Monthly Touchpoints", value: pf.monthlyTouchpoints.toLocaleString(), color: "bg-green-500/20 border-green-500/30" },
                { label: "Return Bookings", value: pf.bookingsCarIn.toLocaleString(), color: "bg-orange-500/20 border-orange-500/30" },
                { label: "Return Revenue", value: fmtCurrency(pf.totalSales), color: "bg-purple-500/20 border-purple-500/30" },
                { label: "Upsell Rate", value: `${pf.upsellRate.toFixed(1)}%`, color: "bg-teal-500/20 border-teal-500/30" },
                { label: "Retention Rate", value: `${pf.retentionRate.toFixed(1)}%`, color: "bg-green-600/20 border-green-600/30" },
              ].map((m) => (
                <div key={m.label} className={`rounded-xl border p-3 ${m.color}`}>
                  <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{m.label}</div>
                  <div className="text-lg font-bold text-foreground">{m.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* KPI table */}
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Portfolio KPIs</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-500 border-b border-border/40">
                      <th className="text-left py-1">Metric</th>
                      <th className="text-right py-1">Value</th>
                      <th className="text-right py-1">Target</th>
                      <th className="text-right py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Return Customer → Booking Rate", val: pf.customerToBookingRate, target: 15, higherBetter: true, barColor: "bg-blue-500" },
                      { metric: "Cross-Sell Rate", val: pf.crossSellRate, target: 20, higherBetter: true, barColor: "bg-green-500" },
                      { metric: "Upsell Rate", val: pf.upsellRate, target: 30, higherBetter: true, barColor: "bg-orange-500" },
                      { metric: "Revenue per Customer", val: pf.revenuePerCustomer, target: 150, higherBetter: true, barColor: "bg-purple-500", isAed: true },
                    ].map((kpi) => (
                      <tr key={kpi.metric} className="border-b border-border/40">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <KpiBar pct={Math.min((kpi.val / (kpi.target * 1.5)) * 100, 100)} color={kpi.barColor} />
                            <span className="text-slate-300">{kpi.metric}</span>
                          </div>
                        </td>
                        <td className="text-right text-slate-200">
                          {(kpi as any).isAed ? `AED ${kpi.val.toFixed(0)}` : `${kpi.val.toFixed(1)}%`}
                        </td>
                        <td className="text-right text-slate-500">
                          {(kpi as any).isAed ? `> AED ${kpi.target}` : `> ${kpi.target}%`}
                        </td>
                        <td className="text-right">
                          <StatusBadge status={kpiStatus(kpi.val, kpi.target, kpi.higherBetter)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Revenue Breakdown */}
              <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Revenue Breakdown</div>
                {pf.revenueBreakdown.length > 0 && pf.totalSales > 0 ? (
                  <>
                    <div className="flex items-center justify-center mb-3">
                      <div className="relative w-28 h-28">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          {(() => {
                            let offset = 0;
                            const colors = ["#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ec4899"];
                            return pf.revenueBreakdown.map((r, i) => {
                              const p = r.pct;
                              const el = (
                                <circle key={i} r="15.9" cx="18" cy="18" fill="none"
                                  stroke={colors[i % colors.length]} strokeWidth="3.5"
                                  strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={-offset}
                                />
                              );
                              offset += p;
                              return el;
                            });
                          })()}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-xs font-bold text-foreground">{fmtCurrency(pf.totalSales)}</div>
                          <div className="text-[9px] text-slate-500">Total Rev</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {pf.revenueBreakdown.map((r, i) => {
                        const colors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500"];
                        return (
                          <div key={r.label} className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                              <span className="text-slate-400">{r.label}</span>
                            </span>
                            <span className="text-slate-300">{fmtCurrency(r.value)} <span className="text-slate-500">({r.pct.toFixed(0)}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 gap-2">
                    <svg viewBox="0 0 36 36" className="w-20 h-20 opacity-20">
                      <circle r="15.9" cx="18" cy="18" fill="none" stroke="#64748b" strokeWidth="3.5" />
                    </svg>
                    <span className="text-[10px] text-slate-600">No return revenue recorded</span>
                  </div>
                )}
              </div>

              {/* Top Performers + Needs Attention */}
              <div className="rounded-xl border border-border/40 bg-card/40 p-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Top Performers (MTD)</div>
                {pf.topPerformers.length === 0 && (
                  <p className="text-[10px] text-slate-500">No agent data for this period.</p>
                )}
                <div className="space-y-2 mb-4">
                  {pf.topPerformers.map((p, i) => (
                    <div key={p.agentId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-400"}`}>
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-xs font-medium text-slate-200">{p.name}</div>
                          <div className="text-[10px] text-slate-500">{p.metricValue} won</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-green-400 font-medium">
                        {p.targetPct > 0 ? `${p.targetPct}% of avg` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
                {pf.needsAttention.length > 0 && (
                  <>
                    <div className="border-t border-border pt-3">
                      <div className="text-[10px] font-bold text-red-400 uppercase mb-2">⚠ Needs Attention</div>
                      {pf.needsAttention.map((a) => (
                        <div key={a.agentId} className="flex items-start gap-2 mb-1">
                          <span className="text-[10px] font-bold text-orange-400 mt-0.5">▲</span>
                          <div>
                            <span className="text-[10px] font-medium text-slate-300">{a.name}</span>
                            <span className="text-[10px] text-slate-500 ml-1">{a.issue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer Targets ── */}
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-300">
            <span className="text-yellow-400 font-bold">🏆 TARGETS:</span>
            <span>Conversion ≥ 70%</span>
            <span>·</span>
            <span>Reschedule ≤ 20%</span>
            <span>·</span>
            <span>Cancellation ≤ 10%</span>
            <span>·</span>
            <span>Answer Rate Inbound ≥ 90%</span>
            <span>·</span>
            <span>Outbound ≥ 30%</span>
          </div>
        </div>

      </div>

      {/* ── AI Intelligence Right Sidebar ── */}
      {showAI && companyId && (
        <div className="hidden xl:block fixed top-[100px] right-0 h-[calc(100vh-100px)] w-[420px] z-30 border-l border-purple-500/10 bg-zinc-950/98 backdrop-blur-xl shadow-2xl shadow-purple-950/20 rounded-tl-xl">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/5 to-transparent border-b border-zinc-800/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15">
                <svg className="h-3.5 w-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-100">AI Intelligence</div>
                <div className="text-[10px] text-zinc-500">Performance + Inhouse vs Remote</div>
              </div>
            </div>
            <button onClick={() => setShowAI(false)} className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto h-[calc(100vh-100px-57px)] px-3 py-3 [&_.grid]:!grid-cols-1 [&_.sm\:grid-cols-2]:!grid-cols-1">
            <AIPanel companyId={companyId} engines={["e8"] as any} from={new Date(from)} to={new Date(to)} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
