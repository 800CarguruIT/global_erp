"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PisSignalsPage() {
  const { companyId } = useParams();
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => { fetch(`/api/company/${companyId}/pis/signals`).then(r => r.json()).then(d => setSignals(d.signals ?? [])).catch(console.error).finally(() => setLoading(false)); }, [companyId]);
  if (loading) return <div className="text-slate-400 py-8">Loading signals...</div>;
  const filtered = filter === "ALL" ? signals : signals.filter((s:any) => s.urgency === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Full Signal Library <span className="text-slate-500 font-normal ml-2">{signals.length} signals</span></h2>
        <div className="flex gap-2">
          {["ALL","HIGH","MED","LOW"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded text-[10px] font-bold ${filter===f?"bg-amber-500/20 text-amber-400":"bg-slate-800 text-slate-400 hover:text-white"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((s:any, i:number) => (
          <div key={i} className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400">{s.engine_key?.toUpperCase()}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.urgency==="HIGH"?"bg-red-500/20 text-red-400":s.urgency==="MED"?"bg-amber-500/20 text-amber-400":"bg-slate-500/20 text-slate-400"}`}>{s.urgency}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-700 text-slate-300">{s.type}</span>
              <span className="text-[10px] text-slate-500 ml-auto">Confidence: {((s.confidence ?? 0) * 100).toFixed(0)}%</span>
            </div>
            <div className="text-sm font-semibold text-white mb-1">{s.metric}</div>
            <div className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Observation:</span> {s.observation}</div>
            <div className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Diagnosis:</span> {s.diagnosis}</div>
            <div className="text-xs text-amber-400"><span className="text-slate-500">Action:</span> {s.action}</div>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
              <span>Owner: {s.owner_role}</span><span>Respond by: {s.respond_by_hours}h</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}