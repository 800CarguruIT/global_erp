"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PisEstimatesPage() {
  const { companyId } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`/api/company/${companyId}/pis/estimates`).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false)); }, [companyId]);
  if (loading) return <div className="text-slate-400 py-8">Loading estimates...</div>;
  if (!data) return <div className="text-red-400 py-8">Failed to load</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[{l:"Approval Rate",v:`${data.approvalRate}%`,c:"text-emerald-400"},{l:"Total Estimates",v:data.totalEstimates,c:"text-foreground"},{l:"Approved",v:data.approvedCount,c:"text-emerald-400"},{l:"Rejected",v:data.rejectedCount,c:"text-red-400"},{l:"Rejected Value",v:`AED ${Math.round(data.rejectedValueAed/1000)}K`,c:"text-red-400"},{l:"Pending > SLA",v:data.pendingOverSla,c:"text-amber-400"}].map(k => (
          <div key={k.l} className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-4">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{k.l}</div>
            <div className={`text-xl font-bold ${k.c}`}>{k.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">PER ADVISOR BREAKDOWN</h2>
        <table className="w-full text-xs"><thead><tr className="border-b border-border text-left">
          {["Advisor","Total","Approved","Rejected","Pending","Approval %"].map(h=><th key={h} className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>)}
        </tr></thead><tbody>
          {(data.perAdvisor??[]).map((a:any)=>(
            <tr key={a.advisorName} className="border-b border-border/40">
              <td className="px-4 py-2 text-foreground font-medium">{a.advisorName}</td><td className="px-4 py-2 text-slate-300">{a.total}</td>
              <td className="px-4 py-2 text-emerald-400">{a.approved}</td><td className="px-4 py-2 text-red-400">{a.rejected}</td>
              <td className="px-4 py-2 text-amber-400">{a.pending}</td><td className="px-4 py-2 text-foreground font-bold">{a.approvalRate}%</td>
            </tr>))}
        </tbody></table>
      </div>
    </div>
  );
}