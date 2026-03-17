"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { LeadsMain } from "@repo/ui/main-pages/LeadsMain";

export default function CompanyLeadsPage({
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
      {companyId ? (
        <div className="space-y-4">
          <AiInsightsPanel
            companyId={companyId}
            page="leads"
            title="Leads Intelligence"
            showKpis={true}
            showInsights={true}
            showSummary={false}
            compact={true}
            kpiColumns={3}
            maxInsights={3}
          />
          <LeadsMain companyId={companyId} />
        </div>
      ) : (
        <div className="py-4 text-sm text-muted-foreground">Loading...</div>
      )}
    </AppLayout>
  );
}
