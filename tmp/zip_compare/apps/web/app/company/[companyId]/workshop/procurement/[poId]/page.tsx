import { AppLayout, ProcurementDetailMain } from "@repo/ui";

type Props =
  | { params: { companyId: string; poId: string } }
  | { params: Promise<{ companyId: string; poId: string }> };

export default async function ProcurementDetailPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const poId = resolved?.poId?.toString?.();

  if (!companyId || !poId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company ID and PO ID are required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ProcurementDetailMain companyId={companyId} poId={poId} />
    </AppLayout>
  );
}
