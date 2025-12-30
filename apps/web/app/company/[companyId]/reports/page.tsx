import Link from "next/link";
import { AppLayout } from "@repo/ui";

export default function CompanyReportsPage({ params }: { params: { companyId: string } }) {
  const { companyId } = params;
  return (
    <AppLayout>
      <div className="space-y-3 py-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Access high-level KPIs and reporting for this company.
        </p>
        <Link
          href={`/company/${companyId}/reports/overview`}
          className="inline-flex w-fit rounded-md border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Open Reports Overview
        </Link>
      </div>
    </AppLayout>
  );
}
