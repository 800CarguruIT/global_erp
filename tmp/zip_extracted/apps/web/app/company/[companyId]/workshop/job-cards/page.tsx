"use client";

import { useEffect, useState } from "react";
import { AppLayout, JobCardsMain, AiInsightsPanel } from "@repo/ui";

export default function JobCardsPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-4">
        <AiInsightsPanel
          companyId={companyId}
          page="workshop"
          title="Workshop Intelligence"
          showKpis={true}
          showInsights={true}
          showSummary={false}
          compact={true}
          kpiColumns={3}
          maxInsights={3}
        />
        <JobCardsMain companyId={companyId} />
      </div>
    </AppLayout>
  );
}
