import { HrReports } from "@repo/ai-core/server";
import { AppLayout, EmployeesByBranchTable, HrKpiGrid } from "@repo/ui";
import Link from "next/link";

type PageProps = { params: { companyId: string } };

export default async function CompanyHrOverviewPage({ params }: PageProps) {
  const { companyId } = params;
  const data = await HrReports.getCompanyHrOverview(companyId);

  return (
    <AppLayout>
      <div className="space-y-6 py-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold">HR Overview</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of employees and branch capacity.
          </p>
        </div>

        <HrKpiGrid
          totalEmployees={data.totalEmployees}
          technicians={data.technicians}
          managers={data.managers}
          callAgents={data.callAgents}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Employees by Branch</h2>
            <Link
              href={`/company/${companyId}/hr`}
              className="text-xs text-primary hover:underline"
            >
              View HR
            </Link>
          </div>
          <EmployeesByBranchTable rows={data.employeesByBranch} />
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Quick links</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href={`/company/${companyId}/hr`}
              className="rounded-md border px-3 py-1 hover:bg-muted"
            >
              HR Home
            </Link>
            <Link
              href={`/company/${companyId}/branches`}
              className="rounded-md border px-3 py-1 hover:bg-muted"
            >
              Branches
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
