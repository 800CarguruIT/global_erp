"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel, StaffCopilot } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanyReportsOverviewPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Reports Overview</h1>
          <p className="text-sm text-muted-foreground">AI-generated executive summary with KPIs across all modules.</p>
        </div>
        <AiInsightsPanel
          companyId={companyId}
          page="company-dashboard"
          title="Executive Intelligence"
          showKpis={true}
          showInsights={true}
          showSummary={true}
          kpiColumns={4}
          maxInsights={8}
          onNavigate={(href) => router.push(`/company/${companyId}/${href}`)}
        />
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {[
            { title: "Profit & Loss", href: `accounting/reports/pnl` },
            { title: "Balance Sheet", href: `accounting/reports/balance-sheet` },
            { title: "Cash Flow", href: `accounting/reports/cashflow` },
            { title: "Trial Balance", href: `accounting/reports/trial-balance` },
          ].map((r) => (
            <button key={r.href} onClick={() => router.push(`/company/${companyId}/${r.href}`)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
              <div className="text-sm font-semibold">{r.title}</div>
              <div className="text-xs text-muted-foreground mt-1">View report →</div>
            </button>
          ))}
        </div>
        <StaffCopilot companyId={companyId} currentPage="reports" onNavigate={(href) => router.push(href)} />
      </div>
    </AppLayout>
  );
}
