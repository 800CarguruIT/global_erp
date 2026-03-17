"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel, CompanyAiConsoleView } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanyAiPanelPage({
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
          <h1 className="text-xl sm:text-2xl font-semibold">AI Panel</h1>
          <p className="text-sm text-muted-foreground">AI configuration, active modules, and intelligence status for this company.</p>
        </div>
        <CompanyAiConsoleView />
        <AiInsightsPanel companyId={companyId} page="company-dashboard" title="AI Health Check" showKpis={false} showInsights={true} showSummary={true} compact={true} maxInsights={4} onNavigate={(href) => router.push(`/company/${companyId}/${href}`)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => router.push(`/company/${companyId}/settings/ai/config`)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
            <div className="text-sm font-semibold">AI Configuration</div>
            <div className="text-xs text-muted-foreground mt-1">Provider settings, API keys, and model selection</div>
          </button>
          <button onClick={() => router.push(`/company/${companyId}/settings/ai/inquiries`)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
            <div className="text-sm font-semibold">AI Inquiries</div>
            <div className="text-xs text-muted-foreground mt-1">Call center AI inquiry logs and conversion tracking</div>
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
