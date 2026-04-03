"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

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
  return { from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10), to };
}

export default function PisFunnelPage() {
  const { companyId } = useParams();
  const [funnel, setFunnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("ALL");
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/company/${companyId}/pis/funnel?from=${from}&to=${to}`)
      .then(r => r.json()).then(d => setFunnel(d.funnel ?? [])).catch(console.error).finally(() => setLoading(false));
  }, [companyId, from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyPreset = (label: string, days: number | null) => {
    setActivePreset(label);
    const d = getPresetDates(days);
    setFrom(d.from);
    setTo(d.to);
  };

  const maxCount = Math.max(...funnel.map((f: any) => f.count), 1);
  const totalLeads = funnel[0]?.count ?? 0;

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">9-Stage Mega Funnel</h2>
        <div className="flex items-center gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p.label, p.days)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold ${activePreset === p.label ? "bg-amber-500/20 text-amber-400" : "bg-slate-800/60 text-slate-500 hover:text-foreground"}`}>
              {p.label}
            </button>
          ))}
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setActivePreset(""); }}
            className="rounded bg-slate-800/60 border border-border px-2 py-1 text-[11px] text-foreground focus:border-amber-500/50 focus:outline-none" />
          <span className="text-slate-600 text-[10px]">—</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setActivePreset(""); }}
            className="rounded bg-slate-800/60 border border-border px-2 py-1 text-[11px] text-foreground focus:border-amber-500/50 focus:outline-none" />
        </div>
      </div>

      {loading ? <div className="text-slate-400 py-8">Loading funnel...</div> : (
      <>
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Total Leads</div>
            <div className="text-lg font-bold text-foreground">{totalLeads.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Invoiced</div>
            <div className="text-lg font-bold text-emerald-400">{(funnel[7]?.count ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Overall Conv.</div>
            <div className="text-lg font-bold text-amber-400">{totalLeads > 0 ? ((funnel[7]?.count ?? 0) / totalLeads * 100).toFixed(1) : 0}%</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">WIP Complete</div>
            <div className="text-lg font-bold text-cyan-400">{(funnel[6]?.count ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/60 p-3">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">Drop-off</div>
            <div className="text-lg font-bold text-red-400">{totalLeads > 0 ? (100 - (funnel[7]?.count ?? 0) / totalLeads * 100).toFixed(1) : 0}%</div>
          </div>
        </div>

        {/* Funnel Stages */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-5">
          <div className="space-y-4">
            {funnel.map((s: any) => {
              const pctOfTotal = totalLeads > 0 ? Math.min((s.count / totalLeads) * 100, 100) : 0;
              const barWidth = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
              return (
                <div key={s.stage} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="w-7 h-7 rounded-full bg-slate-800 text-[10px] font-bold text-amber-400 flex items-center justify-center">{s.stage}</span>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[12px] font-medium text-foreground">{s.label}</div>
                    <div className="text-[9px] text-slate-600">{s.slaTarget}</div>
                  </div>
                  <div className="col-span-5">
                    <div className="h-7 rounded bg-slate-800/50 overflow-hidden relative">
                      <div
                        className={`h-full rounded transition-all ${
                          pctOfTotal >= 60 ? "bg-gradient-to-r from-emerald-600 to-emerald-500" :
                          pctOfTotal >= 30 ? "bg-gradient-to-r from-amber-600 to-amber-500" :
                          s.count > 0 ? "bg-gradient-to-r from-red-600 to-red-500" : ""
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">{s.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-[12px] font-bold text-foreground">{pctOfTotal.toFixed(1)}%</div>
                    <div className="text-[9px] text-slate-600">of leads</div>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      pctOfTotal >= 60 ? "bg-emerald-500/15 text-emerald-400" :
                      pctOfTotal >= 30 ? "bg-amber-500/15 text-amber-400" :
                      s.count > 0 ? "bg-red-500/15 text-red-400" : "bg-slate-800 text-slate-600"
                    }`}>
                      {pctOfTotal >= 60 ? "OK" : pctOfTotal >= 30 ? "WARN" : s.count > 0 ? "LOW" : "N/A"}
                    </span>
                  </div>
                  <div className="col-span-1 text-right text-[9px] text-slate-600">
                    {s.avgLag !== "-" ? s.avgLag : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage-over-stage drop */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <h3 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">Stage-over-Stage Conversion</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {funnel.slice(1).map((s: any, i: number) => {
              const prev = funnel[i]?.count ?? 0;
              const stagePct = prev > 0 ? Math.min((s.count / prev) * 100, 999) : 0;
              return (
                <div key={s.stage} className="rounded border border-border bg-background/40 p-2 text-center">
                  <div className="text-[9px] text-slate-600 mb-0.5">{s.stage - 1}→{s.stage}</div>
                  <div className={`text-sm font-bold ${stagePct >= 80 ? "text-emerald-400" : stagePct >= 40 ? "text-amber-400" : "text-red-400"}`}>
                    {prev > 0 ? `${stagePct.toFixed(0)}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
      )}
    </div>
  );
}
