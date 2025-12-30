import PnlClient from "./PnlClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyPnlPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return <PnlClient companyId={resolved.companyId} />;
}
