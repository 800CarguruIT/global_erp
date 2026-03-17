"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel, StaffCopilot } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function BranchDashboardPage({
  params,
}: {
  params: { companyId: string; branchId: string } | Promise<{ companyId: string; branchId: string }>;
}) {
  const router = useRouter();
  const [ids, setIds] = useState<{ companyId: string; branchId: string } | null>(null);

  useEffect(() => {
    Promise.resolve(params).then((p) => setIds({ companyId: p.companyId, branchId: p.branchId }));
  }, [params]);

  if (!ids) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Branch Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time branch operations, bay utilization, and AI-powered insights.</p>
        </div>
        <AiInsightsPanel
          companyId={ids.companyId}
          branchId={ids.branchId}
          page="branch-dashboard"
          title="Branch Intelligence"
          showKpis={true}
          showInsights={true}
          showSummary={true}
          kpiColumns={3}
          onNavigate={(href) => router.push(`/company/${ids.companyId}/branches/${ids.branchId}/${href}`)}
        />
        <StaffCopilot companyId={ids.companyId} branchId={ids.branchId} currentPage="branch-dashboard" onNavigate={(href) => router.push(href)} />
      </div>
    </AppLayout>
  );
}
