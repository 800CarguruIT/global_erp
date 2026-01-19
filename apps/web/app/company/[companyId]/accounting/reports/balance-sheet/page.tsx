import BalanceSheetClient from "./BalanceSheetClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyBalanceSheetPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <BalanceSheetClient companyId={resolved.companyId} />;
}
