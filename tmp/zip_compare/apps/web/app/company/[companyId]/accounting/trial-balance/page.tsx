import { AppLayout } from "@repo/ui";
import TrialBalanceClient from "../reports/trial-balance/TrialBalanceClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyTrialBalanceAliasPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <TrialBalanceClient companyId={resolved.companyId} />
    </AppLayout>
  );
}
