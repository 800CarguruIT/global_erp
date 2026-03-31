"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@repo/ui";
import { DateFilter } from "../_components/DateFilter";

interface Kpi { label: string; value: number; formatted: string; }
interface LeakageStage { fromStage: string; toStage: string; cause: string; leadsLost: number; aedLost: number; suggestedFix: string; }
interface FixItem { rank: number; title: string; description: string; effortLevel: string; timeline: string; recoverableAed: number; }

function fmtAed(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `AED ${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
  return `AED ${v.toLocaleString()}`;
}

export default function RccLeakagePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const [from, setFrom] = useState("2020-01-01");
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/company/${companyId}/revenue-command-center/leakage?from=${from}&to=${to}`);
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [companyId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !data) return <AppLayout><div className="p-8 text-center opacity-50">Loading Leakage & Fix...</div></AppLayout>;

  return (
    <AppLayout>
    <div className="mx-auto max-w-[1600px] space-y-5 py-4 px-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Revenue Leakage & Fix</h1>
          <p className="text-xs opacity-40 mt-0.5">Where leads die and how much money dies with them</p>
        </div>
        <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(data.kpis as Kpi[]).map((k, i) => (
          <div key={i} className={`rounded-xl p-4 ${i === 0 ? "bg-red-500/[0.06]" : i === 3 ? "bg-emerald-500/[0.06]" : "bg-white/[0.03]"}`}>
            <p className="text-[11px] opacity-40 uppercase tracking-wider">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${i === 0 ? "text-red-400" : i === 3 ? "text-emerald-400" : ""}`}>{k.formatted}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/[0.03] p-5">
        <h3 className="font-semibold mb-0.5 flex items-center gap-2">
          REVENUE LEAKAGE — STAGE BY STAGE
          <span className="text-[10px] bg-red-500/15 text-red-400 rounded px-2 py-0.5 font-normal uppercase">Fix Priority Order</span>
        </h3>
        <div className="space-y-2 mt-4">
          {(data.leakageByStage as LeakageStage[]).map((l, i) => (
            <div key={i} className="rounded-lg p-4 flex justify-between items-start bg-white/[0.02] border-l-[3px] border-amber-500/60">
              <div>
                <h4 className="font-medium">{l.fromStage} → {l.toStage}</h4>
                <p className="text-xs opacity-40 mt-0.5">Cause: {l.cause}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <p className="text-red-400 font-semibold">{l.leadsLost.toLocaleString()} leads lost &nbsp; AED {l.aedLost.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400/80 mt-0.5">Fix: {l.suggestedFix}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-red-500/[0.08] p-3 flex justify-between">
          <span className="text-red-400 font-semibold uppercase text-sm">Total Revenue Leakage</span>
          <span className="text-red-400 font-bold">AED {(data.leakageByStage as LeakageStage[]).reduce((s: number, l: LeakageStage) => s + l.aedLost, 0).toLocaleString()}/month</span>
        </div>
      </div>

      <div className="rounded-xl bg-emerald-500/[0.04] p-5">
        <h3 className="font-semibold mb-0.5">FIX ROADMAP — REVENUE RECOVERY PLAN</h3>
        <p className="text-xs opacity-40 mb-4">Ordered by revenue impact. Execute top-down.</p>
        <div className="space-y-1">
          {(data.fixRoadmap as FixItem[]).map((f, i) => (
            <div key={i} className="flex items-start gap-4 py-3 border-b border-white/[0.04] last:border-0">
              <span className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">{i + 1}</span>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{f.title}</h4>
                <p className="text-xs opacity-40 mt-0.5">{f.description}</p>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${f.effortLevel === "Low" ? "bg-emerald-500/15 text-emerald-400" : f.effortLevel === "Medium" ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>{f.effortLevel}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] opacity-60">{f.timeline}</span>
                <span className="text-emerald-400 font-semibold text-sm w-28 text-right tabular-nums">+{fmtAed(f.recoverableAed)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-emerald-500/[0.08] p-3 flex justify-between">
          <span className="text-emerald-400 font-semibold uppercase text-sm">Total Recoverable Revenue</span>
          <span className="text-emerald-400 font-bold">+{fmtAed((data.fixRoadmap as FixItem[]).reduce((s: number, f: FixItem) => s + f.recoverableAed, 0))}</span>
        </div>
      </div>
    </div>
    </AppLayout>
  );
}
