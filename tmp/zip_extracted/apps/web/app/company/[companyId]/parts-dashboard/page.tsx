"use client";

import { useEffect, useState } from "react";
import { AppLayout, OrderedPartsDashboardMain, AiInsightsPanel } from "@repo/ui";

export default function OrderedPartsDashboardPage({
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
        <AiInsightsPanel companyId={companyId} page="inventory" title="Parts Intelligence" showKpis={false} showInsights={true} compact={true} maxInsights={3} />
        <OrderedPartsDashboardMain companyId={companyId} />
      </div>
    </AppLayout>
  );
}
