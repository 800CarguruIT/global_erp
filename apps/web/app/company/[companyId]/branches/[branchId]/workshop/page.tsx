import { AppLayout } from "@repo/ui";
import { BranchWorkshopDashboard } from "./BranchWorkshopDashboard";

type Props =
  | { params: { companyId: string; branchId: string } }
  | { params: Promise<{ companyId: string; branchId: string }> };

export default async function BranchWorkshopLayoutPage({ params }: Props) {
  const resolved = await Promise.resolve(params);
  const companyId = resolved?.companyId?.toString?.();
  const branchId = resolved?.branchId?.toString?.();

  if (!companyId || !branchId) {
    return (
      <AppLayout hideSidebar>
        <div className="p-4 text-sm text-destructive">Company and branch are required.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideSidebar>
      <div className="space-y-6 py-4">
        <BranchWorkshopDashboard companyId={companyId} branchId={branchId} />
      </div>
    </AppLayout>
  );
}
