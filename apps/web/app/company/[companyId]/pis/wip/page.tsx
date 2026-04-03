"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PisWipPage() {
  const { companyId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`/api/company/${companyId}/pis/wip`).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false)); }, [companyId]);
  if (loading) return <div className="text-slate-400 py-8">Loading WIP...</div>;
  if (!data) return <div className="text-red-400 py-8">Failed to load</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[{l:"Active WIP",v:data.activeWip,c:"text-cyan-400"},{l:"Capacity",v:data.totalCapacity,c:"text-foreground"},{l:"On-Time %",v:`${data.onTimePct}%`,c:data.onTimePct>=80?"text-emerald-400":"text-red-400"},{l:"Pickup Rate",v:`${data.pickupRate}%`,c:"text-foreground"},{l:"Zero Revenue WIP",v:data.zeroRevenueWip,c:data.zeroRevenueWip>0?"text-red-400":"text-emerald-400"}].map(k => (
          <div key={k.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      {data.zeroRevenueAdvisors?.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-sm font-semibold text-red-300">Zero Revenue WIP flagged: {data.zeroRevenueAdvisors.join(", ")}</span>
        </div>
      )}
      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">PER ADVISOR WIP</h2>
        <table className="w-full text-xs"><thead><tr className="border-b border-border text-left">
          {["Advisor","Active Jobs","On-Time %"].map(h=><th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>)}
        </tr></thead><tbody>
          {(data.perAdvisor??[]).map((a:any)=>(
            <tr key={a.advisorName} className="border-b border-border/40"><td className="px-4 py-2 text-foreground font-medium">{a.advisorName}</td><td className="px-4 py-2 text-slate-300">{a.activeJobs}</td><td className="px-4 py-2 text-slate-300">{a.onTimePct}%</td></tr>))}
        </tbody></table>
      </div>
    </div>
  );
}