"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { LeadsMain } from "@repo/ui/main-pages/LeadsMain";

export default function CompanyLeadsPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      {companyId ? (
        <div className="flex gap-4">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <LeadsMain companyId={companyId} />
          </div>
          {/* AI Right Panel - same style as master dashboard */}
          {aiOpen && (
            <div className="w-[300px] shrink-0 hidden xl:block">
              <div className="sticky top-4">
                <AISidebar companyId={companyId} onClose={() => setAiOpen(false)} />
              </div>
            </div>
          )}
          {!aiOpen && (
            <button
              onClick={() => setAiOpen(true)}
              className="fixed right-3 top-[68px] z-30 flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-purple-400 hover:bg-purple-500/20 transition-all shadow-lg"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
              AI Intelligence
            </button>
          )}
        </div>
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}

/* ── AI Sidebar (matches master dashboard style) ── */
interface AISidebarProps { companyId: string; onClose: () => void; }
interface SidebarSignal { type: string; urgency: string; metric: string; observation: string; diagnosis: string; action: string; owner_role: string; confidence: number; respond_by_hours: number; engine_key?: string; }

function AISidebar({ companyId, onClose }: AISidebarProps) {
  const [signals, setSignals] = useState<SidebarSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"diagnostic" | "predictive" | "prescriptive">("diagnostic");

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = meRes.ok ? await meRes.json() : {};
      const headers: Record<string, string> = {};
      if (me?.userId) headers["x-user-id"] = me.userId;
      const r = await fetch(`/api/company/${companyId}/intelligence/signals?engines=e1,e4`, { headers });
      if (r.ok) {
        const json = await r.json();
        const all = (json.engines ?? []).flatMap((e: any) => (e.signals ?? []).map((s: any) => ({ ...s, engine_key: e.engine_key })));
        setSignals(all);
      }
    } catch {}
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const filtered = signals.filter(s => s.type === tab);
  const highCount = signals.filter(s => s.urgency === "HIGH").length;
  const urgColor = (u: string) => u === "HIGH" ? "bg-red-500/15 text-red-400" : u === "MED" ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400";

  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">AI Intelligence</span>
          {highCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400">{highCount} HIGH</span>}
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-white text-[11px]">&#10005;</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06]">
        {(["diagnostic", "predictive", "prescriptive"] as const).map(t => {
          const count = signals.filter(s => s.type === t).length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 px-2 py-2 text-[10px] font-semibold capitalize border-b-2 transition ${tab === t ? "border-purple-500 text-purple-400" : "border-transparent text-slate-600 hover:text-slate-400"}`}>
              {t.slice(0, 4)}.
              {count > 0 && <span className="ml-1 text-[9px] opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Signals */}
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg bg-slate-800/50 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-600">No {tab} signals</div>
        ) : (
          <div className="p-2 space-y-2">
            {filtered.map((s, i) => (
              <div key={i} className="rounded-lg border border-white/[0.04] bg-slate-950/40 p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${urgColor(s.urgency)}`}>{s.urgency}</span>
                  <span className="text-[8px] text-slate-600 uppercase">{s.engine_key}</span>
                  <span className="ml-auto text-[8px] text-slate-700">{Math.round(s.confidence * 100)}%</span>
                </div>
                <div className="text-[10px] font-medium text-white leading-snug">{s.observation}</div>
                {s.diagnosis && <div className="text-[9px] text-slate-500 leading-snug">{s.diagnosis}</div>}
                {s.action && (
                  <div className="rounded bg-purple-500/10 px-2 py-1.5">
                    <div className="text-[9px] text-purple-300 leading-snug">{s.action}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[8px] text-slate-700">
                  {s.owner_role && <span>{s.owner_role}</span>}
                  <span>{s.respond_by_hours}h</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/[0.06] text-[9px] text-slate-700 text-center">
        {signals.length} signals · {loading ? "Analysing..." : "Updated just now"}
      </div>
    </div>
  );
}
