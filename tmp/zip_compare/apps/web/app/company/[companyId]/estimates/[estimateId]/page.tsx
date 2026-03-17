import { AppLayout, EstimateDetailMain } from "@repo/ui";

type Props =
  | { params: { companyId: string; estimateId: string } }
  | { params: Promise<{ companyId: string; estimateId: string }> };

export default async function CompanyEstimateDetailPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const estimateId = resolved?.estimateId?.toString?.();

  if (!companyId || !estimateId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Estimate ID is required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <EstimateDetailMain companyId={companyId} estimateId={estimateId} />
    </AppLayout>
  );
}
