"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const ENGINE_LABELS: Record<string,string> = { e1:"Funnel Intelligence", e2:"Agent Performance", e3:"Revenue Forecasting", e4:"Churn & Retention", e5:"Anomaly Detection", e6:"Collections Intelligence", e7:"Coaching Intelligence" };
const ENGINE_COLORS: Record<string,string> = { e1:"border-blue-500/30 bg-blue-500/5", e2:"border-purple-500/30 bg-purple-500/5", e3:"border-emerald-500/30 bg-emerald-500/5", e4:"border-red-500/30 bg-red-500/5", e5:"border-amber-500/30 bg-amber-500/5", e6:"border-cyan-500/30 bg-cyan-500/5", e7:"border-pink-500/30 bg-pink-500/5" };

export default function PisEnginesPage() {
  const { companyId } = useParams();
  const [engines, setEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`/api/company/${companyId}/pis/engines`).then(r => r.json()).then(d => setEngines(d.engines ?? [])).catch(console.error).finally(() => setLoading(false)); }, [companyId]);
  if (loading) return <div className="text-slate-400 py-8">Loading AI engines...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">All 7 AI Engines</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {engines.map((e:any) => (
          <div key={e.engine_key} className={`rounded-xl border p-5 ${ENGINE_COLORS[e.engine_key] ?? "border-white/10 bg-slate-900/50"}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">{ENGINE_LABELS[e.engine_key] ?? e.engine_key}</h3>
              <span className="text-[10px] text-slate-500">{e.cached ? "Cached" : "Live"}</span>
            </div>
            <div className="text-xs text-slate-400 mb-2">{e.signals?.length ?? 0} signals</div>
            <div className="space-y-2">
              {(e.signals ?? []).slice(0,3).map((s:any, i:number) => (
                <div key={i} className="rounded-lg bg-black/30 p-2 text-[11px]">
                  <div className="flex gap-2 mb-1">
                    <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${s.urgency==="HIGH"?"bg-red-500/20 text-red-400":s.urgency==="MED"?"bg-amber-500/20 text-amber-400":"bg-slate-500/20 text-slate-400"}`}>{s.urgency}</span>
                  </div>
                  <div className="text-white font-medium">{s.metric}</div>
                  <div className="text-slate-400 mt-0.5">{s.observation}</div>
                </div>
              ))}
            </div>
            {e.error && <div className="text-red-400 text-[11px] mt-2">Error: {e.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}