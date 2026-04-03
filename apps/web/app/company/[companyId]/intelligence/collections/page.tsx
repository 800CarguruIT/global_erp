"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function CollectionsIntelligencePage({
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
            <span className="text-xs text-slate-500">Collections Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Collections Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Which accounts are highest risk of non-payment and why? Predicted collection rate end of month. Priority call list.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Which accounts are highest risk of non-payment and why?</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">Predicted collection rate end of month. Revenue at risk.</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Priority call list: who, what to offer, who should make the call.</div>
          </div>
        </div>

        {/* Collections Signals */}
        <div className="rounded-xl border border-border bg-slate-900/40 p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Collections Signal Triggers</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { signal: "Collection Rate Drop", trigger: "Collection rate drops below 92% this week", sev: "HIGH", sevColor: "text-red-400" },
              { signal: "High-Value Invoice Aging", trigger: "Invoice >AED 5,000 with no payment after 15 days", sev: "HIGH", sevColor: "text-red-400" },
              { signal: "Pipeline Dry Alert", trigger: "<24h of booked car-ins remaining in schedule", sev: "CRITICAL", sevColor: "text-red-500" },
              { signal: "Revenue Forecast Gap", trigger: "72h projection <85% of target", sev: "HIGH", sevColor: "text-red-400" },
            ].map((s) => (
              <div key={s.signal} className="rounded-lg border border-border bg-slate-800/40 p-3">
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
            engines={["e6", "e3"]}
          />
        )}
      </div>
    </AppLayout>
  );
}
