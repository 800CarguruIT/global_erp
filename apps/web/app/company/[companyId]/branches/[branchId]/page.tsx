import { AppLayout, ModulePlaceholder } from "@repo/ui";

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

export default async function BranchDashboardPage({ params }: Props) {
  const resolved = await (params as any);
  const companyId = resolved?.companyId?.toString?.();
  const branchId = resolved?.branchId?.toString?.();

  if (!companyId || !branchId) {
    return (
      <AppLayout>
        <div className="p-4 text-sm text-destructive">Company and branch ID are required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ModulePlaceholder
        title="Branch Dashboard"
        description="Branch overview and KPIs."
      />
    </AppLayout>
  );
}
