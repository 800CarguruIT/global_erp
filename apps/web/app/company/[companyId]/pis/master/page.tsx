"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useRef } from "react";

interface KpiItem { key: string; label: string; value: string | number; subtitle: string; trend: string; color: string; }
interface FocBanner { focRate: number; focCount: number; totalCars: number; estimatedLoss: number; }
interface FunnelStage { stage: number; label: string; count: number; conversionPct: number; avgLag: string; slaTarget: string; slaStatus: string; }
interface Advisor { advisorUserId: string; advisorName: string; compositeScore: number; paidPct: number; focPct: number; tier: string; revenue: number; rank: number; }
interface SlaItem { key: string; label: string; target: string; actual: string; status: string; sourceEngine: string; }

const PRESETS: { label: string; days: number | null }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "YTD", days: -1 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: null },
];

function getPresetDates(days: number | null): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  if (days === null) return { from: "2020-01-01", to };
  if (days === -1) return { from: `${new Date().getFullYear()}-01-01`, to };
  const fromDate = new Date(Date.now() - days * 86400000);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export default function PisMasterPage() {
  const { companyId } = useParams();
  const [data, setData] = useState<{ kpis: KpiItem[]; focBanner: FocBanner | null; funnel: FunnelStage[]; leaderboard: Advisor[]; slaItems: SlaItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("ALL");
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [showAi, setShowAi] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/company/${companyId}/pis/master?from=${from}&to=${to}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (d.kpis) setData(d); else throw new Error(d.error || "Bad response"); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId, from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyPreset = (label: string, days: number | null) => {
    setActivePreset(label);
    const d = getPresetDates(days);
    setFrom(d.from);
    setTo(d.to);
  };

  const trendIcon = (t: string) => t === "up" ? "▲" : t === "down" ? "▼" : "—";
  const trendColor = (t: string) => t === "up" ? "text-emerald-400" : t === "down" ? "text-red-400" : "text-slate-500";

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className={`flex-1 min-w-0 space-y-5 ${showAi ? "max-w-[calc(100%-340px)]" : ""}`}>

        {/* Filter Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p.label, p.days)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${activePreset === p.label ? "bg-amber-500/20 text-amber-400" : "bg-slate-800/60 text-slate-500 hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActivePreset(""); }}
              className="rounded bg-slate-800/60 border border-border px-2 py-1 text-[11px] text-foreground focus:border-amber-500/50 focus:outline-none" />
            <span className="text-slate-600 text-[10px]">—</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setActivePreset(""); }}
              className="rounded bg-slate-800/60 border border-border px-2 py-1 text-[11px] text-foreground focus:border-amber-500/50 focus:outline-none" />
            <button onClick={() => setShowAi(!showAi)}
              className={`ml-1 rounded px-2.5 py-1 text-[10px] font-bold ${showAi ? "bg-purple-500/20 text-purple-400" : "bg-slate-800/60 text-slate-500 hover:text-purple-400"}`}>
              AI
            </button>
          </div>
        </div>

        {loading ? <div className="text-slate-400 py-12 text-center">Loading...</div> : !data?.kpis ? <div className="text-red-400 py-12 text-center">Failed to load</div> : (
        <>
          {/* FOC Banner */}
          {data.focBanner && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-2.5 flex items-center gap-3">
              <span className="text-red-400">⚠</span>
              <span className="text-[11px] font-semibold text-red-300">
                CRITICAL: FOC rate {data.focBanner.focRate.toFixed(1)}% — {data.focBanner.focCount.toLocaleString()} of {data.focBanner.totalCars.toLocaleString()} cars zero revenue. Est. AED {Math.round(data.focBanner.estimatedLoss / 1000).toLocaleString()}K loss.
              </span>
            </div>
          )}

          {/* 8 KPI Cards */}
          <div className="grid grid-cols-4 xl:grid-cols-8 gap-2.5">
            {data.kpis.map(kpi => (
              <div key={kpi.key} className="rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{kpi.label}</span>
                  <span className={`text-[9px] ${trendColor(kpi.trend)}`}>{trendIcon(kpi.trend)}</span>
                </div>
                <div className={`text-lg font-bold leading-tight ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[9px] text-slate-600 mt-0.5 truncate">{kpi.subtitle}</div>
              </div>
            ))}
          </div>

          {/* Funnel + Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 9-Stage Funnel */}
            <div className="rounded-lg border border-border/60 bg-card/60 p-4">
              <h2 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">9-Stage Funnel</h2>
              <div className="space-y-2">
                {data.funnel.map(s => (
                  <div key={s.stage} className="flex items-center gap-2.5">
                    <span className="w-4 h-4 rounded-full bg-slate-800 text-[8px] font-bold text-amber-400 flex items-center justify-center shrink-0">{s.stage}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground leading-tight">{s.label}</div>
                    </div>
                    <div className="w-20 shrink-0">
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${s.slaStatus === "ON_TRACK" ? "bg-emerald-500" : s.slaStatus === "WARNING" ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(s.conversionPct, 100)}%` }} />
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-300 w-12 text-right shrink-0">{s.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Advisor Leaderboard */}
            <div className="rounded-lg border border-border/60 bg-card/60 p-4">
              <h2 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">
                Advisor Leaderboard <span className="text-slate-600 font-normal ml-1">{data.leaderboard.length}</span>
              </h2>
              <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
                {data.leaderboard.map((adv, i) => (
                  <div key={adv.advisorUserId} className="flex items-center gap-2 py-1 hover:bg-card/30 rounded px-1 -mx-1">
                    <span className="w-4 text-[10px] font-bold text-slate-600 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground truncate leading-tight">{adv.advisorName}</div>
                      <div className="text-[9px] text-slate-600">{adv.paidPct.toFixed(0)}% paid · {adv.focPct.toFixed(1)}% FOC</div>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 ${adv.tier === "ELITE" ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-500"}`}>{adv.tier}</span>
                    <span className="text-[11px] font-semibold text-emerald-400 w-14 text-right shrink-0">AED {Math.round(adv.revenue / 1000)}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SLA Compliance */}
          <div className="rounded-lg border border-border/60 bg-card/60 p-4">
            <h2 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">
              SLA Compliance <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] text-slate-500 font-normal">{data.slaItems.length}</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
              {data.slaItems.map(sla => (
                <div key={sla.key} className="rounded border border-border bg-background/40 p-2.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold mb-1.5 ${sla.status === "ON_TRACK" ? "bg-emerald-500/15 text-emerald-400" : sla.status === "WARNING" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
                    {sla.status === "ON_TRACK" ? "OK" : sla.status}
                  </span>
                  <div className="text-[10px] font-medium text-foreground leading-tight mb-0.5">{sla.label}</div>
                  <div className="text-[9px] text-slate-600">{sla.target}{sla.actual !== "N/A" ? ` · ${sla.actual}` : ""}</div>
                </div>
              ))}
            </div>
          </div>
        </>
        )}
      </div>

      {/* AI Intelligence Sidebar */}
      {showAi && companyId && (
        <div className="w-[300px] shrink-0 hidden xl:block">
          <div className="sticky top-4">
            <AISidebar companyId={companyId as string} onClose={() => setShowAi(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Compact AI Sidebar ── */
interface AISidebarProps { companyId: string; onClose: () => void; }
interface SidebarSignal { type: string; urgency: string; metric: string; observation: string; diagnosis: string; action: string; owner_role: string; confidence: number; respond_by_hours: number; engine_key?: string; }

function AISidebar({ companyId, onClose }: AISidebarProps) {
  const [signals, setSignals] = useState<SidebarSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"diagnostic" | "predictive" | "prescriptive">("diagnostic");

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const me = meRes.ok ? await meRes.json() : {};
        const headers: Record<string, string> = {};
        if (me?.userId) headers["x-user-id"] = me.userId;
        const r = await fetch(`/api/company/${companyId}/intelligence/signals?engines=e1,e2,e3,e5`, { headers });
        if (r.ok) {
          const json = await r.json();
          const all = (json.engines ?? []).flatMap((e: any) => (e.signals ?? []).map((s: any) => ({ ...s, engine_key: e.engine_key })));
          setSignals(all);
        }
      } catch {}
      setLoading(false);
    })();
  }, [companyId]);

  const filtered = signals.filter(s => s.type === tab);
  const highCount = signals.filter(s => s.urgency === "HIGH").length;

  const urgColor = (u: string) => u === "HIGH" ? "bg-red-500/15 text-red-400" : u === "MED" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400";

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">AI Intelligence</span>
          {highCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400">{highCount} HIGH</span>}
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-foreground text-[11px]">✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        {(["diagnostic", "predictive", "prescriptive"] as const).map(t => {
          const count = signals.filter(s => s.type === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 px-2 py-2 text-[10px] font-semibold capitalize border-b-2 transition ${tab === t ? "border-purple-500 text-purple-400" : "border-transparent text-slate-600 hover:text-slate-400"}`}>
              {t.slice(0, 4)}.
              {count > 0 && <span className="ml-1 text-[9px] opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Signals */}
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-slate-800/50 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-600">No {tab} signals</div>
        ) : (
          <div className="p-2 space-y-2">
            {filtered.map((s, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/40 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${urgColor(s.urgency)}`}>{s.urgency}</span>
                  <span className="text-[8px] text-slate-600 uppercase">{s.engine_key}</span>
                  <span className="ml-auto text-[8px] text-slate-700">{Math.round(s.confidence * 100)}%</span>
                </div>
                <div className="text-[10px] font-medium text-foreground leading-snug">{s.observation}</div>
                {s.diagnosis && <div className="text-[9px] text-slate-500 leading-snug">{s.diagnosis}</div>}
                {s.action && (
                  <div className="rounded bg-purple-500/10 px-2 py-1.5">
                    <div className="text-[9px] text-purple-300 leading-snug">{s.action}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[8px] text-slate-700">
                  {s.owner_role && <span>{s.owner_role}</span>}
                  <span>{s.respond_by_hours}h</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/60 text-[9px] text-slate-700 text-center">
        {signals.length} signals · {loading ? "Analysing..." : "Updated just now"}
      </div>
    </div>
  );
}
