"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Advisor { advisorUserId: string; advisorName: string; compositeScore: number; conversionRate: number; gpPct: number; revenue: number; paidPct: number; focPct: number; slaCompliance: number; callQuality: number; customerSat: number; tier: string; rank: number; }

export default function PisAdvisorsPage() {
  const { companyId } = useParams();
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/company/${companyId}/pis/advisors`).then(r => r.json()).then(d => setAdvisors(d.advisors ?? [])).catch(console.error).finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <div className="text-slate-400 py-8">Loading advisors...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Advisor Scores — V4 Composite Formula</h2>
        <button onClick={() => { fetch(`/api/company/${companyId}/pis/advisors`, { method: "POST" }).then(r => r.json()).then(d => setAdvisors(d.advisors ?? [])); }}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90">Refresh Scores</button>
      </div>
      <div className="rounded-xl border border-border bg-gradient-to-br from-slate-900/80 to-black/90 overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-left">
            {["#","Advisor","Composite","Conv %","GP %","Revenue","Paid %","FOC %","SLA","Call Q","Tier"].map(h => (
              <th key={h} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {advisors.map((adv, i) => (
              <tr key={adv.advisorUserId} className="border-b border-border/40 hover:bg-muted/40">
                <td className="px-4 py-3 font-bold text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-foreground">{adv.advisorName}</td>
                <td className="px-4 py-3 font-bold text-amber-400">{adv.compositeScore.toFixed(1)}</td>
                <td className="px-4 py-3 text-slate-300">{adv.conversionRate.toFixed(1)}%</td>
                <td className="px-4 py-3 text-slate-300">{adv.gpPct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-emerald-400 font-medium">AED {Math.round(adv.revenue / 1000)}K</td>
                <td className="px-4 py-3 text-slate-300">{adv.paidPct.toFixed(0)}%</td>
                <td className={`px-4 py-3 ${adv.focPct > 40 ? "text-red-400" : "text-slate-300"}`}>{adv.focPct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-slate-300">{adv.slaCompliance.toFixed(0)}%</td>
                <td className="px-4 py-3 text-slate-300">{adv.callQuality.toFixed(0)}%</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${adv.tier === "ELITE" ? "bg-amber-500/20 text-amber-400" : "bg-slate-700 text-slate-300"}`}>{adv.tier}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}