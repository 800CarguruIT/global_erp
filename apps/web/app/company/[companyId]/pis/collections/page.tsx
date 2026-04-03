"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const PRESETS: { label: string; days: number | null }[] = [
  { label: "7D", days: 7 }, { label: "30D", days: 30 }, { label: "90D", days: 90 },
  { label: "YTD", days: -1 }, { label: "1Y", days: 365 }, { label: "ALL", days: null },
];
function getPresetDates(days: number | null): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  if (days === null) return { from: "2020-01-01", to };
  if (days === -1) return { from: `${new Date().getFullYear()}-01-01`, to };
  return { from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10), to };
}

export default function PisCollectionsPage() {
  const { companyId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("ALL");
  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/company/${companyId}/pis/collections?from=${from}&to=${to}`)
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [companyId, from, to]);

  useEffect(() => { loadData(); }, [loadData]);

  const applyPreset = (label: string, days: number | null) => {
    setActivePreset(label);
    const d = getPresetDates(days);
    setFrom(d.from);
    setTo(d.to);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-foreground">Collections & Revenue</h2>
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

      {loading ? <div className="text-slate-400 py-8">Loading collections...</div> : !data ? <div className="text-red-400 py-8">Failed to load</div> : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:"Total Revenue",v:`AED ${Math.round(data.totalRevenue/1000)}K`,c:"text-foreground"},{l:"Gross Profit",v:`AED ${Math.round(data.grossProfit/1000)}K`,c:"text-emerald-400"},{l:"GP %",v:`${data.gpPct}%`,c:"text-yellow-400"},{l:"Collection Rate",v:`${data.collectionRate}%`,c:"text-cyan-400"},{l:"DSO",v:`${data.dso} days`,c:"text-foreground"},{l:"Overdue Amount",v:`AED ${Math.round(data.overdueAmount/1000)}K`,c:"text-red-400"},{l:"Overdue Count",v:data.overdueCount,c:"text-red-400"},{l:"Total Cost",v:`AED ${Math.round(data.totalCost/1000)}K`,c:"text-slate-300"}].map(k => (
          <div key={k.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">PER ADVISOR GP%</h2>
        <table className="w-full text-xs"><thead><tr className="border-b border-border text-left">
          {["Advisor","Revenue","Cost","GP","GP %","Collected","Outstanding"].map(h=><th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>)}
        </tr></thead><tbody>
          {(data.perAdvisor??[]).map((a:any)=>(
            <tr key={a.advisorName} className="border-b border-border/40">
              <td className="px-4 py-2 text-foreground font-medium">{a.advisorName}</td><td className="px-4 py-2 text-slate-300">AED {Math.round(a.revenue/1000)}K</td>
              <td className="px-4 py-2 text-slate-300">AED {Math.round(a.cost/1000)}K</td><td className="px-4 py-2 text-emerald-400">AED {Math.round(a.gp/1000)}K</td>
              <td className="px-4 py-2 text-yellow-400 font-bold">{a.gpPct}%</td><td className="px-4 py-2 text-slate-300">AED {Math.round(a.collected/1000)}K</td>
              <td className="px-4 py-2 text-red-400">AED {Math.round(a.outstanding/1000)}K</td>
            </tr>))}
        </tbody></table>
      </div>
      </>
      )}
    </div>
  );
}
