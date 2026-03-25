"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function FunnelIntelligencePage({
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
            <span className="text-xs text-slate-500">Funnel Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Funnel Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Which stage is the biggest leak today and what is driving it? If current conversions hold: projected end-of-week revenue.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Which stage is the biggest leak today and what is driving it?</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">If current conversions hold: projected end-of-week revenue.</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Stage to fix first (by revenue impact). Owner. Action. Deadline.</div>
          </div>
        </div>

        {/* Funnel Signal Reference */}
        <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Key Funnel Signals</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { signal: "Funnel Drop Acceleration", trigger: "Stage drop-off >15% vs 7-day avg", sev: "HIGH", sevColor: "text-red-400" },
              { signal: "Lead Lag Creep", trigger: "Lead-to-Booking avg lag trending up >2h over 3 days", sev: "MED", sevColor: "text-yellow-400" },
              { signal: "Show Rate Collapse", trigger: "Show rate <65% for any team on the day", sev: "HIGH", sevColor: "text-red-400" },
              { signal: "Invoice Delay Spike", trigger: "Branch avg invoice time >45 min (SLA: 30 min)", sev: "HIGH", sevColor: "text-red-400" },
              { signal: "Booking Cold Streak", trigger: "Agent: 0 bookings for >3h during shift", sev: "MED", sevColor: "text-yellow-400" },
              { signal: "Funnel Reversal", trigger: "More cancellations than bookings in 2h window", sev: "CRITICAL", sevColor: "text-red-500" },
            ].map((s) => (
              <div key={s.signal} className="rounded-lg border border-white/5 bg-slate-800/40 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-slate-300">{s.signal}</div>
                  <span className={`text-[10px] font-bold ${s.sevColor}`}>{s.sev}</span>
                </div>
                <div className="text-[10px] text-slate-500">{s.trigger}</div>
              </div>
            ))}
          </div>
        </div>

        {companyId && (
          <AIPanel
            companyId={companyId}
            engines={["e1"]}
          />
        )}
      </div>
    </AppLayout>
  );
}
