"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { DateFilter } from "../_components/DateFilter";

interface Kpi { label: string; value: number; formatted: string; }
interface AiSignal { id: string; severity: string; category: string; title: string; description: string; impactAed: number; confidencePct: number; }
interface EngineStatus { key: string; name: string; isActive: boolean; signalCount: number; topAction: string; }

function fmtAed(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `AED ${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return `AED ${v.toLocaleString()}`;
}

export default function RccAiEnginePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/revenue-command-center/ai-engine?from=${from}&to=${to}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <AppLayout><div className="p-8 text-center opacity-50">Loading AI Engine...</div></AppLayout>;

  return (
    <AppLayout>
    <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">AI Revenue Intelligence</h1>
          <p className="text-xs opacity-40 mt-0.5">7 engines &middot; 3 analysis modes &middot; Real-time</p>
        </div>
        <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(data.kpis as Kpi[]).map((k, i) => (
          <div key={i} className={`rounded-xl p-4 ${i === 0 ? "bg-emerald-500/[0.06]" : "bg-white/[0.03]"}`}>
            <p className="text-[11px] opacity-40 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${i === 0 ? "text-emerald-400" : ""}`}>{k.formatted}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-emerald-500/[0.04] p-5">
        <h3 className="font-semibold mb-0.5 flex items-center gap-2">
          AI REVENUE INTELLIGENCE — ALL SIGNALS <span className="text-[10px] bg-emerald-500/80 text-white rounded-full px-2 py-0.5 font-normal">LIVE</span>
        </h3>
        <p className="text-xs opacity-40 mb-4">Sorted by recoverable revenue impact</p>
        <div className="space-y-2">
          {(data.signals as AiSignal[]).length === 0 && <p className="text-center opacity-30 py-8">No signals for the current period. Signals appear when AI engines detect leakage patterns, ROI anomalies, or optimization opportunities.</p>}
          {(data.signals as AiSignal[]).map(sig => (
            <div key={sig.id} className="rounded-lg p-4 bg-white/[0.03] border-l-[3px]" style={{ borderLeftColor: sig.severity === "CRITICAL" ? "#ef4444" : sig.severity === "HIGH" ? "#f59e0b" : "#3b82f6" }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${sig.severity === "CRITICAL" ? "bg-red-500/80" : sig.severity === "HIGH" ? "bg-amber-500/80" : "bg-blue-500/80"}`}>{sig.severity}</span>
                    <span className="text-[10px] opacity-40">{sig.category}</span>
                  </div>
                  <h4 className="font-medium">{sig.title}</h4>
                  <p className="text-xs opacity-40 mt-1">{sig.description}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-[10px] opacity-30">IMPACT</p>
                  <p className="text-emerald-400 font-bold">+{fmtAed(sig.impactAed)}</p>
                  <p className="text-[10px] opacity-30">Confidence: {sig.confidencePct}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] p-5">
        <h3 className="font-semibold mb-4">AI ENGINE STATUS</h3>
        <div className="grid grid-cols-7 gap-3">
          {(data.engines as EngineStatus[]).map(eng => (
            <div key={eng.key} className="rounded-lg bg-white/[0.03] p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <span className={`w-1.5 h-1.5 rounded-full ${eng.isActive ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className={`text-[10px] font-medium ${eng.isActive ? "text-emerald-400/80" : "text-red-400/80"}`}>{eng.isActive ? "ACTIVE" : "OFF"}</span>
              </div>
              <p className="text-xs font-medium leading-tight">{eng.name}</p>
              <p className="text-[10px] opacity-30 mt-1">{eng.signalCount} signals</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
