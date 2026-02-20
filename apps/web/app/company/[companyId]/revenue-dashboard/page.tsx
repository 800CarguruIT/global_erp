import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props =
  | { params: { companyId: string } }
  | { params: Promise<{ companyId: string }> };

export default async function RevenueDashboardPage({ params }: Props) {
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
      <ModulePlaceholder
        title="Revenue Dashboard"
        description="Revenue insights are coming soon for this company. Check back soon for invoice and growth metrics."
      />
    </AppLayout>
  );
}
