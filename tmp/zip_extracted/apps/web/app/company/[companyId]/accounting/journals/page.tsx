import { AppLayout } from "@repo/ui";
import JournalsClient from "./JournalsClient";

type Params = { params: { companyId: string } | Promise<{ companyId: string }> };

export default async function CompanyJournalsPage({ params }: Params) {
  const resolved = params instanceof Promise ? await params : params;
  return (
    <AppLayout forceScope={{ scope: "company", companyId: resolved.companyId }}>
      <JournalsClient companyId={resolved.companyId} />
    </AppLayout>
  );
}
