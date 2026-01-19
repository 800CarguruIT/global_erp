import { AppLayout, BranchQuotesMain } from "@repo/ui";

type Props = { params: { companyId: string; branchId: string } };

export default function BranchQuotesPage({ params }: Props) {
  const { companyId, branchId } = params;

  return (
    <AppLayout>
      <BranchQuotesMain companyId={companyId} branchId={branchId} />
    </AppLayout>
  );
}
