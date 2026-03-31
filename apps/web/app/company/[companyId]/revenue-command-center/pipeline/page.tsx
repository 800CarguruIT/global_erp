"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { DateFilter } from "../_components/DateFilter";

interface PipelineStage { stage: number; label: string; count: number; aedValue: number; dropPct: number; leadsLost: number; }
interface ConvRow { source: string; leadToQual: number; qualToBook: number; bookToShow: number; showToSale: number; endToEnd: number; }

const SOURCE_COLORS: Record<string, string> = {
  Call_Inbound: "#f59e0b", Call_Outbound: "#8b5cf6", Email: "#f97316",
  Walk_in: "#06b6d4", Mobile: "#3b82f6", Chat: "#14b8a6",
  whatsapp: "#22c55e", call: "#f59e0b", website: "#f97316", walk_in: "#06b6d4",
  referral: "#ec4899", ads: "#a855f7", other: "#6b7280",
};

function fmtAed(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `AED ${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return `AED ${v.toLocaleString()}`;
}

function fmtSource(s: string) {
  const m: Record<string, string> = { Call_Inbound: "Inbound Calls", Call_Outbound: "Outbound Calls", call: "Calls", whatsapp: "WhatsApp", website: "Website", ads: "Ads", Walk_in: "Walk In", walk_in: "Walk In", referral: "Referral", other: "Other", Mobile: "Mobile", Email: "Email", Chat: "Chat" };
  return m[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function RccPipelinePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/revenue-command-center/pipeline?from=${from}&to=${to}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <AppLayout><div className="p-8 text-center opacity-50">Loading Pipeline...</div></AppLayout>;

  return (
    <AppLayout>
    <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Lead Lifecycle Pipeline</h1>
          <p className="text-xs opacity-40 mt-0.5">Every lead status from first touch to cash collected</p>
        </div>
        <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="rounded-xl bg-white/[0.03] p-5">
        <div className="space-y-1.5">
          {(data.pipeline as PipelineStage[]).map((s, i) => {
            const max = (data.pipeline as PipelineStage[])[0]?.count || 1;
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-right opacity-40 text-xs">{s.label}</span>
                <div className="flex-1 relative h-6 rounded bg-white/[0.03]">
                  <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-emerald-500/80 to-emerald-500/60" style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 2 : 0)}%` }}>
                    <span className="absolute left-1.5 top-0 text-[11px] font-semibold text-white leading-6">{s.count.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-40 text-right text-xs flex gap-2 justify-end">
                  {s.aedValue > 0 && <span className="opacity-40">{fmtAed(s.aedValue)}</span>}
                  {s.dropPct > 0 && <span className="text-red-400/80">-{s.dropPct}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(data.pipeline as PipelineStage[]).map((s, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] p-4">
            <p className="text-[10px] opacity-30 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{s.count.toLocaleString()}</p>
            {s.aedValue > 0 && <p className="text-xs text-emerald-400/60">{fmtAed(s.aedValue)}</p>}
            {s.dropPct > 0 && (
              <div className="mt-2 flex justify-between text-[10px]">
                <span className="text-red-400/80">Drop: -{s.dropPct}%</span>
                <span className="opacity-30">{s.leadsLost.toLocaleString()} lost</span>
              </div>
            )}
            {i === 0 && <p className="text-[10px] opacity-30 mt-2 rounded px-2 py-1 bg-white/[0.04]">Entry point — all sources</p>}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/[0.03] p-5">
        <h3 className="font-semibold mb-0.5">SOURCE → STAGE CONVERSION MATRIX</h3>
        <p className="text-xs opacity-40 mb-4">Conversion rate at each stage by source</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="opacity-40 text-[11px] uppercase border-b border-white/[0.06]">
              <th className="text-left py-2 px-2 font-medium">Source</th>
              <th className="text-center py-2 px-2 font-medium">Lead→Qual</th>
              <th className="text-center py-2 px-2 font-medium">Qual→Book</th>
              <th className="text-center py-2 px-2 font-medium">Book→Show</th>
              <th className="text-center py-2 px-2 font-medium">Show→Sale</th>
              <th className="text-center py-2 px-2 font-medium">End-to-End</th>
            </tr>
          </thead>
          <tbody>
            {(data.conversionMatrix as ConvRow[]).map((r, i) => (
              <tr key={i} className="border-b border-white/[0.03]">
                <td className="py-2.5 px-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[r.source] || "#6b7280" }} />
                  <span>{fmtSource(r.source)}</span>
                </td>
                {[r.leadToQual, r.qualToBook, r.bookToShow, r.showToSale].map((v, j) => (
                  <td key={j} className="text-center px-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${v >= 80 ? "bg-emerald-500/15 text-emerald-400" : v >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/10 text-red-400/80"}`}>{v}%</span>
                  </td>
                ))}
                <td className="text-center px-2">
                  <span className={`text-xs font-bold ${r.endToEnd >= 25 ? "text-emerald-400" : r.endToEnd >= 15 ? "text-amber-400" : "text-red-400/80"}`}>{r.endToEnd}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </AppLayout>
  );
}
