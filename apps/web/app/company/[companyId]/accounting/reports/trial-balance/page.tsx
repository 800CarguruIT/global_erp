import TrialBalanceClient from "./TrialBalanceClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyTrialBalancePage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <TrialBalanceClient companyId={resolved.companyId} />;
}
