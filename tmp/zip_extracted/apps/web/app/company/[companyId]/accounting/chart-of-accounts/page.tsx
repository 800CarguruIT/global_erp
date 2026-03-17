import { AppLayout } from "@repo/ui";
import ChartOfAccountsClient from "./ChartOfAccountsClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyChartOfAccountsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Company accounting structure and headings.</p>
        </div>
        <ChartOfAccountsClient companyId={resolved.companyId} />
      </div>
    </AppLayout>
  );
}
