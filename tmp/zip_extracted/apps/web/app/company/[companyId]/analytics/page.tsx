"use client";

import { useEffect, useState } from "react";
import { AppLayout, AiInsightsPanel } from "@repo/ui";
import { DonutChart, BarChart, HorizontalBarChart, StatCardWithTrend } from "@repo/ui";
import { useRouter } from "next/navigation";

export default function CompanyAnalyticsPage({
  params,
}: {
  params: { companyId: string } | Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.resolve(params).then((p) => setCompanyId(p?.companyId ?? null));
  }, [params]);

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/company/${companyId}/ai/insights?page=analytics`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  if (!companyId) return <AppLayout><div className="py-4 text-sm text-muted-foreground">Loading...</div></AppLayout>;

  const kpis = data?.kpis ?? [];
  const get = (key: string) => kpis.find((k: any) => k.key === key);

  const totalLeads = get("total_leads")?.value ?? 0;
  const openLeads = get("open_leads")?.value ?? 0;
  const wonLeads = totalLeads - openLeads;
  const activeJobs = get("active_jobs")?.value ?? 0;
  const callsToday = get("calls_today")?.value ?? 0;
  const revenue = get("revenue")?.value ?? 0;
  const overdue = get("overdue_invoices")?.value ?? 0;
  const convRate = get("conversion_rate")?.value ?? 0;
  const velocity = get("lead_velocity");

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Company Analytics</h1>
          <p className="text-sm text-muted-foreground">Cross-module intelligence — leads, operations, revenue, and workforce in one view.</p>
        </div>

        {/* Top Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardWithTrend label="Total Revenue" value={revenue} format="currency" color="#818cf8" />
          <StatCardWithTrend label="Active Jobs" value={activeJobs} format="number" color="#34d399" />
          <StatCardWithTrend label="Conversion Rate" value={convRate} format="percent" color="#fbbf24" />
          <StatCardWithTrend label="Calls Today" value={callsToday} format="number" color="#60a5fa" />
        </div>

        {/* Charts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <DonutChart
              title="Lead Pipeline"
              data={[
                { label: "Open", value: openLeads, color: "#60a5fa" },
                { label: "Won", value: wonLeads, color: "#34d399" },
              ]}
              size={110}
              thickness={18}
              centerValue={totalLeads}
              centerLabel="Total"
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            <BarChart
              title="Module Activity"
              data={[
                { label: "Leads", value: totalLeads, color: "#60a5fa" },
                { label: "Jobs", value: activeJobs, color: "#34d399" },
                { label: "Calls", value: callsToday, color: "#a78bfa" },
                { label: "Overdue", value: overdue, color: "#f87171" },
              ]}
              height={140}
            />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
            {velocity && (
              <StatCardWithTrend
                label="Lead Velocity"
                value={velocity.value}
                previousValue={velocity.previousValue}
                format="number"
                color="#818cf8"
              />
            )}
            <div className="mt-3">
              <HorizontalBarChart
                title="Key Metrics"
                data={[
                  { label: "Revenue", value: revenue },
                  { label: "Leads", value: totalLeads },
                  { label: "Jobs", value: activeJobs },
                  { label: "Calls", value: callsToday },
                ]}
                maxBars={4}
              />
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <AiInsightsPanel
          companyId={companyId}
          page="analytics"
          title="AI Cross-Module Analysis"
          showKpis={false}
          showInsights={true}
          showSummary={true}
          maxInsights={8}
          onNavigate={(href) => router.push(`/company/${companyId}/${href}`)}
        />
      </div>
    </AppLayout>
  );
}
