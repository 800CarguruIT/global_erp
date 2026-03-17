import AccountingClient from "./AccountingClient";

type PageParams = { companyId: string } | Promise<{ companyId: string }>;

export default async function CompanyAccountingPage({ params }: { params: PageParams }) {
  const resolved = params instanceof Promise ? await params : params;
  return <AccountingClient companyId={resolved.companyId} />;
}
