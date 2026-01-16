import { AppLayout, JobCardDetailMain } from "@repo/ui";

type Props =
  | { params: { companyId: string; jobCardId: string } }
  | { params: Promise<{ companyId: string; jobCardId: string }> };

export default async function JobCardDetailPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const jobCardId = resolved?.jobCardId?.toString?.();

  if (!companyId || !jobCardId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Job card ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <JobCardDetailMain companyId={companyId} jobCardId={jobCardId} />
    </AppLayout>
  );
}
