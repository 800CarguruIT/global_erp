"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { DateFilter } from "../_components/DateFilter";

interface SourcePerf { source: string; leads: number; qualified: number; booked: number; showed: number; converted: number; revenue: number; rpl: number; cpa: number; roi: number; }

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#22c55e", Call_Inbound: "#f59e0b", Call_Outbound: "#8b5cf6",
  call: "#f59e0b", Email: "#f97316", website: "#f97316", Walk_in: "#06b6d4",
  walk_in: "#06b6d4", referral: "#ec4899", ads: "#a855f7", Mobile: "#3b82f6",
  Chat: "#14b8a6", mobile_app: "#3b82f6", other: "#6b7280",
};

function fmtSource(s: string) {
  const m: Record<string, string> = {
    Call_Inbound: "Inbound Calls", Call_Outbound: "Outbound Calls",
    call: "Calls", whatsapp: "WhatsApp", website: "Website", ads: "Ads",
    Walk_in: "Walk In", walk_in: "Walk In", referral: "Referral", other: "Other",
    Mobile: "Mobile", Email: "Email", Chat: "Chat", SM: "Social Media",
  };
  return m[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function RccLeadSourcesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/revenue-command-center/lead-sources?from=${from}&to=${to}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <AppLayout><div className="p-8 text-center opacity-50">Loading Lead Sources...</div></AppLayout>;

  return (
    <AppLayout>
    <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Lead Source Performance — End to End</h1>
          <p className="text-xs opacity-40 mt-0.5">Every source: leads in → cash out</p>
        </div>
        <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="rounded-xl bg-white/[0.03] p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="opacity-40 text-[11px] uppercase border-b border-white/[0.06]">
              <th className="text-left py-2 px-2 font-medium">Source</th>
              <th className="text-right py-2 px-2 font-medium">Leads</th>
              <th className="text-right py-2 px-2 font-medium">Qualified</th>
              <th className="text-right py-2 px-2 font-medium">Booked</th>
              <th className="text-right py-2 px-2 font-medium">Showed</th>
              <th className="text-right py-2 px-2 font-medium">Converted</th>
              <th className="text-right py-2 px-2 font-medium">Revenue</th>
              <th className="text-right py-2 px-2 font-medium">RPL</th>
              <th className="text-right py-2 px-2 font-medium">CPA</th>
              <th className="text-right py-2 px-2 font-medium">ROI</th>
            </tr>
          </thead>
          <tbody>
            {(data.table as SourcePerf[]).map((r, i) => (
              <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                <td className="py-2.5 px-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[r.source] || "#6b7280" }} />
                  <span className="font-medium">{fmtSource(r.source)}</span>
                  <span className="text-[10px] opacity-30">{((r.leads / (data.totals.leads || 1)) * 100).toFixed(1)}%</span>
                </td>
                <td className="text-right px-2 tabular-nums">{r.leads.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums">{r.qualified.toLocaleString()} <span className="opacity-30 text-[10px]">({r.leads === 0 ? 0 : Math.round((r.qualified / r.leads) * 100)}%)</span></td>
                <td className="text-right px-2 tabular-nums">{r.booked.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums">{r.showed.toLocaleString()}</td>
                <td className="text-right px-2 tabular-nums"><span className={r.converted > 0 ? "text-emerald-400" : "opacity-30"}>{r.converted.toLocaleString()}</span></td>
                <td className="text-right px-2 text-emerald-400 font-medium tabular-nums">AED {r.revenue.toLocaleString()}</td>
                <td className="text-right px-2 text-cyan-400 tabular-nums">{r.rpl}</td>
                <td className="text-right px-2 tabular-nums"><span className={r.cpa > r.rpl && r.cpa > 0 ? "text-red-400" : "opacity-50"}>{r.cpa || "—"}</span></td>
                <td className="text-right px-2 tabular-nums"><span className={r.roi < 0 ? "text-red-400" : r.roi > 0 ? "text-emerald-400" : "opacity-30"}>{r.roi !== 0 ? `${r.roi}%` : "—"}</span></td>
              </tr>
            ))}
            <tr className="font-semibold border-t border-white/[0.08]">
              <td className="py-2.5 px-2">TOTAL</td>
              <td className="text-right px-2 tabular-nums">{data.totals.leads.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{data.totals.qualified.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{data.totals.booked.toLocaleString()}</td>
              <td className="text-right px-2 tabular-nums">{data.totals.showed.toLocaleString()}</td>
              <td className="text-right px-2 text-emerald-400 tabular-nums">{data.totals.converted.toLocaleString()}</td>
              <td className="text-right px-2 text-emerald-400 tabular-nums">AED {data.totals.revenue.toLocaleString()}</td>
              <td className="text-right px-2 text-cyan-400 tabular-nums">{data.totals.rpl}</td>
              <td className="text-right px-2">—</td>
              <td className="text-right px-2">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(data.table as SourcePerf[]).slice(0, 8).map((r, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] p-4 border-t-2" style={{ borderTopColor: SOURCE_COLORS[r.source] || "#6b7280" }}>
            <h4 className="font-semibold text-sm mb-2">{fmtSource(r.source)}</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div><span className="opacity-30 text-[10px] uppercase">Leads</span><br /><span className="font-medium">{r.leads.toLocaleString()}</span></div>
              <div><span className="opacity-30 text-[10px] uppercase">Converted</span><br /><span className={r.converted > 0 ? "text-emerald-400 font-medium" : "opacity-30"}>{r.leads === 0 ? "0%" : `${Math.round((r.converted / r.leads) * 100)}%`}</span></div>
              <div><span className="opacity-30 text-[10px] uppercase">Revenue</span><br /><span className="text-emerald-400 font-medium">AED {r.revenue.toLocaleString()}</span></div>
              <div><span className="opacity-30 text-[10px] uppercase">RPL</span><br /><span className="text-cyan-400 font-medium">AED {r.rpl}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
    </AppLayout>
  );
}
