import { Reports } from "@repo/ai-core/server";
import { AppLayout, KpiGrid, ModulePlaceholder } from "@repo/ui";

type PageProps = { params: { companyId: string } };

export default async function CompanyReportsOverviewPage({ params }: PageProps) {
  const { companyId } = params;
  let overview: Awaited<ReturnType<typeof Reports.getCompanyReportsOverview>> | null = null;

  try {
    overview = await Reports.getCompanyReportsOverview(companyId);
  } catch (err) {
    return (
      <AppLayout>
        <ModulePlaceholder
          title="Reports Overview"
          description="Failed to load reports overview. Please check database connectivity."
        />
      </AppLayout>
    );
  }

  const items: { label: string; value: number | string; subtitle?: string }[] = [
    { label: "Total Leads", value: overview.totalLeads },
    { label: "Open Leads", value: overview.openLeads },
    { label: "Won Leads", value: overview.wonLeads },
    { label: "Workshop Jobs", value: overview.totalWorkshopJobs },
    { label: "Active Jobs", value: overview.activeWorkshopJobs },
    { label: "Completed Jobs", value: overview.completedWorkshopJobs },
    { label: "Calls Today", value: overview.todayCalls },
    { label: "Missed Calls Today", value: overview.missedCallsToday },
  ];

  if (typeof overview.invoicesCount === "number") {
    items.push({ label: "Invoices", value: overview.invoicesCount });
  }
  if (typeof overview.revenueTotal === "number") {
    items.push({
      label: "Revenue",
      value: overview.revenueTotal.toLocaleString(undefined, { minimumFractionDigits: 0 }),
      subtitle: "Grand total of invoices",
    });
  }

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">Reports Overview</h1>
          <p className="text-sm text-muted-foreground">
            Quick KPIs across sales, jobs, and call center for this company.
          </p>
        </div>
        <KpiGrid items={items} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2">Leads snapshot</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Total: {overview.totalLeads}</li>
              <li>Open / In Progress: {overview.openLeads}</li>
              <li>Won: {overview.wonLeads}</li>
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-2">Workshop jobs snapshot</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Total: {overview.totalWorkshopJobs}</li>
              <li>Active: {overview.activeWorkshopJobs}</li>
              <li>Completed: {overview.completedWorkshopJobs}</li>
            </ul>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
