import { AppLayout } from "@repo/ui";
import AccountStatementClient from "./AccountStatementClient";

type Params = {
  params: { companyId: string } | Promise<{ companyId: string }>;
  searchParams?: { accountCode?: string };
};

export default async function AccountStatementPage({ params, searchParams }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  const accountCode = searchParams?.accountCode ?? "";
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <AccountStatementClient companyId={resolved.companyId} initialAccountCode={accountCode} />
    </AppLayout>
  );
}
