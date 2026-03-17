"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanySalesJobsPage({
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
          <h1 className="text-xl sm:text-2xl font-semibold">Sales Jobs</h1>
          <p className="text-sm text-muted-foreground">Jobs generated from the sales pipeline with AI conversion tracking.</p>
        </div>
        <AiInsightsPanel companyId={companyId} page="workshop" title="Sales Jobs Intelligence" showKpis={true} showInsights={true} compact={true} kpiColumns={3} onNavigate={(href) => router.push(`/company/${companyId}/${href}`)} />
      </div>
    </AppLayout>
  );
}
