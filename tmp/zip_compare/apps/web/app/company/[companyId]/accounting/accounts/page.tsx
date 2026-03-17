import ChartClient from "../chart-of-accounts/ChartClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyAccountsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <ChartClient companyId={resolved.companyId} />;
}
