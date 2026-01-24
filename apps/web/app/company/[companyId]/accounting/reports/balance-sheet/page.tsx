import { AppLayout } from "@repo/ui";
import BalanceSheetClient from "./BalanceSheetClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyBalanceSheetPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <BalanceSheetClient companyId={resolved.companyId} />
    </AppLayout>
  );
}
