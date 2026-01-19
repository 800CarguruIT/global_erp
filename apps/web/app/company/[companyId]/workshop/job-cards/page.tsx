import { AppLayout, JobCardsMain } from "@repo/ui";

type Props =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function JobCardsPage({ params }: Props) {
  const resolved = await (params as any);
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
      <JobCardsMain companyId={companyId} />
    </AppLayout>
  );
}
