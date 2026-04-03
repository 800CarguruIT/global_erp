"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@repo/ui";
import { AIPanel } from "../../../../(components)/intelligence/AIPanel";

export default function PortfolioIntelligencePage({
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
            <span className="text-xs text-slate-500">Portfolio Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold">Portfolio Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Which customers are most at risk today and why? Churn trajectory, named customers to call ranked by revenue at risk.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Diagnostic</div>
            <div className="text-sm text-slate-300">Which customers are most at risk today and why?</div>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Predictive</div>
            <div className="text-sm text-slate-300">Churn trajectory: how many reach Critical tier in 30 days?</div>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-orange-400 mb-1">Prescriptive</div>
            <div className="text-sm text-slate-300">Named customers to call, ranked by revenue at risk. Offer type.</div>
          </div>
        </div>

        {/* Risk Tier Reference */}
        <div className="rounded-xl border border-border bg-slate-900/40 p-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Churn Risk Tiers</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { tier: "LOW", score: "0–30", window: "30 days", color: "text-green-400 bg-green-500/10 border-green-500/20" },
              { tier: "MEDIUM", score: "31–55", window: "7 days", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
              { tier: "HIGH", score: "56–79", window: "48 hours", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
              { tier: "CRITICAL", score: "80–100", window: "24 hours", color: "text-red-400 bg-red-500/10 border-red-500/20" },
            ].map((t) => (
              <div key={t.tier} className={`rounded-lg border p-3 ${t.color}`}>
                <div className="text-xs font-bold mb-1">{t.tier}</div>
                <div className="text-[10px] text-slate-400">Score: {t.score}</div>
                <div className="text-[10px] text-slate-400">Act within: {t.window}</div>
              </div>
            ))}
          </div>
        </div>

        {companyId && (
          <AIPanel
            companyId={companyId}
            engines={["e4"]}
          />
        )}
      </div>
    </AppLayout>
  );
}
