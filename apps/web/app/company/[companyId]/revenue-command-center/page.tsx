"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { DateFilter } from "./_components/DateFilter";

interface Kpi { label: string; value: number; formatted: string; }
interface SourceDist { source: string; count: number; pct: number; }
interface PipelineStage { stage: number; label: string; count: number; aedValue: number; dropPct: number; leadsLost: number; }
interface LeaderboardEntry { rank: number; agentName: string; department: string; leadCount: number; conversionPct: number; revenue: number; rpl: number; }
interface HeatmapCell { day: number; hour: number; revenue: number; }
interface AiSignal { id: string; severity: string; category: string; title: string; description: string; impactAed: number; confidencePct: number; }

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "#22c55e", Call_Inbound: "#f59e0b", Call_Outbound: "#8b5cf6",
  call: "#f59e0b", inbound_call: "#f59e0b", outbound_call: "#8b5cf6",
  Email: "#f97316", website: "#f97316", Walk_in: "#06b6d4", walk_in: "#06b6d4",
  referral: "#ec4899", ads: "#a855f7", Mobile: "#3b82f6", Chat: "#14b8a6",
  mobile_app: "#3b82f6", social_media: "#a855f7", other: "#6b7280",
};

function fmtAed(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `AED ${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return `AED ${v.toLocaleString()}`;
}

function fmtSource(s: string) {
  const m: Record<string, string> = {
    Call_Inbound: "Inbound Calls", Call_Outbound: "Outbound Calls",
    call: "Calls", whatsapp: "WhatsApp", website: "Website", ads: "Ads",
    Walk_in: "Walk In", walk_in: "Walk In", referral: "Referral", other: "Other",
    Mobile: "Mobile", mobile_app: "Mobile App", social_media: "Social Media",
    Email: "Email", Chat: "Chat", SM: "Social Media",
  };
  return m[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RccCommandCenterPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [lbSort, setLbSort] = useState<"revenue" | "rpl" | "conv">("revenue");

  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/revenue-command-center/overview?from=${from}&to=${to}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <AppLayout><div className="p-8 text-center opacity-50">Loading Command Center...</div></AppLayout>;

  return (
    <AppLayout>
    <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Revenue Command Center</h1>
          <p className="text-xs opacity-40 mt-0.5">Every Lead &middot; Every Call &middot; Every Dirham</p>
        </div>
        <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {(data.kpis as Kpi[]).map((k, i) => (
          <div key={i} className={`rounded-xl p-4 ${i === 4 ? "bg-red-500/[0.06]" : "bg-card/40"}`}>
            <p className="text-[11px] opacity-40 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${i === 4 ? "text-red-400" : i === 0 ? "text-emerald-400" : ""}`}>{k.formatted}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Lead Sources */}
        <div className="rounded-xl bg-card/40 p-5">
          <h3 className="font-semibold mb-0.5">LEAD SOURCES</h3>
          <p className="text-xs opacity-40 mb-4">Where your money enters the building</p>
          <div className="flex items-center gap-8">
            <div className="relative w-44 h-44 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {(() => {
                  let offset = 0;
                  return (data.leadSources as SourceDist[]).map((s, i) => {
                    const dash = (s.pct / 100) * 283;
                    const gap = 283 - dash;
                    const el = <circle key={i} cx="50" cy="50" r="45" fill="none" stroke={SOURCE_COLORS[s.source] || "#6b7280"} strokeWidth="10"
                      strokeDasharray={`${dash} ${gap}`} style={{ strokeDashoffset: -(offset / 100) * 283 }} />;
                    offset += s.pct;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{(data.leadSources as SourceDist[]).reduce((s: number, r: SourceDist) => s + r.count, 0).toLocaleString()}</span>
                <span className="text-[10px] opacity-40 uppercase">Total Leads</span>
              </div>
            </div>
            <div className="space-y-1 text-sm flex-1">
              {(data.leadSources as SourceDist[]).map((s, i) => (
                <div key={i} className="flex items-center justify-between py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] || "#6b7280" }} />
                    <span className="opacity-80">{fmtSource(s.source)}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="font-medium tabular-nums">{s.count.toLocaleString()}</span>
                    <span className="opacity-40 w-10 text-right">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Pipeline */}
        <div className="rounded-xl bg-card/40 p-5">
          <h3 className="font-semibold mb-0.5 flex items-center gap-2">LIVE PIPELINE <span className="text-[10px] bg-emerald-500/15 text-emerald-400 rounded-full px-2 py-0.5 font-normal">{(data.pipeline as PipelineStage[])[0]?.count.toLocaleString()} active</span></h3>
          <p className="text-xs opacity-40 mb-4">Lead → Cash lifecycle</p>
          <div className="space-y-1.5">
            {(data.pipeline as PipelineStage[]).map((s, i) => {
              const maxCount = (data.pipeline as PipelineStage[])[0]?.count || 1;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-28 text-right opacity-40 text-xs">{s.label}</span>
                  <div className="flex-1 relative h-5 rounded bg-card/40">
                    <div className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-emerald-500/80 to-emerald-500/60" style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 2 : 0)}%` }}>
                      <span className="absolute left-1.5 top-0 text-[11px] font-semibold text-white leading-5">{s.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-32 text-right text-xs flex gap-2 justify-end">
                    {s.aedValue > 0 && <span className="opacity-40">{fmtAed(s.aedValue)}</span>}
                    {s.dropPct > 0 && <span className="text-red-400/80">-{s.dropPct}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Agent Leaderboard */}
        <div className="rounded-xl bg-card/40 p-5">
          <h3 className="font-semibold mb-0.5">AGENT REVENUE LEADERBOARD</h3>
          <p className="text-xs opacity-40 mb-3">Ranked by money generated</p>
          <div className="flex gap-1.5 mb-3">
            {(["revenue", "rpl", "conv"] as const).map(s => (
              <button key={s} onClick={() => setLbSort(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${lbSort === s ? "bg-emerald-500/20 text-emerald-400" : "opacity-40 hover:opacity-70"}`}>
                {s === "revenue" ? "Revenue" : s === "rpl" ? "Revenue/Lead" : "Conv %"}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {[...(data.leaderboard as LeaderboardEntry[])]
              .sort((a, b) => lbSort === "rpl" ? b.rpl - a.rpl : lbSort === "conv" ? b.conversionPct - a.conversionPct : b.revenue - a.revenue)
              .map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 rounded-lg hover:bg-card/40 px-1 -mx-1 transition-colors">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${i < 3 ? "bg-amber-500/15 text-amber-400" : "opacity-30"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{fmtSource(a.agentName)}</span>
                    {a.department && <span className="text-[11px] opacity-30 ml-2">{a.department}</span>}
                  </div>
                  <span className="opacity-40 text-xs tabular-nums">{a.leadCount.toLocaleString()} leads</span>
                  <span className="text-emerald-400/80 text-xs font-medium tabular-nums w-10 text-right">{a.conversionPct}%</span>
                  <span className="text-emerald-400 font-semibold tabular-nums w-28 text-right text-sm">AED {a.revenue.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Revenue Heatmap */}
        <div className="rounded-xl bg-card/40 p-5">
          <h3 className="font-semibold mb-0.5">REVENUE HEATMAP</h3>
          <p className="text-xs opacity-40 mb-3">AED generated by hour x day</p>
          <div className="overflow-x-auto">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `36px repeat(12, 1fr)` }}>
              <div />
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="text-[10px] opacity-30 text-center">{(8 + i) % 12 || 12}{(8 + i) < 12 ? "am" : "pm"}</div>
              ))}
              {DAY_LABELS.map((day, di) => {
                const cells = (data.heatmap as HeatmapCell[]).filter(c => c.day === di);
                const maxRev = Math.max(...(data.heatmap as HeatmapCell[]).map((c: HeatmapCell) => c.revenue), 1);
                return [
                  <div key={`d${di}`} className="text-[10px] opacity-30 flex items-center">{day}</div>,
                  ...Array.from({ length: 12 }, (_, hi) => {
                    const h = 8 + hi;
                    const cell = cells.find(c => c.hour === h);
                    const rev = cell?.revenue ?? 0;
                    const opacity = rev === 0 ? 0.03 : Math.min(0.15 + (rev / maxRev) * 0.85, 1);
                    return (
                      <div key={`${di}-${hi}`}
                        className="rounded h-6 flex items-center justify-center text-[9px] text-foreground/70"
                        style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})` }}
                        title={`${day} ${h}:00 — AED ${rev.toLocaleString()}`}>
                        {rev >= 1000 ? `${(rev / 1000).toFixed(1)}K` : rev > 0 ? rev : ""}
                      </div>
                    );
                  }),
                ];
              })}
            </div>
          </div>
        </div>
      </div>

      {/* AI Signals */}
      {(data.aiSignals as AiSignal[]).length > 0 && (
        <div className="rounded-xl bg-emerald-500/[0.04] p-5">
          <h3 className="font-semibold mb-0.5 flex items-center gap-2">
            AI REVENUE INTELLIGENCE
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 rounded-full px-2 py-0.5 font-normal">
              +{fmtAed((data.aiSignals as AiSignal[]).reduce((s: number, sig: AiSignal) => s + sig.impactAed, 0))} recoverable
            </span>
          </h3>
          <p className="text-xs opacity-40 mb-4">Top signals sorted by recoverable revenue</p>
          <div className="grid grid-cols-2 gap-3">
            {(data.aiSignals as AiSignal[]).slice(0, 4).map(sig => (
              <div key={sig.id} className="rounded-lg p-4 bg-card/40 border-l-[3px]" style={{ borderLeftColor: sig.severity === "CRITICAL" ? "#ef4444" : sig.severity === "HIGH" ? "#f59e0b" : "#3b82f6" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${sig.severity === "CRITICAL" ? "bg-red-500/80" : sig.severity === "HIGH" ? "bg-amber-500/80" : "bg-blue-500/80"}`}>{sig.severity}</span>
                  <span className="text-[10px] opacity-40">{sig.category}</span>
                </div>
                <h4 className="font-medium text-sm mb-1">{sig.title}</h4>
                <p className="text-xs opacity-40 mb-2 line-clamp-2">{sig.description}</p>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-semibold">+{fmtAed(sig.impactAed)}</span>
                  <span className="opacity-30">Confidence: {sig.confidencePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
