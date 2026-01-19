import ChartClient from "./ChartClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyChartOfAccountsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <ChartClient companyId={resolved.companyId} />;
}
