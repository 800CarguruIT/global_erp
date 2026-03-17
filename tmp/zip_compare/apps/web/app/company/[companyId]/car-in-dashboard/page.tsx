"use client";

import { useEffect, useState } from "react";
import { AppLayout, CarInDashboardMain, AiInsightsPanel } from "@repo/ui";

export default function CarInDashboardPage({
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
        <AiInsightsPanel companyId={companyId} page="workshop" title="Check-In Intelligence" showKpis={false} showInsights={true} compact={true} maxInsights={2} />
        <CarInDashboardMain companyId={companyId} />
      </div>
    </AppLayout>
  );
}
