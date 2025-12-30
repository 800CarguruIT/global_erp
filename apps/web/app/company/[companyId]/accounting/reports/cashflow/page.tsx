import CashflowClient from "./CashflowClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyCashflowPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <CashflowClient companyId={resolved.companyId} />;
}
