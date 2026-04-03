"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

export default function PisLeadDistributionPage() {
  const { companyId } = useParams();
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [simulation, setSimulation] = useState<any>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    fetch(`/api/company/${companyId}/pis/lead-distribution`).then(r => r.json())
      .then(d => { setQueue(d.queue ?? []); setHistory(d.history ?? []); }).catch(console.error).finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { loadData(); const iv = setInterval(loadData, 5000); return () => clearInterval(iv); }, [loadData]);

  const runSimulation = async () => {
    setSimRunning(true);
    try {
      const r = await fetch(`/api/company/${companyId}/pis/lead-distribution/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadCount: 60 }) });
      setSimulation(await r.json());
    } catch (e) { console.error(e); }
    setSimRunning(false);
  };

  if (loading) return <div className="text-slate-400 py-8">Loading lead distribution...</div>;

  const statusColor = (s: string) => {
    const map: Record<string,string> = { pending:"bg-slate-500/20 text-slate-400", offered:"bg-blue-500/20 text-blue-400", accepted:"bg-emerald-500/20 text-emerald-400", locked:"bg-purple-500/20 text-purple-400", released:"bg-amber-500/20 text-amber-400", manual:"bg-red-500/20 text-red-400", completed:"bg-emerald-500/20 text-emerald-400" };
    return map[s] ?? "bg-slate-500/20 text-slate-400";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[{l:"Tier 1 Window",v:"10 min"},{l:"Tier 2 Window",v:"7 min"},{l:"Tier 3 Window",v:"5 min"},{l:"Lock Duration",v:"120 min"},{l:"No-Call Penalty",v:"5 pts"},{l:"Max Cascades",v:"5"}].map(c => (
          <div key={c.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{c.l}</div>
            <div className="text-lg font-bold text-foreground">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">LIVE LEAD QUEUE <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400 inline-block animate-pulse" /></h2>
        {queue.length === 0 ? <div className="text-slate-500 text-sm py-4">No leads in queue</div> : (
          <table className="w-full text-xs"><thead><tr className="border-b border-border text-left">
            {["Lead","Status","Tier","Offered To","Cascades","Value"].map(h => <th key={h} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>)}
          </tr></thead><tbody>
            {queue.map((q:any) => (
              <tr key={q.id} className="border-b border-border/40">
                <td className="px-3 py-2 text-foreground font-mono">{q.leadId?.slice(0,8)}</td>
                <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(q.status)}`}>{q.status?.toUpperCase()}</span></td>
                <td className="px-3 py-2 text-slate-300">T{q.currentTier}</td>
                <td className="px-3 py-2 text-slate-300">{q.offeredToName ?? "—"}</td>
                <td className="px-3 py-2 text-slate-300">{q.cascadeCount}/5</td>
                <td className="px-3 py-2 text-emerald-400">AED {(q.pipelineValue ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">60-LEAD LIVE SIMULATION</h2>
          <button onClick={runSimulation} disabled={simRunning} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {simRunning ? "Running..." : "Run Simulation"}
          </button>
        </div>
        {simulation && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[{l:"Total Leads",v:simulation.totalLeads},{l:"Accepted",v:simulation.accepted,c:"text-emerald-400"},{l:"Cascaded",v:simulation.cascaded,c:"text-amber-400"},{l:"Manual Queue",v:simulation.manualQueue,c:"text-red-400"},{l:"Pipeline Value",v:`AED ${Math.round(simulation.totalPipelineValue/1000)}K`,c:"text-purple-400"}].map(s => (
                <div key={s.l} className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-[10px] text-slate-400 uppercase">{s.l}</div>
                  <div className={`text-lg font-bold ${s.c ?? "text-foreground"}`}>{s.v}</div>
                </div>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {(simulation.steps ?? []).slice(0,60).map((step:any, i:number) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-1.5 rounded text-[11px] ${step.action==="accept"?"bg-emerald-500/10":step.action==="cascade"?"bg-amber-500/10":"bg-red-500/10"}`}>
                  <span className="text-slate-500 w-8">#{step.leadNumber}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${step.action==="accept"?"bg-emerald-500/20 text-emerald-400":step.action==="cascade"?"bg-amber-500/20 text-amber-400":"bg-red-500/20 text-red-400"}`}>{step.action?.toUpperCase()}</span>
                  <span className="text-foreground flex-1">{step.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">QUEUE HISTORY</h2>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {history.slice(0,50).map((h:any) => (
            <div key={h.id} className="flex items-center gap-3 text-[11px] py-1">
              <span className="text-slate-500 w-36">{new Date(h.createdAt).toLocaleString()}</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusColor(h.action)}`}>{h.action?.toUpperCase()}</span>
              <span className="text-slate-300">{h.advisorName ?? "System"}</span>
              {h.penaltyPoints > 0 && <span className="text-red-400">-{h.penaltyPoints}pts</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}