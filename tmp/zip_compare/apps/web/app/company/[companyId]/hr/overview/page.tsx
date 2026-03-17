"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel, HrKpiGrid, EmployeesByBranchTable } from "@repo/ui";
import Link from "next/link";

export default function CompanyHrOverviewPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/hr/overview`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">HR Overview</h1>
          <p className="text-sm text-muted-foreground">Workforce analytics and AI-powered staffing insights.</p>
        </div>

        <AiInsightsPanel
          companyId={companyId}
          page="hr"
          title="HR Intelligence"
          showKpis={true}
          showInsights={true}
          showSummary={false}
          kpiColumns={3}
          maxInsights={4}
        />

        {!loading && data && (
          <>
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Employees by Branch</h2>
              <EmployeesByBranchTable rows={data.employeesByBranch ?? []} />
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href={`/company/${companyId}/hr`} className="rounded-md border px-3 py-1 hover:bg-muted">HR Home</Link>
              <Link href={`/company/${companyId}/hr/employees`} className="rounded-md border px-3 py-1 hover:bg-muted">All Employees</Link>
              <Link href={`/company/${companyId}/branches`} className="rounded-md border px-3 py-1 hover:bg-muted">Branches</Link>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
