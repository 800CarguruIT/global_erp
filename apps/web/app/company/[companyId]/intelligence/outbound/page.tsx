"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function OutboundIntelligencePage({
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
            <span className="text-xs text-slate-500">Outbound Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Outbound Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Why is connect rate below target? List vs agent vs time-of-day. Projected bookings from current pipeline if call pace holds.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Why is connect rate below target? List vs agent vs time-of-day.</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">Projected bookings from current pipeline if call pace holds.</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Top 3 agents to coach. Campaign to pause or push. List action.</div>
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
