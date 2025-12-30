import { AppLayout, BranchJobsMain } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchJobsPage({ params }: Props) {
  const { companyId, branchId } = params;

  return (
    <AppLayout>
      <BranchJobsMain companyId={companyId} branchId={branchId} />
    </AppLayout>
  );
}
