"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function AgentIntelligencePage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-purple-400">
              AI Intelligence
            </span>
            <span className="text-xs text-slate-500">Agent Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Agent Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Why is this agent's score declining? Specific skill gap + evidence. Predicted score in 7 days. Exact coaching plan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Why is this agent's score declining? Specific skill gap + evidence.</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">Predicted score in 7 days if no action. Risk of threshold breach.</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Exact coaching plan: focus, method, outcome, checkpoint date.</div>
          </div>
        </div>

        {/* Coaching Steps Reference */}
        <div className="rounded-xl border border-border bg-slate-900/40 p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Coaching Intelligence Process</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { step: "1", label: "30-day Baseline", desc: "Personal avg, best, worst, trend per KPI" },
              { step: "2", label: "Peer Comparison", desc: "vs same team, same experience tier, top quartile" },
              { step: "3", label: "Gap Identification", desc: "Statistically significant & persistent underperformance" },
              { step: "4", label: "Coaching Plan", desc: "Focus area, method, duration, checkpoint, expected improvement" },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-border bg-slate-800/40 p-3">
                <div className="text-purple-400 text-xs font-bold mb-1">Step {s.step} — {s.label}</div>
                <div className="text-[11px] text-slate-400">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {companyId && (
          <AIPanel
            companyId={companyId}
            engines={["e2", "e7"]}
          />
        )}
      </div>
    </AppLayout>
  );
}
