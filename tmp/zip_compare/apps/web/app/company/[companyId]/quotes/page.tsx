"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanyQuotesPage({
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
          <h1 className="text-xl sm:text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-muted-foreground">Create and track quotations with AI pricing suggestions.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => router.push(`/company/${companyId}/quotes/branch`)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
            <div className="text-sm font-semibold">Branch Quotes</div>
            <div className="text-xs text-muted-foreground mt-1">Quotes from branches and workshops</div>
          </button>
          <button onClick={() => router.push(`/company/${companyId}/quotes/vendor`)} className="text-left rounded-xl border border-border/60 bg-card/80 p-4 transition hover:border-primary/50">
            <div className="text-sm font-semibold">Vendor Quotes</div>
            <div className="text-xs text-muted-foreground mt-1">Quotes from external vendors and suppliers</div>
          </button>
        </div>
        <AiInsightsPanel companyId={companyId} page="workshop" title="Quotes Intelligence" showKpis={false} showInsights={true} compact={true} maxInsights={3} onNavigate={(href) => router.push(`/company/${companyId}/${href}`)} />
      </div>
    </AppLayout>
  );
}
