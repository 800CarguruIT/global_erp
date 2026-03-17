import { AppLayout, QueueSystemMain } from "@repo/ui";

type Props =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function CompanyLeadsQueuePage({ params }: Props) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId?.toString?.();

  if (!companyId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <QueueSystemMain companyId={companyId} />
    </AppLayout>
  );
}
