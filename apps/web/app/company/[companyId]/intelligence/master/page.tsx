"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function MasterIntelligencePage({
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
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-purple-400">
              AI Intelligence
            </span>
            <span className="text-xs text-slate-500">Master Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Master Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Why off-plan? Top 3 root causes ranked by revenue impact. 72h forecast vs target. Priority action list.
          </p>
        </div>

        {/* Focus areas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Why off-plan? Top 3 root causes ranked by revenue impact.</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">72h revenue forecast vs target. Top 3 risks.</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Priority action list: ranked by revenue impact. Owner. Deadline.</div>
          </div>
        </div>

        {/* AI Panel */}
        {companyId && (
          <AIPanel
            companyId={companyId}
            engines={["e1", "e3", "e5"]}
          />
        )}
      </div>
    </AppLayout>
  );
}
