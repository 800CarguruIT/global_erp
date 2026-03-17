"use client";

import { useEffect, useState } from "react";
import { AppLayout, ProcurementMain, AiInsightsPanel } from "@repo/ui";

export default function CompanyProcurementPage({
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
        <AiInsightsPanel companyId={companyId} page="inventory" title="Procurement Intelligence" showKpis={false} showInsights={true} compact={true} maxInsights={3} />
        <ProcurementMain companyId={companyId} />
      </div>
    </AppLayout>
  );
}
