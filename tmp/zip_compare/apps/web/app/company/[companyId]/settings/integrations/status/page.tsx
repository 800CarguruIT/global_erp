"use client";

import { useEffect, useState } from "react";
import { AppLayout, IntegrationHealthDashboard } from "@repo/ui";

export default function CompanyIntegrationStatusPage({
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
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Integration Status</h1>
          <p className="text-sm text-muted-foreground">Health dashboard for all active dialer and channel integrations.</p>
        </div>
        <IntegrationHealthDashboard scope="company" scopeId={companyId} />
      </div>
    </AppLayout>
  );
}
