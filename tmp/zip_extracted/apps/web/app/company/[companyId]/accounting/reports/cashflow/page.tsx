import { AppLayout } from "@repo/ui";
import CashFlowClient from "./CashflowClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyCashFlowPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <CashFlowClient companyId={resolved.companyId} />
    </AppLayout>
  );
}
